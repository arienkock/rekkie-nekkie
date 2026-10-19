/**
 * Rounding (blok 2.3 lesson 11 and Test jezelf items 2–3): to tens,
 * hundreds and thousands, the inverse "Welke getallen rond je af op 130?",
 * and whole euros (blok 2.2 lessons 6–7). Notation "118 ≈" as in the book.
 */
import type { GeneratedExercise } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { byBand, choiceStep, euro, intStep, isSupported, makeExercise, moneyStep, roundTo, shuffleOptions } from './kit'

const PLACE = { 'NUM.ROUND.Ten': 10, 'NUM.ROUND.Hundred': 100, 'NUM.ROUND.Thousand': 1000 } as const
const WORD = { 10: 'tientallen', 100: 'honderdtallen', 1000: 'duizendtallen' } as const
const LOOK_AT = { 10: 'de eenheden', 100: 'het tiental', 1000: 'het honderdtal' } as const
const INSTRUCTION = { 10: BOOK.rondAfTientallen, 100: BOOK.rondAfHonderdtallen, 1000: BOOK.rondAfDuizendtallen } as const

function pickNumber(ctx: GeneratorContext, rng: SeededRng, place: 10 | 100 | 1000, halfway: boolean): number {
  const [lo, hi] = place === 10
    ? byBand(ctx.band, { easier: [11, 99], standard: [101, 999], harder: [1001, 9999] })
    : place === 100
      ? byBand(ctx.band, { easier: [101, 999], standard: [101, 2999], harder: [1001, 9999] })
      : [1001, 9899]
  for (let i = 0; i < 200; i++) {
    const n = rng.int(lo, hi)
    if (n % place === 0) continue
    const digitBelow = Math.floor((n % place) / (place / 10))
    if (halfway !== (digitBelow === 5)) continue
    // Harder items cross the next place (497 → 500, 1953 → 2000) more often.
    if (ctx.band === 'harder' && rng.bool(0.5) && roundTo(n, place) % (place * 10) !== 0) continue
    return n
  }
  throw new Error('rounding: no number')
}

function roundNumber(ctx: GeneratorContext, rng: SeededRng, place: 10 | 100 | 1000): GeneratedExercise {
  const halfway = place !== 10 && ctx.band !== 'easier' && rng.bool(0.3)
  const n = pickNumber(ctx, rng, place, halfway || (place === 10 && rng.bool(0.15)))
  const lower = Math.floor(n / place) * place
  const upper = lower + place
  const answer = roundTo(n, place)
  const look = LOOK_AT[place]

  // The inverse question: which number rounds to this one?
  if (ctx.tier === 'S2' && ctx.band === 'harder' && rng.bool(0.4)) {
    const target = roundTo(n, place)
    const good = n
    const bad = [target - Math.round(place * 0.6), target + Math.round(place * 0.55), target + place - Math.round(place * 0.3)]
      .filter((v) => v > 0 && roundTo(v, place) !== target)
    return makeExercise(ctx, rng, {
      archetypeId: 'rounding-inverse',
      instructionNl: `Welk getal rond je af op ${target}? (${INSTRUCTION[place]})`,
      steps: [choiceStep({
        id: 'which', prompt: `Welk getal rond je af op ${target}?`, skill: ctx.primarySkillId,
        options: shuffleOptions(rng, String(good), bad.map(String)), answer: String(good),
        solution: `${good} ≈ ${target}`,
        wrong: (v) => `${v} ≈ ${roundTo(Number(v), place)}. Kijk naar ${look}.`,
      })],
      widget: null,
      supportingSkillIds: [],
      representation: 'symbolic',
      variationTags: ['which-rounds-to'],
      explanationNl: [`${good} ligt tussen ${lower} en ${upper} en het dichtst bij ${target}.`],
      hintsNl: [`Rond elk getal af op ${WORD[place]}.`, `Kijk naar ${look}.`, `Welk getal komt uit op ${target}?`],
      fingerprint: `roundinv:${place}:${good}`,
    })
  }

  const steps = [
    ...(isSupported(ctx) ? [choiceStep({
      id: 'between', prompt: `Tussen welke ${WORD[place]} ligt ${n}?`, skill: ctx.primarySkillId, role: 'supporting' as const,
      options: shuffleOptions(rng, `${lower} en ${upper}`, [`${lower - place} en ${lower}`, `${upper} en ${upper + place}`].filter((o) => !o.startsWith('-'))),
      answer: `${lower} en ${upper}`, solution: `${lower} < ${n} < ${upper}`, reveals: false,
    })] : []),
    intStep({
      id: 'round', prompt: `${n} ≈`, skill: ctx.primarySkillId, answer,
      solution: `${n} ≈ ${answer}`,
      wrong: (v) => {
        if (v === (answer === lower ? upper : lower)) return { feedbackNl: `Kijk naar ${look}: minder dan 5 naar beneden, 5 of meer naar boven.`, misconceptionId: 'MC.ROUND.Direction' }
        if (v === Math.floor(n / place) * place && answer !== v) return { feedbackNl: 'Afronden is niet hetzelfde als de laatste cijfers weghalen. Kijk welk getal het dichtst bij ligt.', misconceptionId: 'MC.ROUND.Truncate' }
        return `Tussen welke ${WORD[place]} ligt ${n}? Welke ligt het dichtst bij?`
      },
    }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'rounding',
    instructionNl: INSTRUCTION[place],
    steps,
    widget: isSupported(ctx) ? { type: 'number-line', props: { range: [lower, upper], tickStep: place / 10, labels: [lower, lower + place / 2, upper], arrows: [{ value: n, label: String(n) }] } } : null,
    supportingSkillIds: [],
    representation: isSupported(ctx) ? 'pictorial' : 'symbolic',
    variationTags: [halfway ? 'halfway' : 'clear', ...(answer % (place * 10) === 0 && answer !== lower ? ['crosses-next-place'] : [])],
    explanationNl: [`${n} ligt tussen ${lower} en ${upper}. Kijk naar ${look}: ${Math.floor((n % place) / (place / 10))}, dus ${n} ≈ ${answer}.`],
    hintsNl: [`Tussen welke twee ${WORD[place]} ligt ${n}?`, `Kijk naar ${look}.`, 'Minder dan 5: naar beneden. 5 of meer: naar boven.'],
    fingerprint: `round:${place}:${n}`,
  })
}

function roundEuro(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const euros = byBand(ctx.band, { easier: rng.int(1, 19), standard: rng.int(2, 99), harder: rng.int(10, 299) })
  const boundary = ctx.band !== 'easier' && rng.bool(0.25)
  const cents = boundary ? 50 : rng.pick([rng.int(1, 49), rng.int(51, 99), rng.int(1, 9) * 5 + 50, rng.int(1, 9) * 5])
  const amount = euros * 100 + cents
  const rounded = roundTo(amount, 100)
  const between = isSupported(ctx) || rng.bool(0.4)
  const steps = between
    ? [
        moneyStep({ id: 'low', prompt: `${euro(amount)} ligt tussen € … (laagste hele euro)`, skill: ctx.primarySkillId, cents: euros * 100, solution: euro(euros * 100), reveals: false }),
        moneyStep({ id: 'high', prompt: `… en € … (hoogste hele euro)`, skill: ctx.primarySkillId, cents: euros * 100 + 100, solution: euro(euros * 100 + 100) }),
        ...(isSupported(ctx) ? [moneyStep({
          id: 'round', prompt: `${euro(amount)} ≈`, skill: ctx.primarySkillId, cents: rounded, solution: `${euro(amount)} ≈ ${euro(rounded)}`,
          wrong: (v) => (v === (rounded === euros * 100 ? euros * 100 + 100 : euros * 100) ? 'Kijk naar de centen: minder dan 50 cent naar beneden, 50 cent of meer naar boven.' : null),
        })] : []),
      ]
    : [moneyStep({
        id: 'round', prompt: `${euro(amount)} ≈`, skill: ctx.primarySkillId, cents: rounded, solution: `${euro(amount)} ≈ ${euro(rounded)}`,
        wrong: (v) => (v === euros * 100 || v === euros * 100 + 100 ? 'Kijk naar de centen: minder dan 50 cent naar beneden, 50 cent of meer naar boven.' : null),
      })]
  return makeExercise(ctx, rng, {
    archetypeId: 'round-euro',
    instructionNl: between ? BOOK.tussenHeleEuros : BOOK.rondAfHeleEuros,
    steps,
    widget: isSupported(ctx) ? { type: 'number-line', props: { range: [euros * 100, euros * 100 + 100], tickStep: 10, labels: [euros * 100, euros * 100 + 50, euros * 100 + 100], arrows: [{ value: amount, label: euro(amount) }], money: true } } : null,
    supportingSkillIds: [],
    representation: isSupported(ctx) ? 'pictorial' : 'symbolic',
    variationTags: [between ? 'between' : 'round', ...(cents === 50 ? ['fifty-cent-boundary'] : [])],
    explanationNl: [`${euro(amount)} ligt tussen ${euro(euros * 100)} en ${euro(euros * 100 + 100)}. ${cents} cent is ${cents < 50 ? 'minder dan' : '50 cent of meer dan'} 50 cent, dus ${euro(amount)} ≈ ${euro(rounded)}.`],
    hintsNl: ['Voor de komma staan de hele euro’s.', 'Kijk naar de centen achter de komma.', 'Minder dan 50 cent: naar beneden. 50 cent of meer: naar boven.'],
    fingerprint: `roundeur:${amount}:${between ? 'b' : 'r'}`,
  })
}

export function generateRounding(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  if (ctx.primarySkillId === 'MONEY.ROUND.WholeEuro') return roundEuro(ctx, rng)
  const place = PLACE[ctx.primarySkillId as keyof typeof PLACE]
  if (!place) throw new Error(`rounding: unsupported skill ${ctx.primarySkillId}`)
  return roundNumber(ctx, rng, place)
}

export const ROUNDING_SKILLS = ['NUM.ROUND.Ten', 'NUM.ROUND.Hundred', 'NUM.ROUND.Thousand', 'MONEY.ROUND.WholeEuro']
