/**
 * Place value to 10 000 (blok 1 and the blok 2 Weet je nog? lessons):
 * digit value, composing, exchanging, ×10/×100, comparing with < and >,
 * and continuing a sequence ("Tel verder").
 */
import type { GeneratedExercise, GeneratedStep } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { byBand, choiceStep, intStep, isSupported, isTestFormat, makeExercise, parseLooseInt } from './kit'

const PLACE_NAMES: Record<number, { one: string; many: string }> = {
  1000: { one: 'duizendtal', many: 'duizendtallen' },
  100: { one: 'honderdtal', many: 'honderdtallen' },
  10: { one: 'tiental', many: 'tientallen' },
  1: { one: 'eenheid', many: 'eenheden' },
}

const NAME_TO_PLACE: Record<string, number> = {
  duizendtal: 1000, duizendtallen: 1000, d: 1000,
  honderdtal: 100, honderdtallen: 100, h: 100,
  tiental: 10, tientallen: 10, t: 10,
  eenheid: 1, eenheden: 1, e: 1,
}

function digitCount(ctx: GeneratorContext): number {
  return byBand(ctx.band, { easier: 3, standard: 4, harder: 4 })
}

/** "De waarde van het cijfer 8 in: 2842" — 800, or "8 honderdtallen". */
function identify(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const len = digitCount(ctx)
  let n = 0
  let pos = 0
  for (let i = 0; i < 100; i++) {
    n = rng.int(10 ** (len - 1), 10 ** len - 1)
    pos = rng.int(0, len - 1)
    const digit = Number(String(n)[pos])
    // The digit must be unambiguous and non-zero in the number.
    if (digit !== 0 && String(n).split('').filter((c) => c === String(digit)).length === 1) break
  }
  const s = String(n)
  const digit = Number(s[pos])
  const place = 10 ** (len - 1 - pos)
  const value = digit * place
  const name = digit === 1 ? PLACE_NAMES[place]!.one : PLACE_NAMES[place]!.many
  const step: GeneratedStep = {
    id: 'value',
    promptNl: `De waarde van het cijfer ${digit} in: ${n}`,
    answerType: { kind: 'text' },
    solutionNl: `${digit} ${name} = ${value}`,
    skillTarget: { skillId: ctx.primarySkillId, role: 'primary' },
    revealsAnswer: true,
    expected: value,
    validate: (raw) => {
      const text = String(raw).trim().toLowerCase().replace(/\s+/g, ' ')
      const named = text.match(/^(\d+)\s*([a-z]+)\.*$/)
      let v: number | null = null
      if (named && NAME_TO_PLACE[named[2]!] !== undefined) v = Number(named[1]) * NAME_TO_PLACE[named[2]!]!
      else v = parseLooseInt(text)
      if (v === null) {
        return { isCorrect: false, feedbackNl: `Schrijf de waarde (bijvoorbeeld 800) of "8 honderdtallen".`, misconceptionId: null, invalidFormat: true }
      }
      if (v === value) return { isCorrect: true, feedbackNl: `Goed: ${digit} ${name}, dat is ${value}.`, misconceptionId: null }
      if (v === digit) {
        return { isCorrect: false, feedbackNl: `Het cijfer is ${digit}, maar wat is het waard op deze plek?`, misconceptionId: 'MC.PV.FaceValue' }
      }
      return { isCorrect: false, feedbackNl: 'Kijk op welke plek het cijfer staat: D, H, T of E.', misconceptionId: null }
    },
  }
  return makeExercise(ctx, rng, {
    archetypeId: 'digit-value',
    instructionNl: isSupported(ctx) ? 'Op welke plek staat het cijfer? Die plek bepaalt de waarde.' : BOOK.bepaalWaarde,
    steps: [step],
    widget: isSupported(ctx) ? { type: 'dhte-grid', props: { number: n, columns: ['D', 'H', 'T', 'E'].slice(4 - len), digits: s.split('') } } : null,
    supportingSkillIds: [],
    representation: isSupported(ctx) ? 'pictorial' : 'symbolic',
    variationTags: [`place-${place}`],
    explanationNl: [`In ${n} staat de ${digit} op de plek van de ${PLACE_NAMES[place]!.many}: ${digit} × ${place} = ${value}.`],
    hintsNl: ['Zet het getal in een D H T E-tabel.', 'Welke letter staat boven het cijfer?', `Een cijfer bij de ${PLACE_NAMES[place]!.many} is ${place} keer zoveel waard.`],
    fingerprint: `pvid:${n}:${pos}`,
  })
}

/** "8000 + 500 + 40 + 6 =", or the parts in a shuffled order with a zero place. */
function compose(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const len = digitCount(ctx)
  const digits = Array.from({ length: len }, (_, i) => (i === 0 ? rng.int(1, 9) : rng.int(0, 9)))
  // Zero position is the critical variation: force one at standard and harder.
  if (ctx.band !== 'easier') digits[rng.int(1, len - 1)] = 0
  const n = Number(digits.join(''))
  const parts = digits.map((d, i) => d * 10 ** (len - 1 - i)).filter((v) => v > 0)
  const shown = ctx.band === 'harder' ? rng.shuffle(parts) : parts
  const words = digits
    .map((d, i) => ({ d, place: 10 ** (len - 1 - i) }))
    .filter(({ d }) => d > 0)
    .map(({ d, place }) => `${d} ${d === 1 ? PLACE_NAMES[place]!.one : PLACE_NAMES[place]!.many}`)
  const byWords = isSupported(ctx) || rng.bool(0.3)
  return makeExercise(ctx, rng, {
    archetypeId: 'compose-number',
    instructionNl: byWords && !isTestFormat(ctx) ? 'Welk getal is het? Een lege plek krijgt een 0.' : BOOK.rekenUit,
    steps: [intStep({
      id: 'number',
      prompt: byWords && !isTestFormat(ctx) ? `${words.join(', ')} =` : `${shown.join(' + ')} =`,
      skill: ctx.primarySkillId, answer: n, solution: `${shown.join(' + ')} = ${n}`,
      wrong: (v) => (String(v).length < len ? 'Je mist een plek. Een plek zonder iets krijgt een 0.' : null),
    })],
    widget: isSupported(ctx) ? { type: 'dhte-grid', props: { number: n, columns: ['D', 'H', 'T', 'E'].slice(4 - len) } } : null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: digits.slice(1).includes(0) ? ['zero-position'] : ['all-places'],
    explanationNl: [`${shown.join(' + ')} = ${n}. Elke plek krijgt een cijfer, ook als het een 0 is.`],
    hintsNl: ['Zet elk deel op zijn plek in de D H T E-tabel.', 'Welke plek is leeg? Daar komt een 0.', 'Lees dan het getal van links naar rechts.'],
    fingerprint: `compose:${n}:${shown.join('+')}`,
  })
}

/** 1 H = 10 T: "4 honderdtallen en 12 tientallen = …". */
function exchange(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const form = rng.int(0, 2)
  let prompt: string
  let answer: number
  let solution: string
  if (form === 0) {
    const h = rng.int(2, 9)
    prompt = `${h} honderdtallen = … tientallen`
    answer = h * 10
    solution = `1 honderdtal = 10 tientallen, dus ${h} honderdtallen = ${answer} tientallen`
  } else if (form === 1) {
    const t = rng.int(12, 48)
    prompt = `${t} tientallen = … eenheden`
    answer = t * 10
    solution = `${t} × 10 = ${answer}`
  } else {
    const h = rng.int(1, 7)
    const t = rng.int(11, 19)
    const e = rng.int(0, 9)
    prompt = `${h} honderdtallen, ${t} tientallen en ${e} eenheden = (getal)`
    answer = h * 100 + t * 10 + e
    solution = `${t} tientallen = 1 honderdtal en ${t - 10} tientallen, dus ${answer}`
  }
  return makeExercise(ctx, rng, {
    archetypeId: 'exchange',
    instructionNl: isSupported(ctx) ? 'Ruilen: 1 honderdtal = 10 tientallen, 1 tiental = 10 eenheden.' : BOOK.vulIn,
    steps: [intStep({ id: 'answer', prompt, skill: ctx.primarySkillId, answer, solution })],
    widget: null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: [`exchange-${form}`],
    explanationNl: [solution, 'Ruilen verandert de waarde niet.'],
    hintsNl: ['1 honderdtal is evenveel als 10 tientallen.', '1 tiental is evenveel als 10 eenheden.', 'Ruil wat te veel is naar de plek ernaast.'],
    fingerprint: `exchange:${prompt}`,
  })
}

/** "10 × 70 =", "100 × 60 =", "… × 100 = 700", "4500 : 10 =". */
function tenHundred(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const factor = rng.pick([10, 100])
  // Results stay within the blok's range of 10 000.
  const base = byBand(ctx.band, {
    easier: rng.int(2, 9),
    standard: rng.int(11, 99),
    harder: factor === 10 ? rng.int(101, 999) : rng.int(11, 99),
  })
  const form = isSupported(ctx) ? 0 : rng.int(0, 2)
  const product = base * factor
  const [prompt, answer, solution] =
    form === 0 ? [`${factor} × ${base} =`, product, `${factor} × ${base} = ${product}`]
    : form === 1 ? [`… × ${factor} = ${product}`, base, `${base} × ${factor} = ${product}`]
    : [`${product} : ${factor} =`, base, `${product} : ${factor} = ${base}`]
  return makeExercise(ctx, rng, {
    archetypeId: 'times-ten-hundred',
    instructionNl: isSupported(ctx) ? `Keer ${factor}: elk cijfer schuift ${factor === 10 ? 'één plek' : 'twee plekken'} naar links.` : BOOK.rekenUit,
    steps: [intStep({
      id: 'answer', prompt, skill: ctx.primarySkillId, answer, solution,
      wrong: (v) => (v === answer * 10 || v * 10 === answer ? 'Tel de nullen nog eens: komt er één nul bij of af, of twee?' : null),
    })],
    widget: isSupported(ctx) ? { type: 'dhte-grid', props: { number: product, columns: ['D', 'H', 'T', 'E'] } } : null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: [form === 0 ? 'times' : form === 1 ? 'missing-factor' : 'divide'],
    explanationNl: [`${solution}. Keer ${factor} maakt elk cijfer ${factor} keer zoveel waard.`],
    hintsNl: [`Keer ${factor}: het getal wordt ${factor} keer zo groot.`, `Bij keer ${factor} komen er ${factor === 10 ? 'één' : 'twee'} nul${factor === 10 ? '' : 'len'} achter.`, 'Bij delen door 10 of 100 gaan er nullen af.'],
    fingerprint: `x10:${prompt}`,
  })
}

/** "Vul < of > in." 4234 … 4324 */
function compare(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const len = byBand(ctx.band, { easier: 2, standard: 3, harder: 4 })
  let a = 0
  let b = 0
  const sameDigits = ctx.band !== 'easier' && rng.bool(0.6)
  for (let i = 0; i < 200; i++) {
    a = rng.int(10 ** (len - 1), 10 ** len - 1)
    if (sameDigits) {
      const ds = String(a).split('')
      const i1 = rng.int(0, len - 2)
      ;[ds[i1], ds[i1 + 1]] = [ds[i1 + 1]!, ds[i1]!]
      b = Number(ds.join(''))
    } else {
      b = a + rng.pick([-1, 1]) * rng.int(1, 10 ** (len - 1))
    }
    if (b !== a && String(b).length === len && b > 0) break
  }
  if (b === a) throw new Error('compare: no pair')
  const symbol = a < b ? '<' : '>'
  return makeExercise(ctx, rng, {
    archetypeId: 'compare-symbols',
    instructionNl: isSupported(ctx) ? 'Kijk eerst naar de grootste plek. De open kant van < of > wijst naar het grootste getal.' : BOOK.vulKleinerGroter,
    steps: [choiceStep({
      id: 'symbol', prompt: `${a} … ${b}`, skill: ctx.primarySkillId, options: ['<', '>'], answer: symbol,
      solution: `${a} ${symbol} ${b}`,
      wrong: () => 'Vergelijk eerst de cijfers op de grootste plek. Staat daar hetzelfde? Kijk dan naar de volgende plek.',
    })],
    widget: isSupported(ctx) ? { type: 'dhte-grid', props: { number: a, columns: ['D', 'H', 'T', 'E'].slice(4 - Math.max(len, 1)), rows: [String(a).split(''), String(b).split('')] } } : null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: sameDigits && String(a).split('').sort().join('') === String(b).split('').sort().join('') ? ['same-digits'] : ['different-digits'],
    explanationNl: [`${a} ${symbol} ${b}: ${symbol === '<' ? `${a} is kleiner dan ${b}` : `${a} is groter dan ${b}`}.`],
    hintsNl: ['Zet de getallen onder elkaar.', 'Vergelijk de cijfers van links naar rechts.', '< betekent kleiner dan, > betekent groter dan.'],
    fingerprint: `cmp:${a}:${b}`,
  })
}

/** "Tel verder. Kijk goed wat erbij komt of eraf gaat." 6720 – 6800 – 6880 – … */
function sequence(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const step = byBand(ctx.band, { easier: rng.pick([10, 50, 100]), standard: rng.pick([25, 50, 80, 120, 200]), harder: rng.pick([80, 90, 150, 250, 900]) })
  const descending = ctx.band !== 'easier' && rng.bool(0.4)
  const start = rng.int(1000, 8000)
  const dir = descending ? -1 : 1
  const shown = [0, 1, 2].map((i) => start + dir * i * step)
  const next1 = start + dir * 3 * step
  const next2 = start + dir * 4 * step
  const steps = [
    ...(isSupported(ctx) ? [intStep({
      id: 'step', prompt: `Hoeveel komt er steeds ${descending ? 'af' : 'bij'}?`, skill: ctx.primarySkillId, role: 'supporting' as const,
      answer: step, solution: `${shown[1]} ${descending ? '−' : '+'} … : steeds ${step}`, reveals: false,
    })] : []),
    intStep({ id: 'next1', prompt: `${shown.join(' – ')} – …`, skill: ctx.primarySkillId, answer: next1, solution: `${shown[2]} ${descending ? '−' : '+'} ${step} = ${next1}` }),
    intStep({ id: 'next2', prompt: `… – ${next1} – …`, skill: ctx.primarySkillId, answer: next2, solution: `${next1} ${descending ? '−' : '+'} ${step} = ${next2}` }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'sequence',
    instructionNl: BOOK.telVerder,
    steps,
    widget: null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: [descending ? 'descending' : 'ascending'],
    explanationNl: [`Er gaat steeds ${step} ${descending ? 'af' : 'bij'}: ${[...shown, next1, next2].join(' – ')}.`],
    hintsNl: ['Wat is het verschil tussen de eerste twee getallen?', 'Is het tweede verschil hetzelfde?', `Doe dat nog een keer vanaf ${shown[2]}.`],
    fingerprint: `seq:${start}:${dir * step}`,
  })
}

export function generatePlaceValue(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  switch (ctx.primarySkillId) {
    case 'PV.DHTE.Identify': return identify(ctx, rng)
    case 'PV.DHTE.Compose': return compose(ctx, rng)
    case 'PV.DHTE.Exchange': return exchange(ctx, rng)
    case 'PV.SCALE.TenHundred': return tenHundred(ctx, rng)
    case 'NUM.COMPARE.Symbols': return compare(ctx, rng)
    case 'NUM.SEQ.Step': return sequence(ctx, rng)
    default: throw new Error(`place-value: unsupported skill ${ctx.primarySkillId}`)
  }
}

export const PLACE_VALUE_SKILLS = [
  'PV.DHTE.Identify', 'PV.DHTE.Compose', 'PV.DHTE.Exchange', 'PV.SCALE.TenHundred', 'NUM.COMPARE.Symbols', 'NUM.SEQ.Step',
]
