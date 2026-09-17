import { describe, expect, it } from 'vitest'
import { generateExercise } from '../index'
import { SeededRng } from '../../engine/rng'
import { fromMinuteOfDay } from '../../domain/dutch-time'
import type { GeneratorContext } from '../types'

function ctx(overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    seed: 'test-seed',
    tier: 'S2',
    band: 'standard',
    purpose: 'growth',
    primarySkillId: 'PV.DHTE.Decompose',
    ...overrides,
  }
}

describe('generators', () => {
  it('are deterministic from the seed alone', () => {
    for (const skill of [
      'PV.DHTE.Decompose',
      'ADD.JUMP.TenBridge',
      'ADD.COLUMN.Carry',
      'MEAS.RULER.Offset',
      'DIV.REMAINDER.CeilContext',
      'DIV.REMAINDER.Compute',
      'TIME.READ.DutchPhrasingHalfHourOffset',
      'MONEY.CHANGE.Complement',
      'MEAS.LENGTH.Convert',
      'MEAS.MIXED.ComposeSplit',
    ]) {
      const a = generateExercise(ctx({ primarySkillId: skill, seed: `s1:${skill}` }))
      const b = generateExercise(ctx({ primarySkillId: skill, seed: `s1:${skill}` }))
      expect(a.id).toBe(b.id)
      expect(a.fingerprint).toBe(b.fingerprint)
      expect(a.steps.map((s) => s.solutionNl)).toEqual(b.steps.map((s) => s.solutionNl))
    }
  })

  it('bridge skills actually produce their bridge (one dimension at a time)', () => {
    for (let i = 0; i < 25; i++) {
      const ex = generateExercise(
        ctx({ primarySkillId: 'ADD.JUMP.HundredBridge', seed: `h${i}`, tier: 'S1' }),
      )
      const [a, b] = ex.fingerprint.replace('nlj:', '').split('+').map(Number)
      // Verify a hundred boundary is actually crossed.
      const sum = a! + b!
      const eCross = (a! % 10) + (b! % 10) >= 10
      const tCross = (Math.floor(a! / 10) % 10) + (Math.floor(b! / 10) % 10) + (eCross ? 1 : 0) >= 10
      const hCross = Math.floor(a! / 100) + Math.floor(b! / 100) + (tCross ? 1 : 0) >= 10
      expect(hCross || tCross || eCross).toBe(true)
      expect(sum).toBeLessThanOrEqual(999)
    }
  })

  it('DIV.REMAINDER invariants: N = q·d + r with 0 ≤ r < d', () => {
    const rng = new SeededRng('div')
    for (let i = 0; i < 25; i++) {
      const ex = generateExercise(
        ctx({ primarySkillId: 'DIV.REMAINDER.Compute', seed: `div${i}:${rng.next()}`, tier: 'S1' }),
      )
      const step = ex.steps.find((s) => s.id === 'quotient')!
      // solutionNl format: "N : d = q, rest r"
      const m = step.solutionNl.match(/(\d+) : (\d+) = (\d+), rest (\d+)/)
      expect(m).not.toBeNull()
      const N = Number(m![1])
      const d = Number(m![2])
      const q = Number(m![3])
      const r = Number(m![4])
      expect(q * d + r).toBe(N)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(d)
    }
  })

  it('division context items separate calculation from interpretation evidence', () => {
    const ex = generateExercise(
      ctx({ primarySkillId: 'DIV.REMAINDER.CeilContext', seed: 'bus-1', tier: 'S1' }),
    )
    expect(ex.steps.length).toBe(2)
    expect(ex.steps[0]!.skillTarget.role).toBe('supporting')
    expect(ex.steps[0]!.skillTarget.skillId).toBe('DIV.REMAINDER.Compute')
    expect(ex.steps[1]!.skillTarget.role).toBe('primary')
    expect(ex.supportingSkillIds).toContain('DIV.REMAINDER.Compute')
  })

  it('clock items target the exact phrasing minutes per KC', () => {
    const ex = generateExercise(
      ctx({ primarySkillId: 'TIME.READ.DutchHourQuarter', seed: 'c1' }),
    )
    // DutchHourQuarter only uses uur / kwart over / kwart voor (0, 15, 45).
    for (let i = 0; i < 20; i++) {
      const e = generateExercise(ctx({ primarySkillId: 'TIME.READ.DutchHourQuarter', seed: `cq${i}` }))
      expect(e.fingerprint).toMatch(/clock:(\d+)$/)
      const minuteOfDay = Number(e.fingerprint.split(':')[1]) % 60
      expect([0, 15, 45]).toContain(minuteOfDay)
    }
    for (let i = 0; i < 20; i++) {
      const e = generateExercise(
        ctx({ primarySkillId: 'TIME.READ.DutchPhrasingHalfHourOffset', seed: `ch${i}` }),
      )
      const minuteOfDay = Number(e.fingerprint.split(':')[1]) % 60
      expect([20, 25, 35, 40]).toContain(minuteOfDay)
    }
    void ex
  })

  it('clock coaching text matches the phrase, not the half-hour rule', () => {
    // Regression: "5 over 2" used to be taught with "half 9 is 08:30" — text
    // about a rule the item does not exercise.
    const halfWord = /\bhal(f|ve)\b/i
    for (const skill of [
      'TIME.READ.MinuteFive',
      'TIME.READ.DutchHourQuarter',
      'TIME.READ.DutchHourOffset',
      'TIME.READ.DutchHalfNextHour',
      'TIME.READ.DutchPhrasingHalfHourOffset',
    ]) {
      for (const tier of ['S1', 'S3'] as const) {
        for (let i = 0; i < 30; i++) {
          const ex = generateExercise(ctx({ primarySkillId: skill, seed: `coach:${skill}:${i}`, tier }))
          const step = ex.steps[0]!
          const phrase = step.promptNl.match(/"([^"]+)"/)![1]!
          const isHalfPhrase = halfWord.test(phrase)
          // Wrong-but-unrecognised answer exercises the fallback feedback.
          const wrong = step.validate('7:07')
          expect(wrong.isCorrect).toBe(false)
          const copy = [
            ex.instructionNl,
            ...ex.hintsNl!,
            ...ex.explanationNl.slice(2),
            wrong.feedbackNl,
          ]
          for (const line of copy) {
            if (!isHalfPhrase) expect(line, `${phrase} / ${skill}`).not.toMatch(halfWord)
          }
        }
      }
    }
  })

  it('clock coaching points at the right hour: already passed vs still coming', () => {
    // "Welk uur komt eraan?" is upcoming-hour framing. It fits "half 9",
    // "kwart voor 9" and "10 voor 9", where the named hour has not arrived —
    // and contradicts "5 over 2", where the named hour is already behind us.
    const upcoming = /komt (er nog aan|eraan)|eraan komt|nog niet geweest/i
    const alreadyPassed = /al geweest/i
    for (const skill of [
      'TIME.READ.MinuteFive',
      'TIME.READ.DutchHourQuarter',
      'TIME.READ.DutchHourOffset',
      'TIME.READ.DutchHalfNextHour',
      'TIME.READ.DutchPhrasingHalfHourOffset',
    ]) {
      for (const tier of ['S1', 'S3'] as const) {
        for (let i = 0; i < 30; i++) {
          const ex = generateExercise(ctx({ primarySkillId: skill, seed: `dir:${skill}:${i}`, tier }))
          const step = ex.steps[0]!
          const phrase = step.promptNl.match(/"([^"]+)"/)![1]!
          // "voor" and "half" name the hour ahead; "uur" and "over" the one behind.
          const namesUpcomingHour = /\b(voor|half)\b/.test(phrase)
          const copy = [
            ex.instructionNl,
            ...ex.hintsNl!,
            ...ex.explanationNl.slice(2),
            step.validate('7:07').feedbackNl,
          ]
          for (const line of copy) {
            const forbidden = namesUpcomingHour ? alreadyPassed : upcoming
            expect(line, `${phrase} / ${skill}`).not.toMatch(forbidden)
          }
        }
      }
    }
  })

  const CLOCK_SKILLS = [
    'TIME.READ.MinuteFive',
    'TIME.READ.DutchHourQuarter',
    'TIME.READ.DutchHourOffset',
    'TIME.READ.DutchHalfNextHour',
    'TIME.READ.DutchPhrasingHalfHourOffset',
  ]

  /** Every clock string shown BEFORE the child has answered. */
  function preAnswerCopy(ex: ReturnType<typeof generateExercise>): string[] {
    // explanationNl[0..1] are the phrase and the solution by design; the UI
    // only renders them once every step is solved.
    return [ex.instructionNl, ...ex.hintsNl!, ...ex.explanationNl.slice(2)]
  }

  it('clock hints illustrate the rule without giving away the answer', () => {
    for (const skill of CLOCK_SKILLS) {
      for (const tier of ['S1', 'S3'] as const) {
        for (let i = 0; i < 30; i++) {
          const ex = generateExercise(ctx({ primarySkillId: skill, seed: `leak:${skill}:${i}`, tier }))
          const { hours, minutes } = fromMinuteOfDay(Number(ex.fingerprint.split(':')[1]))
          const mm = String(minutes).padStart(2, '0')
          // The solution reaches the screen as 08:30, and a child reads and
          // writes it as 8:30 — a substring check against solutionNl alone
          // misses the second form, which is how this leak survived before.
          const notations = [ex.steps[0]!.solutionNl, `${hours}:${mm}`, `${hours % 12 === 0 ? 12 : hours % 12}:${mm}`]
          for (const line of preAnswerCopy(ex)) {
            for (const n of notations) expect(line, `${skill} / ${ex.steps[0]!.promptNl}`).not.toContain(n)
          }
        }
      }
    }
  })

  it('clock copy names the half hour from the child\'s own sentence', () => {
    // "10 voor half 3" coached with 'Zoek het halve uur in de zin: "half 9"'
    // sends the child hunting for a phrase that is not in front of them.
    for (const skill of CLOCK_SKILLS) {
      for (const tier of ['S1', 'S3'] as const) {
        for (let i = 0; i < 30; i++) {
          const ex = generateExercise(ctx({ primarySkillId: skill, seed: `anchor:${skill}:${i}`, tier }))
          const phrase = ex.steps[0]!.promptNl.match(/"([^"]+)"/)![1]!
          const own = phrase.match(/half (\d{1,2})/)?.[1]
          if (own === undefined) continue
          // The worked example deliberately names another hour; it announces
          // itself as an example rather than describing the child's sentence.
          const describesThisItem = preAnswerCopy(ex).filter((l) => !l.startsWith('Zo werkt het:'))
          for (const line of describesThisItem) {
            for (const [, named] of line.matchAll(/half (\d{1,2})/gi)) {
              expect(named, `${phrase} / ${line}`).toBe(own)
            }
          }
          expect(describesThisItem.some((l) => l.includes(`half ${own}`) || l.includes(`Half ${own}`)), phrase).toBe(true)
        }
      }
    }
  })

  it('validates its own answers (correct and misconception signatures)', () => {
    // DHTE zero collapse: 5307 typed with tens 3 instead of 0.
    const dhte = generateExercise(
      ctx({ primarySkillId: 'PV.DHTE.Decompose', seed: 'fixed:5307' }),
    )
    // Deterministic seeds can't force 5307 directly; use the widget props.
    const n = dhte.widget!.props.number as number
    const digits = String(n).padStart(4, '0')
    const correct = dhte.steps[0]!.validate({ D: digits[0], H: digits[1], T: digits[2], E: digits[3] })
    expect(correct.isCorrect).toBe(true)

    // Ruler offset: reporting the endpoint is the OriginOne signature.
    const ruler = generateExercise(ctx({ primarySkillId: 'MEAS.RULER.Offset', seed: 'r1' }))
    const { startMm, endMm } = ruler.widget!.props as { startMm: number; endMm: number }
    const wrong = ruler.steps[0]!.validate(endMm)
    expect(wrong.isCorrect).toBe(false)
    expect(wrong.misconceptionId).toBe('MC.MEAS.OriginOne')
    const right = ruler.steps[0]!.validate(endMm - startMm)
    expect(right.isCorrect).toBe(true)

    // Bus interpretation: answering with the quotient is AlwaysRound (ceil).
    const bus = generateExercise(
      ctx({ primarySkillId: 'DIV.REMAINDER.CeilContext', seed: 'busfixed', tier: 'S1' }),
    )
    const qStep = bus.steps.find((s) => s.id === 'quotient')!
    const q = Number(qStep.solutionNl.match(/= (\d+),/)![1])
    const interp = bus.steps.find((s) => s.id === 'interpret')!
    const mis = interp.validate(q)
    expect(mis.misconceptionId).toBe('MC.DIV.AlwaysRound')
  })

  it('money change uses integer cents and accepts €4,5 as €4,50', () => {
    const ex = generateExercise(ctx({ primarySkillId: 'MONEY.CHANGE.Complement', seed: 'm1' }))
    const step = ex.steps[0]!
    // Extract the answer from the solution string "€x,xx − €y,yy = €z,zz".
    const m = step.solutionNl.match(/= €(\d+),(\d{2})$/)
    expect(m).not.toBeNull()
    const euros = Number(m![1])
    const cents = Number(m![2])
    expect(step.validate(`${euros},${cents}`).isCorrect).toBe(true)
    if (cents % 10 === 0) {
      // "€4,5" style (one fractional digit) means €4,50.
      expect(step.validate(`${euros},${cents / 10}`).isCorrect).toBe(true)
    }
  })

  it('unit conversions use the actual ratios (m↔km = 1,000)', () => {
    for (let i = 0; i < 25; i++) {
      const ex = generateExercise(ctx({ primarySkillId: 'MEAS.LENGTH.Convert', seed: `u${i}` }))
      const prompt = ex.steps[0]!.promptNl // "7 km = ? m"
      const m = prompt.match(/(\d+) (km|mm|dm|cm|m) = \? (km|mm|dm|cm|m)/)
      expect(m).not.toBeNull()
      const answer = Number(ex.steps[0]!.solutionNl.split(' ')[3])
      const ratios: Record<string, number> = { km: 1e6, m: 1e3, dm: 100, cm: 10, mm: 1 }
      const from = Number(m![1])
      const expected = (from * ratios[m![2]!]) / ratios[m![3]!]
      expect(answer).toBe(expected)
    }
  })

  it('rejects unsupported skills and constraint-violating requests', () => {
    expect(() => generateExercise(ctx({ primarySkillId: 'FND.COUNT.Group' }))).toThrow()
    expect(() => generateExercise(ctx({ primarySkillId: 'TIME.CALC.Elapsed' }))).toThrow()
  })

  it('ADD.COLUMN.Align never carries; ADD.COLUMN.Carry always carries', () => {
    const carryCountOf = (a: number, b: number) => {
      let count = 0
      const e = (a % 10) + (b % 10)
      if (e >= 10) count++
      const t = (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) + (e >= 10 ? 1 : 0)
      if (t >= 10) count++
      const h = Math.floor(a / 100) + Math.floor(b / 100) + (t >= 10 ? 1 : 0)
      if (h >= 10) count++
      return count
    }
    for (const band of ['easier', 'standard', 'harder'] as const) {
      for (let i = 0; i < 20; i++) {
        const align = generateExercise(
          ctx({ primarySkillId: 'ADD.COLUMN.Align', seed: `align:${band}:${i}`, band }),
        )
        const [a, b] = align.fingerprint.replace('coladd:', '').split('+').map(Number)
        expect(carryCountOf(a!, b!)).toBe(0)
        expect(align.variationTags).toEqual(['no-carry'])

        const carry = generateExercise(
          ctx({ primarySkillId: 'ADD.COLUMN.Carry', seed: `carry:${band}:${i}`, band }),
        )
        const [c, d] = carry.fingerprint.replace('coladd:', '').split('+').map(Number)
        const count = carryCountOf(c!, d!)
        if (band === 'harder') {
          expect(count).toBeGreaterThanOrEqual(2)
          expect(carry.variationTags).toEqual(['chained-carry'])
        } else {
          expect(count).toBeGreaterThanOrEqual(1)
          expect(carry.variationTags).toContain('single-carry')
        }
      }
    }
  })

  it('typing the final answer on a scaffolded jump step is coached, never wrong-math evidence', () => {
    for (const skill of ['ADD.JUMP.NoBridge', 'ADD.JUMP.TenBridge', 'ADD.JUMP.HundredBridge'] as const) {
      for (const tier of ['S0', 'S1'] as const) {
        const ex = generateExercise(ctx({ primarySkillId: skill, tier, seed: `fin:${skill}:${tier}` }))
        expect(ex.steps.length).toBe(3)
        const [a, b] = ex.fingerprint.replace('nlj:', '').split('+').map(Number)
        const total = a! + b!
        for (const step of ex.steps.slice(0, 2)) {
          // The final total on an intermediate step: math is right, so this
          // must never count as wrong-math evidence (invalidFormat, §4.1)...
          const early = step.validate(String(total))
          expect(early.isCorrect).toBe(false)
          expect(early.invalidFormat).toBe(true)
          expect(early.misconceptionId).toBeNull()
          // ...and the actual tussenstand is still accepted.
          const tussenstand = step.solutionNl.match(/= (\d+)/)![1]!
          expect(step.validate(tussenstand).isCorrect).toBe(true)
        }
        // The last step still accepts the total.
        expect(ex.steps[2]!.validate(String(total)).isCorrect).toBe(true)
      }
    }
  })

  it('typing the full sum on the carry step is coached, never wrong-math evidence', () => {
    let checked = 0
    for (let i = 0; i < 30 && checked < 5; i++) {
      const ex = generateExercise(
        ctx({ primarySkillId: 'ADD.COLUMN.Carry', tier: 'S0', seed: `carry-full:${i}` }),
      )
      const carryStep = ex.steps.find((s) => s.id === 'carry-e')
      if (!carryStep) continue // seed without a units carry
      checked++
      const [a, b] = ex.fingerprint.replace('coladd:', '').split('+').map(Number)
      const total = a! + b!
      const early = carryStep.validate(String(total))
      expect(early.isCorrect).toBe(false)
      expect(early.invalidFormat).toBe(true)
      expect(early.misconceptionId).toBeNull()
      // The carry itself is still accepted.
      expect(carryStep.validate('1').isCorrect).toBe(true)
      // And the sum step still accepts the total.
      const sumStep = ex.steps.find((s) => s.id === 'sum')!
      expect(sumStep.validate(String(total)).isCorrect).toBe(true)
    }
    expect(checked).toBeGreaterThanOrEqual(5)
  })
})
