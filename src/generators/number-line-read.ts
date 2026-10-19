/**
 * Reading scales: the tick interval of a number line or beker
 * (NUM.LINE.Interval, MEAS.SCALE.Interval) and locating numbers on a line to
 * 10 000 (NUM.LINE.Position: "Welk getal wijst de pijl aan?", "Welk getal
 * wijst de letter aan?", "Waar liggen de getallen ongeveer?").
 */
import type { DifficultyBand, GeneratedExercise } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { byBand, choiceStep, intStep, isSupported, isTestFormat, makeExercise } from './kit'

/** Lines as the book draws them: a range and a number of equal spaces. */
const LINES: Record<DifficultyBand, Array<[number, number, number]>> = {
  easier: [[0, 100, 10], [0, 1000, 10], [0, 500, 5]],
  standard: [[0, 1000, 4], [0, 1000, 5], [0, 5000, 5], [0, 10000, 10], [1000, 2000, 10]],
  harder: [[0, 1000, 8], [2000, 3000, 4], [0, 5000, 10], [0, 10000, 20], [500, 1000, 10]],
}

function interval(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const [from, to, spaces] = rng.pick(LINES[ctx.band])
  const step = (to - from) / spaces
  const steps = [
    ...(isSupported(ctx) ? [intStep({ id: 'spaces', prompt: `Hoeveel ruimtes zitten er tussen ${from} en ${to}?`, skill: ctx.primarySkillId, role: 'supporting' as const, answer: spaces, solution: `${spaces} ruimtes`, reveals: false })] : []),
    intStep({
      id: 'step', prompt: 'Hoeveel is de afstand tussen twee streepjes?', skill: ctx.primarySkillId, answer: step,
      solution: `(${to} − ${from}) : ${spaces} = ${step}`,
      wrong: (v) => (v === (to - from) / (spaces + 1) ? 'Tel de ruimtes tussen de streepjes, niet de streepjes zelf.' : null),
    }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'line-interval',
    instructionNl: isSupported(ctx) ? 'Tel de ruimtes tussen de streepjes. Verdeel de afstand eerlijk.' : BOOK.vulIn,
    steps,
    widget: { type: 'number-line', props: { range: [from, to], tickStep: step, labels: [from, to] } },
    supportingSkillIds: [],
    representation: 'pictorial',
    variationTags: [`spaces-${spaces}`],
    explanationNl: [`Van ${from} tot ${to} is ${to - from}. Dat is verdeeld in ${spaces} gelijke stukjes van ${step}.`],
    hintsNl: ['Hoe groot is het hele stuk van het eerste tot het laatste getal?', 'Tel de ruimtes, niet de streepjes.', 'Verdeel het hele stuk door het aantal ruimtes.'],
    fingerprint: `interval:${from}-${to}/${spaces}`,
  })
}

function position(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const [from, to, spaces] = rng.pick(LINES[ctx.band])
  const step = (to - from) / spaces
  const ticks = Array.from({ length: spaces - 1 }, (_, i) => from + (i + 1) * step)
  // Approximate placement: a number between ticks, choose its letter.
  if (ctx.band === 'harder' && !isSupported(ctx) && rng.bool(0.4)) {
    const target = rng.int(from + step, to - step)
    const letters = ['A', 'B', 'C', 'D']
    // Distractor spots far enough apart that "ongeveer" has one clear answer.
    const span = to - from
    const spots = [target]
    for (let i = 0; i < 300 && spots.length < 4; i++) {
      const v = rng.int(from + Math.round(span * 0.05), to - Math.round(span * 0.05))
      if (spots.every((w) => Math.abs(w - v) >= span / 7)) spots.push(v)
    }
    if (spots.length < 3) throw new Error('line-approximate: no spread')
    const sorted = [...spots].sort((a, b) => a - b)
    const answer = letters[sorted.indexOf(target)]!
    return makeExercise(ctx, rng, {
      archetypeId: 'line-approximate',
      instructionNl: BOOK.waarLiggen,
      steps: [choiceStep({ id: 'where', prompt: `Bij welke letter ligt ${target} ongeveer?`, skill: ctx.primarySkillId, options: letters.slice(0, sorted.length), answer, solution: `${target} ligt bij ${answer}` })],
      widget: { type: 'number-line', props: { range: [from, to], tickStep: step, labels: [from, to], arrows: sorted.map((v, i) => ({ value: v, label: letters[i] })) } },
      supportingSkillIds: [],
      representation: 'pictorial',
      variationTags: ['approximate'],
      explanationNl: [`${target} ligt tussen ${Math.floor(target / step) * step} en ${Math.ceil(target / step) * step}: bij ${answer}.`],
      hintsNl: ['Zoek eerst de streepjes waartussen het getal ligt.', 'Ligt het dichter bij het ene of het andere streepje?', 'Kies de letter die daar het dichtst bij staat.'],
      fingerprint: `approx:${from}-${to}:${target}`,
    })
  }
  // Test format: several lettered arrows on one line, as in "Schat het getal" (lesson 1).
  const count = isTestFormat(ctx) ? Math.min(3, ticks.length) : 1
  const chosen = rng.shuffle(ticks).slice(0, count).sort((a, b) => a - b)
  const letters = ['A', 'B', 'C']
  const steps = chosen.map((value, i) =>
    intStep({
      id: `arrow-${i}`, prompt: count > 1 ? `${letters[i]} =` : 'Welk getal wijst de pijl aan?', skill: ctx.primarySkillId, answer: value,
      solution: `${from} + ${(value - from) / step} × ${step} = ${value}`,
      wrong: (v) => (v === from + (value - from) / step ? `Eén streepje is niet 1, maar ${step}.` : null),
    }))
  return makeExercise(ctx, rng, {
    archetypeId: 'line-position',
    instructionNl: count > 1 ? BOOK.welkGetalLetter : isSupported(ctx) ? `Eén streepje is ${step}. Tel de sprongen vanaf ${from}.` : BOOK.welkGetalPijl,
    steps,
    widget: { type: 'number-line', props: { range: [from, to], tickStep: step, labels: isSupported(ctx) ? [from, from + step, to] : [from, to], arrows: chosen.map((v, i) => ({ value: v, label: count > 1 ? letters[i] : '↓' })) } },
    supportingSkillIds: ['NUM.LINE.Interval'],
    representation: 'pictorial',
    variationTags: [`scale-${step}`],
    explanationNl: [`Eén streepje is ${step}. ${chosen.map((v) => `${v} ligt ${(v - from) / step} streepjes na ${from}`).join('; ')}.`],
    hintsNl: ['Hoeveel is één streepje? Kijk naar de getallen die er staan.', `Tel vanaf ${from} met sprongen van ${step}.`, 'Controleer: komt het laatste getal goed uit?'],
    fingerprint: `position:${from}-${to}:${chosen.join(',')}`,
  })
}

function scaleInterval(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const [max, spaces] = rng.pick(byBand(ctx.band, {
    easier: [[100, 10], [500, 5], [1000, 10]],
    standard: [[500, 10], [1000, 4], [250, 5]],
    harder: [[1000, 8], [500, 20], [2000, 8]],
  }) as Array<[number, number]>)
  const step = max / spaces
  return makeExercise(ctx, rng, {
    archetypeId: 'scale-interval',
    instructionNl: isSupported(ctx) ? 'Bij 0 en bij het bovenste streepje staat een getal. Verdeel eerlijk over de ruimtes.' : BOOK.vulIn,
    steps: [intStep({
      id: 'step', prompt: 'Eén streepje op de maatbeker is … mL', skill: ctx.primarySkillId, answer: step, unit: 'mL',
      solution: `${max} mL : ${spaces} = ${step} mL`,
      wrong: (v) => (v === max / (spaces + 1) ? 'Tel de ruimtes tussen de streepjes, niet de streepjes.' : null),
    })],
    widget: { type: 'beaker', props: { max, tickStep: step, labels: [0, max], level: null, unit: 'mL' } },
    supportingSkillIds: ['NUM.LINE.Interval'],
    representation: 'pictorial',
    variationTags: [`spaces-${spaces}`],
    explanationNl: [`${max} mL verdeeld over ${spaces} ruimtes: elk streepje is ${step} mL.`],
    hintsNl: ['Welk getal staat bovenaan?', 'Tel de ruimtes van 0 tot boven.', 'Deel het getal bovenaan door het aantal ruimtes.'],
    fingerprint: `scale:${max}/${spaces}`,
  })
}

export function generateNumberLineRead(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  switch (ctx.primarySkillId) {
    case 'NUM.LINE.Interval': return interval(ctx, rng)
    case 'NUM.LINE.Position': return position(ctx, rng)
    case 'MEAS.SCALE.Interval': return scaleInterval(ctx, rng)
    default: throw new Error(`number-line-read: unsupported skill ${ctx.primarySkillId}`)
  }
}

export const NUMBER_LINE_READ_SKILLS = ['NUM.LINE.Interval', 'NUM.LINE.Position', 'MEAS.SCALE.Interval']
