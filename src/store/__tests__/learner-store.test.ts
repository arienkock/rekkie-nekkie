import { describe, expect, it, vi } from 'vitest'
import { MemoryDriver } from '../../storage/persistence'
import * as rngModule from '../../engine/rng'
import { LearnerStore, SESSION_TARGET_ITEMS } from '../learner-store'
import type { ExerciseSessionState, GeneratedExercise, GeneratedStep } from '../../domain/types'
import { generateTestBlockFor } from '../../generators'

const DEFAULT_TABLES_FOR_TEST = [6, 7, 8, 9]

/** Every step carries its canonical answer. */
function solveAnswer(_exercise: GeneratedExercise, step: GeneratedStep): string | number | Record<string, string | number> {
  return step.expected
}

/** Answer everything correctly: step by step, or a test-format block at once. */
function solveAll(store: LearnerStore, session: ExerciseSessionState): void {
  if (session.exercise.format === 'block') {
    const check = store.submitBlock(Object.fromEntries(session.exercise.steps.map((s) => [s.id, s.expected])))
    expect(check.invalid).toEqual([])
    expect(Object.values(check.results).every((r) => r.isCorrect)).toBe(true)
    return
  }
  for (const step of session.exercise.steps) {
    const validation = store.submitStepAnswer(step.id, solveAnswer(session.exercise, step))
    expect(validation.isCorrect).toBe(true)
  }
}

describe('LearnerStore end-to-end learning loop', () => {
  it('restores saved progress instead of resetting to novice defaults', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('noor', driver)
    store.snapshot.preferences.nickname = 'Noor'
    store.persist()

    const reloaded = new LearnerStore('noor', driver)
    expect(reloaded.snapshot.preferences.nickname).toBe('Noor')
    expect(reloaded.snapshot.revision).toBe(store.snapshot.revision)
  })

  it('runs a full session: select → answer → evidence → persistence', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('sam', driver)

    const session = store.startSession()
    expect(session).not.toBeNull()
    expect(session!.phase).toBe('working')
    const skillId = session!.exercise.primarySkillId

    solveAll(store, session!)

    const before = store.skillState(skillId)
    const opportunitiesBefore = before.exposureCount
    store.completeExercise()
    const after = store.skillState(skillId)
    expect(after.exposureCount).toBe(opportunitiesBefore + 1)
    expect(after.lastPracticedAt).not.toBeNull()
    expect(store.snapshot.observations.length).toBeGreaterThan(0)

    // Progress was persisted (journal cleared after checkpoint commit).
    const reloaded = new LearnerStore('sam', driver)
    expect(reloaded.skillState(skillId).exposureCount).toBe(after.exposureCount)
  })

  it('never generates a negative mastery update for skipping (deferred)', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('mila', driver)
    store.startSession()
    const skillId = store.currentSession!.exercise.primarySkillId
    const pBefore = store.skillState(skillId).masteryProbability
    store.deferExercise()
    const pAfter = store.skillState(skillId).masteryProbability
    expect(pAfter).toBe(pBefore)
    expect(store.currentSession).toBeNull()
  })

  it('serves up to the session target and then stops', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('piet', driver)
    let served = 0
    for (let i = 0; i < SESSION_TARGET_ITEMS + 3; i++) {
      const session = i === 0 ? store.startSession() : store.nextExercise()
      if (!session) break
      served += 1
      // Answer wrong on purpose — must still progress without blocking.
      for (const step of session.exercise.steps) {
        store.submitStepAnswer(step.id, -999)
      }
      store.completeExercise()
    }
    expect(served).toBe(SESSION_TARGET_ITEMS)
    expect(store.sessionItemsDone).toBe(SESSION_TARGET_ITEMS)
  })

  it('hint level ≥ 4 (reveal) removes evidence eligibility entirely', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('femke', driver)
    const session = store.startSession()!
    store.requestHint()
    store.requestHint()
    store.requestHint()
    store.requestHint()
    const skillId = session.exercise.primarySkillId
    const before = store.skillState(skillId)
    for (const step of session.exercise.steps) {
      store.submitStepAnswer(step.id, solveAnswer(session.exercise, step))
    }
    store.completeExercise()
    const after = store.skillState(skillId)
    // Revealed/copied answers never count as independent or scaffolded evidence.
    expect(after.independentOpportunityCount).toBe(before.independentOpportunityCount)
    expect(after.scaffoldedSuccessCount).toBe(before.scaffoldedSuccessCount)
  })

  it('export/import preserves achievements', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('export', driver)
    store.snapshot.skills['PV.DHTE.Decompose']!.highestDemonstratedLevel = 3
    store.persist()
    const json = store.exportJson()

    const other = new LearnerStore('import', new MemoryDriver())
    expect(other.importJson(json)).toBe(true)
    expect(other.skillState('PV.DHTE.Decompose').highestDemonstratedLevel).toBe(3)
  })

  it('review scheduling starts after the first qualifying INDEPENDENT success', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('review', driver)
    // Give every supported skill plausible prior competence (S2, p=.85).
    for (const id of Object.keys(store.snapshot.skills)) {
      const s = store.snapshot.skills[id]!
      s.scaffolding.currentTier = 'S2'
      s.masteryProbability = 0.85
      s.exposureCount = 5
      s.currentVerifiedLevel = 1
    }
    const session = store.startSession()!
    const skillId = session.exercise.primarySkillId
    expect(session.currentScaffold).toBe('S2')
    solveAll(store, session)
    store.completeExercise()
    expect(store.skillState(skillId).memory.reviewDueAt).not.toBeNull()
  })

  it('follows a revealed answer with one fresh item of the same skill and tier ("Nu jij")', () => {
    const store = new LearnerStore('sibling', new MemoryDriver())
    const first = store.startSession()!
    for (let i = 0; i < 4; i++) store.requestHint()
    for (const step of first.exercise.steps) store.submitStepAnswer(step.id, solveAnswer(first.exercise, step))
    store.completeExercise()

    const sibling = store.nextExercise()!
    expect(sibling.isSibling).toBe(true)
    expect(sibling.exercise.primarySkillId).toBe(first.exercise.primarySkillId)
    expect(sibling.currentScaffold).toBe(first.currentScaffold)
    expect(sibling.exercise.fingerprint).not.toBe(first.exercise.fingerprint)

    // Revealing the sibling too does not chain another sibling.
    for (let i = 0; i < 4; i++) store.requestHint()
    for (const step of sibling.exercise.steps) store.submitStepAnswer(step.id, solveAnswer(sibling.exercise, step))
    store.completeExercise()
    expect(store.nextExercise()!.isSibling).toBe(false)
  })

  it('supported S0 work refreshes memory but does not start a review schedule', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('supported', driver)
    const session = store.startSession()!
    expect(session.currentScaffold).toBe('S0') // fresh profile
    const skillId = session.exercise.primarySkillId
    solveAll(store, session)
    store.completeExercise()
    const state = store.skillState(skillId)
    expect(state.memory.lastMemoryRefreshAt).not.toBeNull()
    expect(state.memory.reviewDueAt).toBeNull()
  })
})

describe('LearnerStore regression: adaptive engine health', () => {
  /** Play a number of sessions where every step is answered correctly. */
  function playAllCorrect(store: LearnerStore, sessions: number): Map<string, number> {
    const exposures = new Map<string, number>()
    for (let i = 0; i < sessions; i++) {
      let s = store.startSession()
      while (s) {
        exposures.set(s.exercise.primarySkillId, (exposures.get(s.exercise.primarySkillId) ?? 0) + 1)
        solveAll(store, s)
        store.completeExercise()
        s = store.nextExercise()
      }
    }
    return exposures
  }

  it('fades the support tier through scaffolded successes so independent evidence accrues', () => {
    const store = new LearnerStore('fade', new MemoryDriver())
    let reachedIndependent = false
    outer: for (let session = 0; session < 15 && !reachedIndependent; session++) {
      let s = store.startSession()
      while (s) {
        if (s.currentScaffold === 'S2' || s.currentScaffold === 'S3') {
          reachedIndependent = true
          break outer
        }
        solveAll(store, s)
        store.completeExercise()
        s = store.nextExercise()
      }
    }
    expect(reachedIndependent).toBe(true)
  })

  it('spreads practice across skills (no starvation, no monopoly)', () => {
    const store = new LearnerStore('spread', new MemoryDriver())
    const exposures = playAllCorrect(store, 12) // 96 items
    const max = Math.max(...exposures.values())
    expect(exposures.size).toBeGreaterThanOrEqual(15)
    expect(max / 96).toBeLessThan(0.35)
  })

  it('blank and unparseable input stays in working without becoming wrong-math evidence', () => {
    const store = new LearnerStore('format', new MemoryDriver())
    const session = store.startSession()!
    const step = session.exercise.steps[0]!
    const before = store.skillState(session.exercise.primarySkillId)

    const blank = store.submitStepAnswer(step.id, '')
    expect(blank.invalidFormat).toBe(true)
    const garbage = store.submitStepAnswer(step.id, 'helemaal geen getal')
    expect(garbage.invalidFormat).toBe(true)

    const response = session.steps.find((r) => r.stepId === step.id)!
    expect(response.attemptCount).toBe(0)
    expect(response.firstAnswer).toBeNull()
    expect(response.outcome).toBe('unknown')

    // An item with no committed responses is unassessed: no evidence.
    store.completeExercise()
    const after = store.skillState(session.exercise.primarySkillId)
    expect(after.exposureCount).toBe(before.exposureCount)
    expect(after.meaningfulOpportunityCount).toBe(before.meaningfulOpportunityCount)
  })

  it('deferring remembers the fingerprint so a skipped item is not immediately re-served', () => {
    const store = new LearnerStore('defer-fp', new MemoryDriver())
    const session = store.startSession()!
    const fp = session.exercise.fingerprint
    store.deferExercise()
    expect(store.snapshot.recentExerciseFingerprints).toContain(fp)
    const next = store.nextExercise()
    if (next) expect(next.exercise.fingerprint).not.toBe(fp)
  })

  it('counts completed exercises (defers excluded) for the home stat', () => {
    const store = new LearnerStore('counter', new MemoryDriver())
    expect(store.snapshot.totalExercisesCompleted).toBe(0)
    const session = store.startSession()!
    solveAll(store, session)
    store.completeExercise()
    store.nextExercise() // serve item 2
    store.deferExercise()
    expect(store.snapshot.totalExercisesCompleted).toBe(1)
  })

  it('recomputes freshness on load: due reviews are visible without new practice', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('fresh', driver)
    const s = store.snapshot.skills['PV.DHTE.Decompose']!
    s.currentVerifiedLevel = 1
    s.memory.reviewDueAt = new Date(Date.now() - 86_400_000).toISOString()
    store.persist()

    const reloaded = new LearnerStore('fresh', driver)
    expect(reloaded.skillState('PV.DHTE.Decompose').memory.freshness).toBe('due')
  })

  it('rejects imports whose checksum does not match the payload', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('checksum', driver)
    store.snapshot.preferences.nickname = 'Origineel'
    store.persist()

    // Tamper with the stored snapshot body, keeping the old checksum.
    const raw = driver.get('rn:profile:checksum:snapshot:a') ?? driver.get('rn:profile:checksum:snapshot:b')!
    const tampered = JSON.parse(raw) as { data: { nickname: string } }
    tampered.data.nickname = 'Gemanipuleerd'
    expect(store.importJson(JSON.stringify(tampered))).toBe(false)
    expect(store.snapshot.preferences.nickname).toBe('Origineel')
  })

  it('a lapse (two independent failures in the latest three) lowers the verified level, never the high', () => {
    const store = new LearnerStore('lapse', new MemoryDriver())
    store.startSession()
    const session = store.currentSession!
    const skillId = session.exercise.primarySkillId
    const state = store.snapshot.skills[skillId]!
    state.currentVerifiedLevel = 2
    state.highestDemonstratedLevel = 2
    // Pre-seed the gate window so the new incorrect entry completes a lapse.
    state.independentGateWindow = [
      { exerciseId: 'e1', visitId: 'v1', at: new Date().toISOString(), correct: false, transfer: false, inverse: false, efficientStrategy: false, representation: 'symbolic', variationTags: [] },
      { exerciseId: 'e2', visitId: 'v1', at: new Date().toISOString(), correct: false, transfer: false, inverse: false, efficientStrategy: false, representation: 'symbolic', variationTags: [] },
    ]
    // Answer the primary step incorrectly on an independent tier. The answer
    // has to be WRONG but PARSEABLE: unparseable input stays in `working` and
    // records no evidence at all, so a bare -999 silently passed this test
    // whenever the selector happened to pick a time, money or
    // quotient-remainder item (~35% of runs).
    session.currentScaffold = 'S2'
    for (const step of session.exercise.steps) {
      if (step.skillTarget.role === 'primary') {
        const validation = store.submitStepAnswer(step.id, wrongParseableAnswer(step))
        expect(validation.invalidFormat, `${session.exercise.primarySkillId}/${step.answerType.kind}`).toBeFalsy()
        expect(validation.isCorrect, `${session.exercise.primarySkillId}/${step.answerType.kind}`).toBe(false)
      }
    }
    store.completeExercise()
    const after = store.skillState(skillId)
    expect(after.currentVerifiedLevel).toBeLessThan(2)
    expect(after.highestDemonstratedLevel).toBe(2)
  })
})

/**
 * A wrong answer the step's parser accepts, for every answer kind in the
 * registry. Clock solutions are on the five-minute grid so 0:01 is never
 * right; change is always ≥ €1,20 so 0,01 is never right; DHTE numbers are
 * four digits so all-zero is never right.
 */
function wrongParseableAnswer(step: GeneratedStep): string | number | Record<string, string> {
  switch (step.answerType.kind) {
    case 'time':
      return '0:01'
    case 'money':
      return '0,01'
    case 'quotient-remainder':
      return { quotient: '-999', remainder: '-999' }
    case 'digits':
      return { D: '0', H: '0', T: '0', E: '0' }
    default:
      return -999
  }
}

describe('separate multiplication practice', () => {
  it('serves only the selected tables, persists their evidence, and keeps them out of curriculum sessions', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('tables', driver)
    let session = store.startSession('tables', [6, 7, 8, 9])!
    for (let i = 0; i < SESSION_TARGET_ITEMS; i++) {
      expect(['MUL.FACT.T6', 'MUL.FACT.T7', 'MUL.FACT.T8', 'MUL.FACT.T9']).toContain(session.exercise.primarySkillId)
      solveAll(store, session)
      store.completeExercise()
      session = store.nextExercise()!
    }
    expect(store.currentSession).toBeNull()
    const restored = new LearnerStore('tables', driver)
    expect(restored.snapshot.observations.length).toBe(SESSION_TARGET_ITEMS)
    expect(restored.snapshot.observations.every((o) => o.skillId.startsWith('MUL.FACT.T'))).toBe(true)
    session = restored.startSession()!
    expect(session.exercise.primarySkillId.startsWith('MUL.FACT.T')).toBe(false)
  })

  it('supports a single table and rejects an empty or invalid selection', () => {
    const store = new LearnerStore('one-table', new MemoryDriver())
    expect(store.startSession('tables', [])).toBeNull()
    expect(store.startSession('tables', [0, 11])).toBeNull()
    expect(store.startSession('tables', [9, 9, 11])!.exercise.primarySkillId).toBe('MUL.FACT.T9')
  })

  it('does not count requested visual help as independent recall', () => {
    const store = new LearnerStore('help', new MemoryDriver())
    const state = store.skillState('MUL.FACT.T7')
    state.exposureCount = 5
    state.masteryProbability = 0.85
    state.scaffolding.currentTier = 'S2'
    store.snapshot.skills[state.skillId] = state
    const session = store.startSession('tables', [7])!
    expect(session.currentScaffold).toBe('S2')
    store.requestHint()
    solveAll(store, session)
    store.completeExercise()
    const observation = store.snapshot.observations.at(-1)!
    expect(observation.eligibility.independent).toBe(false)
    expect(observation.eligibility.weight).toBeLessThan(1)
  })
})


it('can advance from a fresh table to independent competency and transfer across visits', () => {
  vi.useFakeTimers()
  let seed = 0
  const seeds = vi.spyOn(rngModule, 'randomSeed').mockImplementation(() => `progression:${seed++}`)
  try {
    const driver = new MemoryDriver()
    let highest = 0
    for (let day = 0; day < 40 && highest < 3; day++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 0, day + 1, 10)))
      const store = new LearnerStore('progression', driver)
      store.startSession('tables', [7])
      while (store.currentSession) {
        solveAll(store, store.currentSession)
        store.completeExercise()
        highest = Math.max(highest, store.skillState('MUL.FACT.T7').highestDemonstratedLevel)
        store.nextExercise()
      }
    }
    expect(highest).toBeGreaterThanOrEqual(3)
  } finally {
    seeds.mockRestore()
    vi.useRealTimers()
  }
})

describe('LearnerStore: test format, lessons and practice tests', () => {
  /** Put a skill at toetsvorm (S3) so the next item for it is a block. */
  function atToetsvorm(store: LearnerStore, skillId: string) {
    const state = store.skillState(skillId)
    state.scaffolding.currentTier = 'S3'
    state.exposureCount = 6
    state.masteryProbability = 0.8
    store.snapshot.skills[skillId] = state
  }

  it('serves S3 as a test-format block: no hints, checked at once, blanks count as wrong', () => {
    const store = new LearnerStore('blok', new MemoryDriver())
    atToetsvorm(store, 'NUM.ROUND.Ten')
    const session = store.startSession('lesson', DEFAULT_TABLES_FOR_TEST, { lessonId: '2-11' })!
    // The lesson has four skills; find the block.
    let s: ExerciseSessionState | null = session
    while (s && s.exercise.primarySkillId !== 'NUM.ROUND.Ten') {
      solveAll(store, s)
      store.completeExercise()
      s = store.nextExercise()
    }
    expect(s).not.toBeNull()
    expect(s!.exercise.format).toBe('block')
    expect(store.requestHint()).toMatch(/geen hulp/)
    expect(s!.hintLevel).toBe(0)
    const answers = Object.fromEntries(s!.exercise.steps.map((st) => [st.id, st.expected]))
    // Leave the first one blank: first a warning that records nothing…
    answers[s!.exercise.steps[0]!.id] = ''
    const warned = store.submitBlock(answers)
    expect(warned.blank).toEqual([s!.exercise.steps[0]!.id])
    expect(s!.phase).toBe('working')
    expect(s!.steps.every((r) => r.attemptCount === 0)).toBe(true)
    // …then, checked anyway: wrong, but the rest still passes (5 of 6).
    const check = store.submitBlock(answers, { confirmBlank: true })
    expect(check.invalid).toEqual([])
    expect(check.results[s!.exercise.steps[0]!.id]!.isCorrect).toBe(false)
    store.completeExercise()
    const state = store.skillState('NUM.ROUND.Ten')
    expect(state.coverage.find((c) => c.key === 'variation:toetsvorm')?.independentSuccesses).toBe(1)
  })

  it('unreadable notation in a block records nothing until it is fixed', () => {
    const store = new LearnerStore('blok-invalid', new MemoryDriver())
    atToetsvorm(store, 'MONEY.CALC.Add')
    const session = store.startSession('lesson', DEFAULT_TABLES_FOR_TEST, { lessonId: '2-8' })!
    let s: ExerciseSessionState | null = session
    while (s && s.exercise.primarySkillId !== 'MONEY.CALC.Add') {
      solveAll(store, s)
      store.completeExercise()
      s = store.nextExercise()
    }
    const answers = Object.fromEntries(s!.exercise.steps.map((st) => [st.id, st.expected]))
    answers[s!.exercise.steps[0]!.id] = 'veel'
    const check = store.submitBlock(answers)
    expect(check.invalid).toEqual([s!.exercise.steps[0]!.id])
    expect(s!.steps.every((r) => r.attemptCount === 0)).toBe(true)
  })

  it('a failed block goes back to practising on her own (S2)', () => {
    const store = new LearnerStore('blok-fail', new MemoryDriver())
    atToetsvorm(store, 'NUM.COMPARE.Symbols')
    let s: ExerciseSessionState | null = store.startSession('lesson', DEFAULT_TABLES_FOR_TEST, { lessonId: '2-11' })
    while (s && s.exercise.primarySkillId !== 'NUM.COMPARE.Symbols') {
      solveAll(store, s)
      store.completeExercise()
      s = store.nextExercise()
    }
    store.submitBlock({}, { confirmBlank: true })
    store.completeExercise()
    expect(store.skillState('NUM.COMPARE.Symbols').scaffolding.currentTier).toBe('S2')
  })

  it('a lesson session only serves that lesson’s skills', () => {
    const store = new LearnerStore('les', new MemoryDriver())
    let s = store.startSession('lesson', DEFAULT_TABLES_FOR_TEST, { lessonId: '2-6' })
    const lessonSkills = new Set(['MONEY.VALUE.Denomination', 'MONEY.NOTATION.EuroCent', 'MONEY.PAY.Exact', 'MONEY.ROUND.WholeEuro'])
    let served = 0
    while (s) {
      expect(lessonSkills.has(s.exercise.primarySkillId), s.exercise.primarySkillId).toBe(true)
      solveAll(store, s)
      store.completeExercise()
      served++
      s = store.nextExercise()
    }
    expect(served).toBe(SESSION_TARGET_ITEMS)
  })

  it('a general session follows the current blok’s lessons, starting at the first unfinished one', () => {
    const store = new LearnerStore('path', new MemoryDriver())
    const s = store.startSession()!
    const window = new Set(['NUM.LINE.Position', 'PV.DHTE.Decompose', 'MUL.SCALE.OneFactor', 'MUL.SCALE.TwoFactors', 'MUL.ESTIMATE.Friendly', 'PV.SCALE.TenHundred', 'MUL.SPLIT.Distribute'])
    expect(window.has(s.exercise.primarySkillId), s.exercise.primarySkillId).toBe(true)
  })

  it('runs a proeftoets in the book’s order and turns failed groups into maatwerk', () => {
    const store = new LearnerStore('proef', new MemoryDriver())
    let s = store.startSession('proeftoets', DEFAULT_TABLES_FOR_TEST, { proeftoetsId: 'proeftoets-blok-2' })
    expect(store.sessionTargetItems).toBe(13)
    const order: string[] = []
    while (s) {
      order.push(s.exercise.primarySkillId)
      expect(s.exercise.format).toBe('block')
      // Get the rounding groups wrong, everything else right.
      const wrong = s.exercise.primarySkillId.startsWith('NUM.ROUND')
      store.submitBlock(wrong ? {} : Object.fromEntries(s.exercise.steps.map((st) => [st.id, st.expected])), { confirmBlank: true })
      store.completeExercise()
      s = store.nextExercise()
    }
    expect(order[0]).toBe('PV.DHTE.Decompose')
    expect(order[1]).toBe('NUM.ROUND.Ten')
    expect(store.proeftoetsResults.filter((r) => !r.passed).map((r) => r.skillId)).toEqual(['NUM.ROUND.Ten', 'NUM.ROUND.Hundred'])
    expect(store.snapshot.focusSkills).toEqual(['NUM.ROUND.Ten', 'NUM.ROUND.Hundred'])
    // All wrong: more than half wrong → back to the bridge (S1).
    expect(store.skillState('NUM.ROUND.Ten').scaffolding.currentTier).toBe('S1')
    // Maatwerk is favoured in the next ordinary session.
    const next = store.startSession()!
    expect(['NUM.ROUND.Ten', 'NUM.ROUND.Hundred']).toContain(next.exercise.primarySkillId)
  })

  it('a proeftoets stopped halfway keeps its checked page and maatwerk, and continues where it stopped', () => {
    const store = new LearnerStore('proef-stop', new MemoryDriver())
    let s = store.startSession('proeftoets', DEFAULT_TABLES_FOR_TEST, { proeftoetsId: 'proeftoets-blok-2' })!
    // Group 1 right, group 2 (rounding) wrong and checked, then Stoppen before "Volgende".
    solveAll(store, s)
    store.completeExercise()
    s = store.nextExercise()!
    expect(s.exercise.primarySkillId).toBe('NUM.ROUND.Ten')
    store.submitBlock({}, { confirmBlank: true })
    store.endSession()
    expect(store.currentSession).toBeNull()
    expect(store.proeftoetsResults.map((r) => r.passed)).toEqual([true, false])
    expect(store.snapshot.focusSkills).toEqual(['NUM.ROUND.Ten'])
    expect(store.proeftoetsPaused).toBe(true)
    // "Ga verder" continues with group 3.
    expect(store.nextExercise()!.exercise.primarySkillId).toBe('NUM.ROUND.Hundred')
    expect(store.proeftoetsPaused).toBe(false)
  })

  it('a test page with a two-part item shows its picture once', () => {
    const store = new LearnerStore('pic', new MemoryDriver())
    atToetsvorm(store, 'MONEY.CONTEXT.Budget')
    const block = generateTestBlockFor({ seed: 'pic', tier: 'S3', band: 'standard', purpose: 'growth', primarySkillId: 'MONEY.CONTEXT.Budget' })
    const pictures = block.steps.map((st) => (st.widget ? JSON.stringify(st.widget) : null))
    for (let i = 1; i < pictures.length; i++) {
      if (pictures[i]) expect(pictures[i]).not.toBe(pictures[i - 1])
    }
  })
})
