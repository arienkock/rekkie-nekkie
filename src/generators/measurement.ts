/**
 * Meten: choosing a sensible unit, the unit anchors (1 m = 100 cm, a halve
 * kilo = 500 g …), comparing differently written quantities, reading a
 * maatbeker and a weegschaal, and measurement stories with a limit.
 * Ratios come from domain/units.ts (m↔km and g↔kg are 1000, never "add a zero").
 */
import type { GeneratedExercise } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { CAPACITY_RATIO, LENGTH_RATIO, MASS_RATIO } from '../domain/units'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { byBand, choiceStep, intStep, isSupported, makeExercise, shuffleOptions } from './kit'

const OBJECTS = {
  length: [
    { what: 'Een deur is ongeveer 2', unit: 'm', wrong: ['cm', 'km', 'mm'] },
    { what: 'Een potlood is ongeveer 15', unit: 'cm', wrong: ['m', 'mm', 'km'] },
    { what: 'Een mier is ongeveer 4', unit: 'mm', wrong: ['cm', 'm', 'dm'] },
    { what: 'Van Utrecht naar Amsterdam is ongeveer 40', unit: 'km', wrong: ['m', 'cm', 'mm'] },
  ],
  mass: [
    { what: 'Een appel weegt ongeveer 225', unit: 'g', wrong: ['kg', 'mg'] },
    { what: 'Een fiets weegt ongeveer 15', unit: 'kg', wrong: ['g', 'mg'] },
    { what: 'Een pil weegt ongeveer 500', unit: 'mg', wrong: ['g', 'kg'] },
  ],
  capacity: [
    { what: 'In een emmer past ongeveer 10', unit: 'L', wrong: ['mL', 'cL', 'dL'] },
    { what: 'In een theelepel past ongeveer 5', unit: 'mL', wrong: ['L', 'dL', 'cL'] },
    { what: 'In een glas past ongeveer 2', unit: 'dL', wrong: ['L', 'mL', 'cL'] },
  ],
} as const

function unitSelect(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const family = rng.pick(['length', 'mass', 'capacity'] as const)
  const o = rng.pick(OBJECTS[family] as ReadonlyArray<{ what: string; unit: string; wrong: readonly string[] }>)
  return makeExercise(ctx, rng, {
    archetypeId: 'unit-select',
    instructionNl: 'Welke maat past erbij?',
    steps: [choiceStep({
      id: 'unit', prompt: `${o.what} …`, skill: ctx.primarySkillId, options: shuffleOptions(rng, o.unit, [...o.wrong]), answer: o.unit,
      solution: `${o.what} ${o.unit}.`, wrong: (v) => `Stel je ${o.what.split(' ').slice(-1)[0]} ${v} voor. Kan dat?`,
    })],
    widget: null,
    supportingSkillIds: [],
    representation: 'story',
    variationTags: [family],
    explanationNl: [`${o.what} ${o.unit}.`],
    hintsNl: ['Denk aan iets dat je kent: 1 cm is zo breed als je pink.', '1 meter is een grote stap. 1 kilometer loop je in ongeveer 12 minuten.', 'Welke maat maakt het getal logisch?'],
    fingerprint: `unitsel:${o.what}`,
  })
}

const ANCHORS: Record<string, ReadonlyArray<{ prompt: string; answer: number; tag: string }>> = {
  'MEAS.LENGTH.Anchor': [
    { prompt: '1 m = … cm', answer: 100, tag: 'm-cm' },
    { prompt: '1 km = … m', answer: 1000, tag: 'm-km-1000' },
    { prompt: '1 dm = … cm', answer: 10, tag: 'dm-cm' },
    { prompt: '1 cm = … mm', answer: 10, tag: 'cm-mm' },
    { prompt: '1 m = … dm', answer: 10, tag: 'm-dm' },
    { prompt: '1 m = … mm', answer: 1000, tag: 'm-mm' },
  ],
  'MEAS.MASS.Anchor': [
    { prompt: '1 kg = … g', answer: 1000, tag: 'kg-g' },
    { prompt: 'een halve kilo = … g', answer: 500, tag: 'half-kg' },
    { prompt: 'een kwart kilo = … g', answer: 250, tag: 'quarter-kg' },
    { prompt: '1 g = … mg', answer: 1000, tag: 'g-mg' },
    { prompt: 'een ons = … g', answer: 100, tag: 'ons' },
  ],
  'MEAS.CAPACITY.Anchor': [
    { prompt: '1 L = … mL', answer: 1000, tag: 'l-ml' },
    { prompt: 'een halve liter = … mL', answer: 500, tag: 'half-liter' },
    { prompt: 'een kwart liter = … mL', answer: 250, tag: 'quarter-liter' },
    { prompt: '1 L = … dL', answer: 10, tag: 'l-dl' },
    { prompt: '1 dL = … cL', answer: 10, tag: 'dl-cl' },
    { prompt: '1 L = … cL', answer: 100, tag: 'l-cl' },
  ],
}

function anchor(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const a = rng.pick(ANCHORS[ctx.primarySkillId]!)
  // Higher bands scale the anchor: 3 km = … m, 4 halve liters …
  const k = ctx.band === 'easier' || a.prompt.startsWith('een') ? 1 : rng.int(2, ctx.band === 'harder' ? 9 : 5)
  const prompt = k === 1 ? a.prompt : a.prompt.replace(/^1 /, `${k} `)
  const answer = a.answer * k
  return makeExercise(ctx, rng, {
    archetypeId: 'unit-anchor',
    instructionNl: BOOK.vulIn,
    steps: [intStep({
      id: 'anchor', prompt, skill: ctx.primarySkillId, answer, solution: prompt.replace('…', String(answer)),
      wrong: (v) => (v * 10 === answer || v === answer * 10 ? 'Let op: niet elke stap is keer 10. Tussen km en m, en tussen kg en g, zit keer 1000.' : null),
    })],
    widget: null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: [a.tag],
    explanationNl: [prompt.replace('…', String(answer))],
    hintsNl: ['Denk aan het maatsysteem: welke maat is groter?', 'kilo betekent 1000, centi betekent honderdste, milli betekent duizendste.', `Reken dan ${k > 1 ? `${k} keer ` : ''}de vaste maat.`],
    fingerprint: `anchor:${prompt}`,
  })
}

/** "Vul < of > in." 1500 mL … 2 L */
function compareNormalize(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const family = rng.pick(['length', 'mass', 'capacity'] as const)
  const [big, small, ratio] =
    family === 'length' ? rng.pick([['m', 'cm', LENGTH_RATIO.m / LENGTH_RATIO.cm], ['km', 'm', LENGTH_RATIO.km / LENGTH_RATIO.m]] as const)
    : family === 'mass' ? (['kg', 'g', MASS_RATIO.kg / MASS_RATIO.g] as const)
    : (['L', 'mL', CAPACITY_RATIO.L / CAPACITY_RATIO.mL] as const)
  const bigValue = rng.int(1, 9)
  let smallValue = 0
  do {
    smallValue = bigValue * ratio + rng.pick([-1, 1]) * rng.int(1, 9) * (ratio / 10)
  } while (smallValue <= 0)
  const symbol = smallValue < bigValue * ratio ? '<' : '>'
  const first = rng.bool()
  const left = first ? `${smallValue} ${small}` : `${bigValue} ${big}`
  const right = first ? `${bigValue} ${big}` : `${smallValue} ${small}`
  const answer = first ? symbol : symbol === '<' ? '>' : '<'
  const steps = [
    ...(isSupported(ctx) ? [intStep({ id: 'same-unit', prompt: `${bigValue} ${big} = … ${small}`, skill: ctx.primarySkillId, role: 'supporting' as const, answer: bigValue * ratio, solution: `${bigValue} ${big} = ${bigValue * ratio} ${small}`, reveals: false })] : []),
    choiceStep({
      id: 'compare', prompt: `${left} … ${right}`, skill: ctx.primarySkillId, options: ['<', '>'], answer,
      solution: `${left} ${answer} ${right}, want ${bigValue} ${big} = ${bigValue * ratio} ${small}`,
      wrong: () => ({ feedbackNl: `Maak eerst dezelfde maat: ${bigValue} ${big} = ${bigValue * ratio} ${small}.`, misconceptionId: 'MC.MEAS.CompareDigits' }),
    }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'compare-normalize',
    instructionNl: isSupported(ctx) ? 'Maak eerst dezelfde maat, dan vergelijk je.' : BOOK.vulKleinerGroter,
    steps,
    widget: null,
    supportingSkillIds: [`MEAS.${family === 'length' ? 'LENGTH' : family === 'mass' ? 'MASS' : 'CAPACITY'}.Convert`],
    representation: 'symbolic',
    variationTags: [family],
    explanationNl: [`${bigValue} ${big} = ${bigValue * ratio} ${small}. ${left} ${answer} ${right}.`],
    hintsNl: ['De getallen hebben een andere maat. Vergelijk ze nog niet!', `Hoeveel ${small} is ${bigValue} ${big}?`, 'Vergelijk nu de getallen met dezelfde maat.'],
    fingerprint: `cmpmeas:${left}:${right}`,
  })
}

function readInstrument(ctx: GeneratorContext, rng: SeededRng, kind: 'beaker' | 'scale'): GeneratedExercise {
  const [max, step] = rng.pick(byBand(ctx.band, kind === 'beaker'
    ? { easier: [[1000, 100], [500, 100]], standard: [[1000, 50], [500, 50], [1000, 250]], harder: [[1000, 25], [2000, 100], [500, 25]] }
    : { easier: [[1000, 100], [500, 50]], standard: [[1000, 50], [2000, 100]], harder: [[1000, 25], [5000, 250], [2000, 50]] }) as Array<[number, number]>)
  const labelEvery = step * (max / step > 10 ? 4 : 2)
  const value = rng.int(1, max / step - 1) * step
  const unit = kind === 'beaker' ? 'mL' : 'g'
  return makeExercise(ctx, rng, {
    archetypeId: kind === 'beaker' ? 'beaker-read' : 'scale-read',
    instructionNl: isSupported(ctx) ? `Eén streepje is ${step} ${unit}. Tel vanaf het dichtstbijzijnde getal.` : BOOK.leesAf,
    steps: [intStep({
      id: 'read', prompt: kind === 'beaker' ? 'Hoeveel mL zit er in de maatbeker?' : 'Hoeveel gram wijst de weegschaal aan?', skill: ctx.primarySkillId,
      answer: value, unit, solution: `${value} ${unit}`,
      wrong: (v) => (v === value / step ? `Eén streepje is niet 1 ${unit}, maar ${step} ${unit}.` : null),
    })],
    widget: kind === 'beaker'
      ? { type: 'beaker', props: { max, tickStep: step, labelEvery, level: value, unit } }
      : { type: 'scale-dial', props: { max, tickStep: step, labelEvery, value, unit } },
    supportingSkillIds: ['MEAS.SCALE.Interval'],
    representation: 'pictorial',
    variationTags: [`step-${step}`],
    explanationNl: [`Eén streepje is ${step} ${unit}. De ${kind === 'beaker' ? 'vloeistof' : 'wijzer'} staat bij ${value} ${unit}.`],
    hintsNl: ['Hoeveel is één streepje? Kijk tussen twee getallen.', 'Zoek het getal net onder de stand.', 'Tel de streepjes erbij.'],
    fingerprint: `${kind}:${max}:${step}:${value}`,
  })
}

/** Stories with a limit or a recipe: normalise, combine, compare. */
function combineLimit(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const k = rng.int(0, 2)
  if (k === 0) {
    const limit = rng.pick([15, 20, 23])
    const kg = rng.int(8, limit - 3)
    const g = rng.int(1, 9) * 100
    const left = limit * 1000 - (kg * 1000 + g)
    return makeExercise(ctx, rng, {
      archetypeId: 'meas-limit',
      instructionNl: BOOK.schrijfBerekening,
      steps: [intStep({
        id: 'left', prompt: `Een koffer mag ${limit} kg wegen. Er zit al ${kg} kg ${g} g in. Hoeveel gram mag er nog bij?`, skill: ctx.primarySkillId,
        answer: left, unit: 'g', solution: `${limit} kg = ${limit * 1000} g; ${limit * 1000} − ${kg * 1000 + g} = ${left} g`,
        wrong: (v) => (v === (limit - kg) * 1000 + g || v === limit - kg ? 'Maak eerst alles grammen: 1 kg = 1000 g.' : null),
      })],
      widget: null, supportingSkillIds: ['MEAS.MASS.Convert'], representation: 'story', variationTags: ['limit'],
      explanationNl: [`${limit} kg = ${limit * 1000} g. Er zit ${kg * 1000 + g} g in, dus er mag nog ${left} g bij.`],
      hintsNl: ['Schrijf alles in dezelfde maat: grammen.', `${kg} kg ${g} g = ? g`, 'Trek het af van het maximum.'],
      fingerprint: `limit:${limit}:${kg}:${g}`,
    })
  }
  if (k === 1) {
    const glasses = rng.int(2, 5)
    const size = rng.pick([150, 200, 250])
    const bottle = rng.pick([1000, 1500, 2000].filter((b) => b > glasses * size))
    const left = bottle - glasses * size
    return makeExercise(ctx, rng, {
      archetypeId: 'meas-recipe',
      instructionNl: BOOK.schrijfBerekening,
      steps: [intStep({
        id: 'left', prompt: `In een fles zit ${bottle / 1000 === Math.floor(bottle / 1000) ? `${bottle / 1000} L` : `${bottle} mL`} melk. Je schenkt ${glasses} glazen van ${size} mL in. Hoeveel mL blijft er over?`, skill: ctx.primarySkillId,
        answer: left, unit: 'mL', solution: `${glasses} × ${size} = ${glasses * size} mL; ${bottle} − ${glasses * size} = ${left} mL`,
      })],
      widget: null, supportingSkillIds: ['MEAS.CAPACITY.Convert'], representation: 'story', variationTags: ['recipe'],
      explanationNl: [`${bottle} mL − ${glasses} × ${size} mL = ${left} mL.`],
      hintsNl: ['Hoeveel mL schenk je in totaal in?', '1 L = 1000 mL.', 'Trek het af van wat er in de fles zat.'],
      fingerprint: `recipe:${bottle}:${glasses}x${size}`,
    })
  }
  // Meester Bart: 4 planken van 245 mm en 2 van 135 mm (blok 2 lesson 4).
  const n1 = rng.int(2, 5)
  const l1 = rng.int(12, 49) * 5
  const n2 = rng.int(1, 3)
  const l2 = rng.int(10, 30) * 5
  const total = n1 * l1 + n2 * l2
  return makeExercise(ctx, rng, {
    archetypeId: 'meas-combine',
    instructionNl: BOOK.schrijfBerekening,
    steps: [intStep({
      id: 'total', prompt: `Meester Bart maakt een vogelhuisje. Hij heeft ${n1} planken van ${l1} mm en ${n2} planken van ${l2} mm nodig. Hoeveel mm hout heeft hij in totaal nodig?`, skill: ctx.primarySkillId,
      answer: total, unit: 'mm', solution: `${n1} × ${l1} + ${n2} × ${l2} = ${n1 * l1} + ${n2 * l2} = ${total} mm`,
      wrong: (v) => (v === l1 + l2 ? 'Er zijn meer planken: reken keer het aantal.' : null),
    })],
    widget: null, supportingSkillIds: ['MUL.SPLIT.Distribute'], representation: 'story', variationTags: ['combine'],
    explanationNl: [`${n1} × ${l1} = ${n1 * l1}, ${n2} × ${l2} = ${n2 * l2}, samen ${total} mm.`],
    hintsNl: ['Reken eerst de lange planken samen.', 'Reken dan de korte planken samen.', 'Tel beide uitkomsten op.'],
    fingerprint: `combine:${n1}x${l1}+${n2}x${l2}`,
  })
}

export function generateMeasurement(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  switch (ctx.primarySkillId) {
    case 'MEAS.UNIT.Select': return unitSelect(ctx, rng)
    case 'MEAS.LENGTH.Anchor':
    case 'MEAS.MASS.Anchor':
    case 'MEAS.CAPACITY.Anchor': return anchor(ctx, rng)
    case 'MEAS.COMPARE.Normalize': return compareNormalize(ctx, rng)
    case 'MEAS.BEAKER.Read': return readInstrument(ctx, rng, 'beaker')
    case 'MEAS.MASS.ReadScale': return readInstrument(ctx, rng, 'scale')
    case 'MEAS.CONTEXT.CombineLimit': return combineLimit(ctx, rng)
    default: throw new Error(`measurement: unsupported skill ${ctx.primarySkillId}`)
  }
}

export const MEASUREMENT_SKILLS = [
  'MEAS.UNIT.Select', 'MEAS.LENGTH.Anchor', 'MEAS.MASS.Anchor', 'MEAS.CAPACITY.Anchor',
  'MEAS.COMPARE.Normalize', 'MEAS.BEAKER.Read', 'MEAS.MASS.ReadScale', 'MEAS.CONTEXT.CombineLimit',
]
