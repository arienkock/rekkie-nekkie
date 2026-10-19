/**
 * Vermenigvuldigen, blok 2.1 and 2.3 (Getal & Ruimte Junior groep 6):
 *  - MUL.SCALE.OneFactor / TwoFactors: 4 × 30, 40 × 30, "… × 100 = 700"
 *  - MUL.SPLIT.Distribute: 3 × 133 = 300 + 90 + 9 (and the ×-table form)
 *  - MUL.COLUMN.PartialProducts: "Vermenigvuldig eerst de honderdtallen,
 *    daarna de tientallen en ten slotte de eenheden."
 *  - MUL.COLUMN.Carry: cijferend 3 × 295 = 885, estimate first
 *  - MUL.COLUMN.TensFactor: 30 × 12, 40 × 56 with the tiental-nul first
 *  - MUL.ESTIMATE.Friendly: "Schat het antwoord.", "is minder / meer dan"
 *  - MUL.CONTEXT.FourStep: stories with the 4-step plan
 * Number ranges follow the lessons and Test jezelf (pp. 68–70).
 */
import type { GeneratedExercise, GeneratedStep } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import {
  byBand, choiceStep, estimateStep, friendlyValues, intStep, isSupported, isTestFormat, makeExercise,
  productEstimates, roundTo, shuffleOptions,
} from './kit'

const partsOf = (n: number) => String(n).split('').map((d, i, all) => Number(d) * 10 ** (all.length - 1 - i)).filter((v) => v > 0)

/** The canonical estimate: the multi-digit factor rounded to its leading place. */
function canonicalEstimate(a: number, b: number): { value: number; text: string } {
  const fa = a >= 10 ? roundTo(a, 10 ** (String(a).length - 1)) : a
  const fb = b >= 10 ? roundTo(b, 10 ** (String(b).length - 1)) : b
  return { value: fa * fb, text: `${fa} × ${fb}` }
}

function estimateFor(id: string, a: number, b: number, skill: string, exact: number): GeneratedStep {
  const c = canonicalEstimate(a, b)
  return estimateStep({
    id, prompt: `${a} × ${b} ≈`, skill, role: 'supporting',
    solution: `${a} × ${b} ≈ ${c.text} = ${c.value}`,
    accepted: productEstimates(a, b), canonical: c.value, how: `${c.text} = ${c.value}.`, exact,
  })
}

// ---- ×10 / ×100 patterns ----

function scaleOne(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const a = rng.int(2, 9)
  const b = rng.int(2, 9)
  const zeros = byBand(ctx.band, { easier: 1, standard: rng.int(1, 2), harder: 2 })
  const big = b * 10 ** zeros
  const product = a * big
  const missing = !isSupported(ctx) && ctx.band !== 'easier' && rng.bool(0.3)
  const steps = [
    ...(isSupported(ctx) ? [intStep({ id: 'fact', prompt: `${a} × ${b} =`, skill: `MUL.FACT.T${b}`, role: 'supporting' as const, answer: a * b, solution: `${a} × ${b} = ${a * b}`, reveals: false })] : []),
    missing
      ? intStep({ id: 'answer', prompt: `${a} × … = ${product}`, skill: ctx.primarySkillId, answer: big, solution: `${a} × ${big} = ${product}` })
      : intStep({
          id: 'answer', prompt: `${a} × ${big} =`, skill: ctx.primarySkillId, answer: product, solution: `${a} × ${b} = ${a * b}, dus ${a} × ${big} = ${product}`,
          wrong: (v) => (v === a * b * 10 ** (zeros === 1 ? 2 : 1) ? 'Tel de nullen: hoeveel nullen staan er in de som?' : null),
        }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'mul-scale-one',
    instructionNl: isSupported(ctx) ? `${a} × ${b} helpt je: ${a} × ${big} is ${10 ** zeros} keer zo veel.` : BOOK.rekenUit,
    steps,
    widget: null,
    supportingSkillIds: ['PV.SCALE.TenHundred'],
    representation: 'symbolic',
    variationTags: [missing ? 'missing-factor' : `zeros-${zeros}`],
    explanationNl: [`${a} × ${b} = ${a * b}. ${big} is ${10 ** zeros} keer zo groot als ${b}, dus ${a} × ${big} = ${product}.`],
    hintsNl: [`Reken eerst ${a} × ${b}.`, `${big} = ${b} × ${10 ** zeros}.`, `Zet de nul${zeros > 1 ? 'len' : ''} er weer achter.`],
    fingerprint: `scale1:${a}x${big}:${missing ? 'm' : 'p'}`,
  })
}

function scaleTwo(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const a = rng.int(2, 9)
  const b = rng.int(2, 9)
  const za = 1
  const zb = byBand(ctx.band, { easier: 1, standard: 1, harder: rng.int(1, 2) })
  const A = a * 10 ** za
  const B = b * 10 ** zb
  const product = A * B
  const steps = isSupported(ctx)
    ? [
        intStep({ id: 'fact', prompt: `${a} × ${b} =`, skill: `MUL.FACT.T${b}`, role: 'supporting', answer: a * b, solution: `${a} × ${b} = ${a * b}`, reveals: false }),
        intStep({ id: 'one', prompt: `${A} × ${b} =`, skill: 'MUL.SCALE.OneFactor', role: 'supporting', answer: A * b, solution: `${A} × ${b} = ${A * b}`, reveals: false }),
        intStep({ id: 'answer', prompt: `${A} × ${B} =`, skill: ctx.primarySkillId, answer: product, solution: `${A} × ${B} = ${product}` }),
      ]
    : [intStep({
        id: 'answer', prompt: `${A} × ${B} =`, skill: ctx.primarySkillId, answer: product, solution: `${a} × ${b} = ${a * b}, en er komen ${za + zb} nullen bij: ${product}`,
        wrong: (v) => (v === product / 10 ? { feedbackNl: 'Beide getallen zijn tientallen: dan wordt het twee keer tien keer zo groot.', misconceptionId: 'MC.MUL.OneZero' } : null),
      })]
  return makeExercise(ctx, rng, {
    archetypeId: 'mul-scale-two',
    instructionNl: BOOK.rekenUit,
    steps,
    widget: null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: [`zeros-${za + zb}`],
    explanationNl: [`${A} × ${B} = ${a} × ${b} × ${10 ** (za + zb)} = ${product}.`],
    hintsNl: [`Reken eerst ${a} × ${b}.`, 'Hoeveel nullen hebben de twee getallen samen?', 'Zet die nullen achter je uitkomst.'],
    fingerprint: `scale2:${A}x${B}`,
  })
}

// ---- Splitting (blok 2.1 lesson 2) ----

function pickOneByMany(ctx: GeneratorContext, rng: SeededRng): { a: number; n: number } {
  const a = byBand(ctx.band, { easier: rng.int(2, 4), standard: rng.int(2, 6), harder: rng.int(3, 9) })
  const n = byBand(ctx.band, { easier: rng.int(21, 99), standard: rng.int(112, 399), harder: rng.int(123, 989) })
  return { a, n }
}

function distribute(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const { a, n } = pickOneByMany(ctx, rng)
  const parts = partsOf(n)
  const partials = parts.map((p) => a * p)
  const product = a * n
  const steps = isSupported(ctx)
    ? [
        ...parts.map((p, i) => intStep({ id: `part-${i}`, prompt: `${a} × ${p} =`, skill: 'MUL.SCALE.OneFactor', role: 'supporting' as const, answer: a * p, solution: `${a} × ${p} = ${a * p}`, reveals: false })),
        intStep({ id: 'answer', prompt: `${partials.join(' + ')} =`, skill: ctx.primarySkillId, answer: product, solution: `${a} × ${n} = ${partials.join(' + ')} = ${product}` }),
      ]
    : [intStep({
        id: 'answer', prompt: `${a} × ${n} =`, skill: ctx.primarySkillId, answer: product,
        solution: `${a} × ${n} = ${partials.join(' + ')} = ${product}`,
        wrong: (v) => (v === a * parts[0]! + parts.slice(1).reduce((s, p) => s + p, 0)
          ? { feedbackNl: `Je deed alleen het eerste deel keer ${a}. Elk deel moet keer ${a}: ${parts.map((p) => `${a} × ${p}`).join(' + ')}.`, misconceptionId: 'MC.MUL.PartialDistribute' }
          : null),
      })]
  return makeExercise(ctx, rng, {
    archetypeId: 'mul-distribute',
    instructionNl: isSupported(ctx) ? `Splits ${n} in ${parts.join(' + ')} en doe elk deel keer ${a}.` : BOOK.rekenUit,
    steps,
    widget: isSupported(ctx) ? { type: 'split-table', props: { factor: a, parts } } : null,
    supportingSkillIds: ['MUL.SCALE.OneFactor'],
    representation: isSupported(ctx) ? 'pictorial' : 'symbolic',
    variationTags: [String(n).length >= 3 ? 'three-digit' : 'two-digit', ...(isSupported(ctx) ? ['table-form'] : [])],
    explanationNl: [`${a} × ${n} = ${parts.map((p) => `${a} × ${p}`).join(' + ')} = ${partials.join(' + ')} = ${product}.`],
    hintsNl: [`Splits ${n} in ${parts.join(' + ')}.`, `Doe elk deel keer ${a}.`, 'Tel de uitkomsten bij elkaar op.'],
    fingerprint: `dist:${a}x${n}`,
  })
}

function partialProducts(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const { a, n } = pickOneByMany({ ...ctx, band: ctx.band === 'easier' ? 'standard' : ctx.band }, rng)
  // Maatwerk order: honderdtallen, dan tientallen, ten slotte de eenheden.
  const parts = partsOf(n)
  const product = a * n
  const names = parts.map((p) => (p >= 100 ? 'honderdtallen' : p >= 10 ? 'tientallen' : 'eenheden'))
  const steps = [
    ...parts.map((p, i) => intStep({
      id: `pp-${i}`, prompt: `${a} × ${p} = (${names[i]})`, skill: ctx.primarySkillId, answer: a * p, solution: `${a} × ${p} = ${a * p}`,
      wrong: (v) => (v === a * Number(String(p)[0]) ? `Het cijfer staat bij de ${names[i]}: het is ${p} waard, niet ${String(p)[0]}.` : null),
    })),
    intStep({ id: 'answer', prompt: `${a} × ${n} =`, skill: ctx.primarySkillId, answer: product, solution: `${parts.map((p) => a * p).join(' + ')} = ${product}` }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'mul-partial-products',
    instructionNl: `${BOOK.rekenUit} Vermenigvuldig eerst de honderdtallen, daarna de tientallen en ten slotte de eenheden.`,
    steps: isTestFormat(ctx) ? [steps[steps.length - 1]!] : steps,
    widget: isSupported(ctx) ? { type: 'split-table', props: { factor: a, parts } } : null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: ['partial-products'],
    explanationNl: [`${parts.map((p) => `${a} × ${p} = ${a * p}`).join('; ')}. Samen ${product}.`],
    hintsNl: ['Begin bij de honderdtallen.', 'Elk cijfer is zo veel waard als zijn plek.', 'Tel de tussenantwoorden op.'],
    fingerprint: `pp:${a}x${n}`,
  })
}

// ---- Cijferend (blok 2.1 lesson 3; Test jezelf item 7) ----

function columnCarry(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  let a = 0
  let n = 0
  for (let i = 0; i < 200; i++) {
    a = byBand(ctx.band, { easier: rng.int(2, 4), standard: rng.int(3, 6), harder: rng.int(4, 9) })
    n = rng.int(byBand(ctx.band, { easier: 112, standard: 123, harder: 145 }), byBand(ctx.band, { easier: 333, standard: 499, harder: 989 }))
    if ((n % 10) * a >= 10 && a * n < 10000) break
  }
  const product = a * n
  const e = n % 10
  const t = Math.floor(n / 10) % 10
  const unitsProduct = a * e
  const carry1 = Math.floor(unitsProduct / 10)
  const tensProduct = a * t + carry1
  const book = !isSupported(ctx)
  const steps: GeneratedStep[] = book
    ? [
        estimateFor('estimate', a, n, 'MUL.ESTIMATE.Friendly', product),
        intStep({ id: 'answer', prompt: `${a} × ${n} =`, skill: ctx.primarySkillId, answer: product, solution: `${a} × ${n} = ${product}`,
          wrong: (v) => {
            const noCarry = Number(String(n).split('').map((d) => (a * Number(d)) % 10).join(''))
            return v === noCarry ? { feedbackNl: 'Je vergat wat je onthoudt. Tel het onthouden getal bij de volgende kolom op.', misconceptionId: 'MC.MUL.CarryLost' } : 'Kijk je schatting na: ligt je antwoord in de buurt?'
          } }),
      ]
    : [
        intStep({ id: 'units', prompt: `${a} × ${e} eenheden = … eenheden`, skill: ctx.primarySkillId, answer: unitsProduct, solution: `${a} × ${e} = ${unitsProduct}: schrijf ${unitsProduct % 10} op, onthoud ${carry1}`, reveals: false }),
        intStep({ id: 'write-units', prompt: `Welk cijfer schrijf je op bij de eenheden?`, skill: ctx.primarySkillId, answer: unitsProduct % 10, solution: `${unitsProduct % 10}, en je onthoudt ${carry1} tiental`, reveals: false }),
        intStep({ id: 'tens', prompt: `${a} × ${t} tientallen + ${carry1} onthouden = … tientallen`, skill: ctx.primarySkillId, answer: tensProduct, solution: `${a * t} + ${carry1} = ${tensProduct}`, reveals: false,
          wrong: (v) => (v === a * t ? { feedbackNl: `Vergeet de ${carry1} niet die je onthield.`, misconceptionId: 'MC.MUL.CarryLost' } : null) }),
        intStep({ id: 'answer', prompt: `${a} × ${n} =`, skill: ctx.primarySkillId, answer: product, solution: `${a} × ${n} = ${product}` }),
      ]
  return makeExercise(ctx, rng, {
    archetypeId: 'mul-column-carry',
    instructionNl: book ? BOOK.zetOnderElkaarSchatEerst : 'Cijferend: begin bij de eenheden. Schrijf één cijfer op en onthoud de tientallen.',
    steps,
    widget: book ? null : { type: 'column-grid', props: { operation: '×', operands: [n, a] } },
    supportingSkillIds: ['MUL.COLUMN.PartialProducts'],
    representation: 'symbolic',
    variationTags: ['carry', String(n).length === 3 ? 'three-digit' : 'two-digit'],
    explanationNl: [`${a} × ${e} = ${unitsProduct}: schrijf ${unitsProduct % 10}, onthoud ${carry1}.`, `Het antwoord is ${product}. Het antwoord ligt in de buurt van de schatting ${canonicalEstimate(a, n).value}.`],
    hintsNl: ['Schat eerst: maak van het grote getal een rond getal.', 'Begin rechts bij de eenheden. Is het 10 of meer? Schrijf de eenheden op en onthoud de tientallen.', 'Tel bij elke kolom op wat je onthouden hebt.'],
    fingerprint: `mulcol:${a}x${n}`,
  })
}

// ---- Tens factor (blok 2.3 lessons 12–13; Test jezelf item 8) ----

function tensFactor(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const carry = ctx.band !== 'easier'
  let T = 0
  let n = 0
  for (let i = 0; i < 300; i++) {
    T = rng.int(2, carry ? 9 : 4) * 10
    n = rng.int(11, 99)
    const t = T / 10
    if (carry === ((n % 10) * t >= 10)) break
  }
  const t = T / 10
  const product = T * n
  const e = n % 10
  const tensDigit = Math.floor(n / 10)
  const first = t * e
  const book = !isSupported(ctx)
  const steps: GeneratedStep[] = book
    ? [
        estimateFor('estimate', T, n, 'MUL.ESTIMATE.Friendly', product),
        intStep({ id: 'answer', prompt: `${T} × ${n} =`, skill: ctx.primarySkillId, answer: product, solution: `${T} × ${n} = ${product}`,
          wrong: (v) => (v === t * n ? { feedbackNl: 'Je vermenigvuldigt met tientallen: schrijf eerst de tiental-nul op.', misconceptionId: 'MC.MUL.TensZeroLost' } : 'Vergelijk met je schatting.') }),
      ]
    : [
        intStep({ id: 'zero', prompt: 'Je vermenigvuldigt met tientallen. Welk cijfer schrijf je eerst op bij de eenheden?', skill: ctx.primarySkillId, answer: 0, solution: 'Schrijf de tiental-nul op: 0', reveals: false }),
        intStep({ id: 'first', prompt: `${t} × ${e} =`, skill: ctx.primarySkillId, answer: first, solution: `${t} × ${e} = ${first}${first >= 10 ? `: schrijf ${first % 10} op, onthoud ${Math.floor(first / 10)}` : ''}`, reveals: false }),
        intStep({ id: 'answer', prompt: `${T} × ${n} =`, skill: ctx.primarySkillId, answer: product, solution: `${t} × ${n} = ${t * n}, met de tiental-nul: ${product}` }),
      ]
  return makeExercise(ctx, rng, {
    archetypeId: 'mul-tens-factor',
    instructionNl: book ? BOOK.zetOnderElkaarSchatEerst : `Je vermenigvuldigt met tientallen: schrijf eerst de tiental-nul op. Reken dan ${t} × ${n}.`,
    steps,
    widget: book ? null : { type: 'column-grid', props: { operation: '×', operands: [n, T] } },
    supportingSkillIds: ['MUL.SCALE.OneFactor'],
    representation: 'symbolic',
    variationTags: [carry ? 'carry' : 'no-carry'],
    explanationNl: [`${T} × ${n}: schrijf de tiental-nul op, reken dan ${t} × ${e} = ${first} en ${t} × ${tensDigit} tientallen. Het antwoord is ${product}.`],
    hintsNl: [`Schat eerst: ${canonicalEstimate(T, n).text}.`, 'Je vermenigvuldigt met tientallen: schrijf eerst de 0 op.', `Reken dan ${t} × ${n} zoals je gewend bent.`],
    fingerprint: `multens:${T}x${n}`,
  })
}

// ---- Estimating (blok 2.1 lesson 1, 2.3 lesson 13; Test jezelf item 6) ----

function estimate(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const twoByTwo = ctx.band !== 'easier' && rng.bool(0.5)
  const a = twoByTwo ? rng.int(12, 98) : rng.int(112, 989)
  const b = twoByTwo ? rng.int(12, 98) : rng.int(3, 9)
  const exact = a * b
  const form = isSupported(ctx) || ctx.variant === 'type' ? 'type' : rng.pick(['type', 'type', 'more-or-less', 'match'] as const)
  if (form === 'more-or-less') {
    const c = canonicalEstimate(a, b)
    const lead = 10 ** (String(c.value).length - 1)
    const benchmark = roundTo(exact, lead / 2 || 1) + (rng.bool() ? lead / 2 : -lead / 2)
    const answer = exact < benchmark ? 'minder' : 'meer'
    return makeExercise(ctx, rng, {
      archetypeId: 'mul-estimate-benchmark',
      instructionNl: BOOK.schatHetAntwoord,
      steps: [choiceStep({
        id: 'more-less', prompt: `${a} × ${b} is minder / meer dan ${benchmark}`, skill: ctx.primarySkillId, options: ['minder', 'meer'], answer,
        solution: `${a} × ${b} = ${exact}, dat is ${answer} dan ${benchmark}`,
        wrong: () => 'Maak passende getallen. Bij keer is de schatting het preciest als je het ene getal kleiner maakt en het andere groter.',
      })],
      widget: null,
      supportingSkillIds: [],
      representation: 'symbolic',
      variationTags: ['more-or-less', twoByTwo ? '2x2' : '1x3'],
      explanationNl: [`${a} × ${b} ≈ ${c.text} = ${c.value}. Precies: ${exact}, dus ${answer} dan ${benchmark}.`],
      hintsNl: ['Maak van de getallen passende getallen.', 'Wordt je schatting groter of kleiner dan het echte antwoord?', `Vergelijk met ${benchmark}.`],
      fingerprint: `mulest-ml:${a}x${b}:${benchmark}`,
    })
  }
  if (form === 'match') {
    const c = canonicalEstimate(a, b)
    const distractors = [c.value * 10, Math.max(1, c.value / 10), c.value * 2].map(String)
    return makeExercise(ctx, rng, {
      archetypeId: 'mul-estimate-match',
      instructionNl: 'Welke schatting hoort bij welke som?',
      steps: [choiceStep({
        id: 'match', prompt: `${a} × ${b} ≈`, skill: ctx.primarySkillId, options: shuffleOptions(rng, String(c.value), distractors), answer: String(c.value),
        solution: `${a} × ${b} ≈ ${c.text} = ${c.value}`,
      })],
      widget: null,
      supportingSkillIds: [],
      representation: 'symbolic',
      variationTags: ['match-estimate', twoByTwo ? '2x2' : '1x3'],
      explanationNl: [`${a} × ${b} ≈ ${c.text} = ${c.value}.`],
      hintsNl: ['Rond de getallen af.', 'Reken met de ronde getallen.', 'Tel de nullen goed.'],
      fingerprint: `mulest-mt:${a}x${b}`,
    })
  }
  const steps = [
    ...(isSupported(ctx) ? [choiceStep({
      id: 'friendly', prompt: `Welk passend getal kies je voor ${a}?`, skill: ctx.primarySkillId, role: 'supporting' as const,
      options: shuffleOptions(rng, String(friendlyValues(a)[0]), [String(a), String(a + 100), String(Math.max(1, Math.floor(a / 10)))]),
      answer: String(friendlyValues(a)[0]), solution: `${a} ≈ ${friendlyValues(a)[0]}`, reveals: false,
    })] : []),
    estimateFor('estimate', a, b, ctx.primarySkillId, exact),
  ].map((s) => (s.id === 'estimate' ? { ...s, skillTarget: { skillId: ctx.primarySkillId, role: 'primary' as const } } : s))
  return makeExercise(ctx, rng, {
    archetypeId: 'mul-estimate',
    instructionNl: BOOK.schatHetAntwoord,
    steps,
    widget: null,
    supportingSkillIds: ['NUM.ROUND.Hundred'],
    representation: 'symbolic',
    variationTags: [twoByTwo ? '2x2' : '1x3', 'type-estimate'],
    explanationNl: [`${a} × ${b} ≈ ${canonicalEstimate(a, b).text} = ${canonicalEstimate(a, b).value}. (Precies is het ${exact}.)`, 'Het teken ≈ betekent: is ongeveer.'],
    hintsNl: ['Bij het schatten gebruik je passende getallen waarmee je makkelijk kunt rekenen.', `Maak van ${a} een rond getal.`, 'Reken dan uit je hoofd.'],
    fingerprint: `mulest:${a}x${b}`,
  })
}

// ---- Stories with the 4-step plan (blok 2.1 lesson 4, 2.3 lesson 14) ----

interface MulStory { text: string; sum: string; wrongSums: string[]; a: number; b: number; answer: number; unit: string; twoStep: boolean }

function mulStory(ctx: GeneratorContext, rng: SeededRng): MulStory {
  const k = rng.int(0, ctx.band === 'easier' ? 3 : 6)
  const tens = rng.int(2, 9) * 10
  switch (k) {
    case 0: { const n = rng.int(3, 6); const l = rng.int(205, 395); return { text: `Bij de school van Kim staan ${n} regentonnen. In elke ton kan ${l} liter water. Hoeveel water kan in totaal in deze tonnen?`, sum: `${n} × ${l}`, wrongSums: [`${n} + ${l}`, `${l} − ${n}`], a: n, b: l, answer: n * l, unit: 'liter', twoStep: false } }
    case 1: { const n = rng.int(3, 8); const g = rng.int(11, 29) * 5; return { text: `Een peer weegt ongeveer ${g} gram. Hoeveel wegen ${n} peren?`, sum: `${n} × ${g}`, wrongSums: [`${g} + ${n}`, `${g} : ${n}`], a: n, b: g, answer: n * g, unit: 'gram', twoStep: false } }
    case 2: { const n = rng.int(3, 9); const p = rng.int(119, 299); return { text: `Er worden ${n} bankjes gekocht. Een bankje kost € ${p}. Hoe hoog is de rekening?`, sum: `${n} × ${p}`, wrongSums: [`${n} + ${p}`, `${p} − ${n}`], a: n, b: p, answer: n * p, unit: 'euro', twoStep: false } }
    case 3: { const per = rng.int(12, 48); return { text: `Lars haalt potloden uit het magazijn. In een doosje zitten ${per} potloden. Hij haalt ${tens} doosjes. Hoeveel potloden haalt Lars?`, sum: `${tens} × ${per}`, wrongSums: [`${tens} + ${per}`, `${tens} : ${per}`], a: tens, b: per, answer: tens * per, unit: 'potloden', twoStep: false } }
    case 4: { const groups = rng.int(4, 6); const kids = rng.int(3, 5); const each = rng.int(8, 15); return { text: `De klas heeft ${groups} tafelgroepjes. Aan elk groepje zitten ${kids} kinderen. Elk kind krijgt ${each} stiften. Hoeveel stiften zijn dat in totaal?`, sum: `${groups} × ${kids} × ${each}`, wrongSums: [`${groups} + ${kids} + ${each}`, `${groups} × ${kids} + ${each}`], a: groups * kids, b: each, answer: groups * kids * each, unit: 'stiften', twoStep: true } }
    case 5: { const n1 = rng.int(3, 8); const w1 = rng.int(40, 95) * 5; const n2 = rng.int(3, 8); const w2 = rng.int(40, 95) * 5; return { text: `Daoud tilt ${n1} rekenboeken van elk ${w1} gram. Sem tilt ${n2} woordenboeken van elk ${w2} gram. Hoeveel gram tillen ze samen?`, sum: `${n1} × ${w1} + ${n2} × ${w2}`, wrongSums: [`${n1} + ${n2} × ${w1}`, `${w1} + ${w2}`], a: n1, b: w1, answer: n1 * w1 + n2 * w2, unit: 'gram', twoStep: true } }
    default: { const laps = rng.int(12, 24); const len = rng.pick([25, 50]); return { text: `Sanne zwemt ${laps} baantjes van ${len} meter. Hoeveel meter heeft ze gezwommen?`, sum: `${laps} × ${len}`, wrongSums: [`${laps} + ${len}`, `${len} − ${laps}`], a: laps, b: len, answer: laps * len, unit: 'meter', twoStep: false } }
  }
}

function fourStep(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const s = mulStory(ctx, rng)
  const c = canonicalEstimate(s.a, s.b)
  const estimateOk = !s.twoStep
  const steps: GeneratedStep[] = isSupported(ctx)
    ? [
        choiceStep({ id: 'sum', prompt: 'Stap 2: Wat moet je uitrekenen?', skill: 'META.EQUATION.Select', role: 'supporting', options: shuffleOptions(rng, s.sum, s.wrongSums), answer: s.sum, solution: s.sum, reveals: false }),
        ...(estimateOk ? [estimateFor('estimate', s.a, s.b, 'MUL.ESTIMATE.Friendly', s.a * s.b)] : []),
        intStep({ id: 'answer', prompt: `Stap 3: Wat is je antwoord? (in ${s.unit})`, skill: ctx.primarySkillId, answer: s.answer, unit: s.unit, solution: `${s.sum} = ${s.answer} ${s.unit}` }),
        choiceStep({ id: 'check', prompt: 'Stap 4: Klopt je antwoord?', skill: 'META.CHECK.EstimateInverse', role: 'supporting', options: ['Ja, het ligt in de buurt van de schatting', 'Nee, het is veel te groot of te klein'], answer: 'Ja, het ligt in de buurt van de schatting', solution: 'Het antwoord ligt in de buurt van de schatting. Het klopt.', reveals: false }),
      ]
    : [
        ...(estimateOk && !isTestFormat(ctx) ? [estimateFor('estimate', s.a, s.b, 'MUL.ESTIMATE.Friendly', s.a * s.b)] : []),
        intStep({
          id: 'answer', prompt: 'Schrijf je berekening op. Wat is je antwoord?', skill: ctx.primarySkillId, answer: s.answer, unit: s.unit, solution: `${s.sum} = ${s.answer} ${s.unit}`,
          wrong: (v) => (v === s.a + s.b ? { feedbackNl: 'Zijn het gelijke groepjes? Dan is het een keersom.', misconceptionId: 'MC.CONTEXT.AddInsteadOfMultiply' } : 'Wat moet je uitrekenen? Schrijf de som op en controleer met een schatting.'),
        }),
      ]
  return makeExercise(ctx, rng, {
    archetypeId: 'mul-four-step',
    instructionNl: `${isSupported(ctx) ? BOOK.stappenplan : BOOK.schrijfBerekening} ${s.text}`,
    steps,
    widget: null,
    supportingSkillIds: ['META.EQUATION.Select'],
    representation: 'story',
    variationTags: [s.twoStep ? 'two-step' : 'single-step'],
    explanationNl: [`${s.sum} = ${s.answer} ${s.unit}.`, ...(estimateOk ? [`Schatting: ${c.text} = ${c.value}. Het antwoord ligt in de buurt van de schatting.`] : [])],
    hintsNl: ['Stap 1: maak een tekening. Wat weet je, wat zoek je?', 'Stap 2: zijn het gelijke groepjes? Dan is het een keersom.', 'Stap 4: schat en controleer of je antwoord in de buurt ligt.'],
    fingerprint: `mulstory:${s.text}`,
  })
}

export function generateMultiplication(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  switch (ctx.primarySkillId) {
    case 'MUL.SCALE.OneFactor': return scaleOne(ctx, rng)
    case 'MUL.SCALE.TwoFactors': return scaleTwo(ctx, rng)
    case 'MUL.SPLIT.Distribute': return distribute(ctx, rng)
    case 'MUL.COLUMN.PartialProducts': return partialProducts(ctx, rng)
    case 'MUL.COLUMN.Carry': return columnCarry(ctx, rng)
    case 'MUL.COLUMN.TensFactor': return tensFactor(ctx, rng)
    case 'MUL.ESTIMATE.Friendly': return estimate(ctx, rng)
    case 'MUL.CONTEXT.FourStep': return fourStep(ctx, rng)
    default: throw new Error(`multiplication: unsupported skill ${ctx.primarySkillId}`)
  }
}

export const MULTIPLICATION_SKILLS = [
  'MUL.SCALE.OneFactor', 'MUL.SCALE.TwoFactors', 'MUL.SPLIT.Distribute', 'MUL.COLUMN.PartialProducts',
  'MUL.COLUMN.Carry', 'MUL.COLUMN.TensFactor', 'MUL.ESTIMATE.Friendly', 'MUL.CONTEXT.FourStep',
]
