/**
 * Rekenen met geld, blok 2.2 (Getal & Ruimte Junior groep 6, lessons 6–9
 * and Test jezelf items 9–11). Amounts are integer cents; the book's
 * notation "€ 24,13" is presentation only.
 *  - MONEY.VALUE.Denomination: "Welk bedrag is het?" for a few coins
 *  - MONEY.NOTATION.EuroCent: "34 euro en 5 cent =", "Wat is de 3 waard in € 25,37?"
 *  - MONEY.PAY.Exact / Minimal: "Betaal gepast.", "Verdeel het bedrag. Gebruik zo min mogelijk …"
 *  - MONEY.CALC.Add / Subtract: "Zet onder elkaar en reken uit. Schat eerst het antwoord."
 *  - MONEY.CONTEXT.DiscountShortfall: korting, statiegeld, sparen
 *  - MONEY.ESTIMATE.Total: "Hoeveel is het samen ongeveer? Rond af op hele euro's."
 *  - MONEY.CONTEXT.Budget: "Heb je genoeg aan € 20?"
 */
import type { GeneratedExercise, GeneratedStep } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { DENOMINATIONS_CENTS, denominationLabel, greedyBreakdown, parseMoneyCents } from '../domain/units'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { byBand, choiceStep, countsStep, euro, intStep, isSupported, makeExercise, moneyStep, roundTo, shuffleOptions } from './kit'

const cents2 = (c: number) => `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`

/** An estimate in euros: any of the accepted amounts counts. */
function moneyEstimateStep(id: string, prompt: string, skill: string, accepted: number[], canonical: number, how: string, exact: number, role: 'primary' | 'supporting' = 'supporting'): GeneratedStep {
  const ok = new Set(accepted)
  return {
    id, promptNl: prompt, answerType: { kind: 'money', unit: 'euro-comma' },
    solutionNl: how, skillTarget: { skillId: skill, role }, revealsAnswer: true, expected: cents2(canonical),
    validate: (raw) => {
      const v = parseMoneyCents(String(raw))
      if (v === null) return { isCorrect: false, feedbackNl: 'Schrijf een bedrag, bijvoorbeeld 39 of 39,00.', misconceptionId: null, invalidFormat: true }
      if (ok.has(v)) return { isCorrect: true, feedbackNl: `Goede schatting: ${how}`, misconceptionId: null }
      if (v === exact) return { isCorrect: false, feedbackNl: "Dat is precies. Bij schatten rond je eerst af op hele euro's.", misconceptionId: 'MC.EST.ComputedExactly' }
      return { isCorrect: false, feedbackNl: "Rond elk bedrag af op hele euro's en tel dan op.", misconceptionId: null }
    },
  }
}

function wholeEuroEstimates(amounts: number[], op: '+' | '−' = '+'): number[] {
  const combine = (vals: number[]) => vals.slice(1).reduce((acc, v) => (op === '+' ? acc + v : acc - v), vals[0]!)
  const exact = combine(amounts)
  return [...new Set([combine(amounts.map((a) => roundTo(a, 100))), roundTo(exact, 100), combine(amounts.map((a) => roundTo(a, 1000)))])]
}

function randomCents(rng: SeededRng, minEuro: number, maxEuro: number, step = 5): number {
  return rng.int(minEuro, maxEuro) * 100 + rng.int(0, Math.floor(99 / step)) * step
}

// ---- Denominations and notation ----

function denomination(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const pool = byBand(ctx.band, { easier: [200, 100, 50, 20, 10], standard: [500, 200, 100, 50, 20, 10, 5], harder: [1000, 500, 200, 100, 50, 20, 10, 5, 2] })
  const kinds = rng.shuffle(pool).slice(0, byBand(ctx.band, { easier: 2, standard: 3, harder: 4 }))
  const coins = kinds.map((value) => ({ value, count: rng.int(1, ctx.band === 'easier' ? 3 : 5) }))
  const total = coins.reduce((s, c) => s + c.value * c.count, 0)
  const listed = coins.map((c) => `${c.count} × ${denominationLabel(c.value)}`).join(' + ')
  return makeExercise(ctx, rng, {
    archetypeId: 'money-count',
    instructionNl: BOOK.welkBedrag,
    steps: [moneyStep({
      id: 'total', prompt: isSupported(ctx) ? `${listed} =` : 'Hoeveel geld is dit samen?', skill: ctx.primarySkillId, cents: total, solution: `${listed} = ${euro(total)}`,
      wrong: (v) => (v === coins.reduce((s, c) => s + c.count, 0) * 100 ? 'Je telde de munten, niet hun waarde. Wat is elke munt waard?' : null),
    })],
    widget: { type: 'coins', props: { items: coins } },
    supportingSkillIds: [],
    representation: 'pictorial',
    variationTags: ['collection'],
    explanationNl: [`${listed} = ${euro(total)}. Een grote munt is niet altijd meer waard: kijk naar het getal.`],
    hintsNl: ['Begin bij de munt die het meest waard is.', 'Reken per soort: aantal × waarde.', 'Tel de bedragen bij elkaar op.'],
    fingerprint: `denom:${coins.map((c) => `${c.count}x${c.value}`).join('+')}`,
  })
}

function notation(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const form = ctx.variant === 'digit-value' ? 'digit-value'
    : isSupported(ctx) ? rng.pick(['words', 'cents', 'split'] as const)
    : rng.pick(['words', 'words', 'cents', 'split', 'digit-value', 'digit-value'] as const)
  const euros = byBand(ctx.band, { easier: rng.int(1, 20), standard: rng.int(5, 99), harder: rng.int(10, 299) })
  const leading = rng.bool(0.4)
  const c = leading ? rng.int(1, 9) : rng.int(10, 99)
  const amount = euros * 100 + c
  if (form === 'words') {
    return makeExercise(ctx, rng, {
      archetypeId: 'money-words',
      instructionNl: BOOK.schrijfAlsBedrag,
      steps: [moneyStep({
        id: 'amount', prompt: `${euros} euro en ${c} cent =`, skill: ctx.primarySkillId, cents: amount, solution: euro(amount),
        wrong: (v) => (v === euros * 100 + c * 10 ? { feedbackNl: `${c} cent schrijf je met twee cijfers achter de komma: ${String(c).padStart(2, '0')}.`, misconceptionId: 'MC.MONEY.LeadingZero' } : null),
      })],
      widget: null, supportingSkillIds: [], representation: 'symbolic',
      variationTags: [c < 10 ? 'leading-zero' : 'comma-format'],
      explanationNl: [`Voor de komma staan de hele euro's (${euros}), achter de komma de centen (${String(c).padStart(2, '0')}): ${euro(amount)}.`],
      hintsNl: ["Voor de komma staan de hele euro's.", 'Achter de komma staan altijd twee cijfers voor de centen.', '5 cent schrijf je als ,05.'],
      fingerprint: `mwords:${amount}`,
    })
  }
  if (form === 'cents') {
    const total = rng.int(105, ctx.band === 'easier' ? 999 : 9999)
    return makeExercise(ctx, rng, {
      archetypeId: 'money-cents',
      instructionNl: BOOK.schrijfAlsBedrag,
      steps: [moneyStep({
        id: 'amount', prompt: `${total} cent =`, skill: ctx.primarySkillId, cents: total, solution: `100 cent is € 1,00, dus ${total} cent = ${euro(total)}`,
        wrong: (v) => (v === total * 100 ? '100 cent is 1 euro. Hoeveel hele euro’s zitten er in?' : null),
      })],
      widget: null, supportingSkillIds: ['PV.SCALE.TenHundred'], representation: 'symbolic',
      variationTags: [total % 100 < 10 ? 'leading-zero' : 'comma-format'],
      explanationNl: [`100 cent = € 1,00. ${total} cent = ${euro(total)}.`],
      hintsNl: ['1 cent is € 0,01, 10 cent is € 0,10, 100 cent is € 1,00.', 'Hoeveel keer 100 cent past erin?', 'De rest zijn de centen achter de komma.'],
      fingerprint: `mcents:${total}`,
    })
  }
  if (form === 'split') {
    return makeExercise(ctx, rng, {
      archetypeId: 'money-split',
      instructionNl: `${BOOK.vulIn} Voor de komma staan de hele euro's. Achter de komma staan de centen.`,
      steps: [
        intStep({ id: 'euros', prompt: `${euro(amount)} is … euro`, skill: ctx.primarySkillId, answer: euros, solution: `${euros} euro` }),
        intStep({ id: 'cents', prompt: `en … cent`, skill: ctx.primarySkillId, answer: c, solution: `${c} cent` }),
      ],
      widget: null, supportingSkillIds: [], representation: 'symbolic',
      variationTags: [c < 10 ? 'leading-zero' : 'comma-format'],
      explanationNl: [`${euro(amount)} is ${euros} euro en ${c} cent.`],
      hintsNl: ['Kijk naar de komma.', "Links van de komma: hele euro's.", 'Rechts van de komma: centen.'],
      fingerprint: `msplit:${amount}`,
    })
  }
  // "Wat is de 3 waard in: € 25,37" → € 0,30 (Test jezelf item 9).
  const s = String(amount).padStart(3, '0')
  const positions = s.split('').map((d, i) => ({ d: Number(d), value: Number(d) * 10 ** (s.length - 1 - i) })).filter((p) => p.d > 0)
  const unique = positions.filter((p) => positions.filter((q) => q.d === p.d).length === 1)
  const pick = rng.pick(unique.length > 0 ? unique : positions)
  return makeExercise(ctx, rng, {
    archetypeId: 'money-digit-value',
    instructionNl: BOOK.schrijfOp,
    steps: [moneyStep({
      id: 'value', prompt: `Wat is de ${pick.d} waard in: ${euro(amount)}`, skill: ctx.primarySkillId, cents: pick.value, solution: `${euro(pick.value)} (${pick.value >= 100 ? `${pick.value / 100} euro` : `${pick.value} cent`})`,
      wrong: (v) => (v === pick.d * 100 && pick.value !== v ? `Staat de ${pick.d} voor of achter de komma?` : null),
    })],
    widget: null, supportingSkillIds: ['PV.DHTE.Identify'], representation: 'symbolic',
    variationTags: ['digit-value', 'comma-format'],
    explanationNl: [`In ${euro(amount)} is de ${pick.d} ${euro(pick.value)} waard.`],
    hintsNl: ["Voor de komma: tientallen euro's en euro's.", 'Achter de komma: eerst de dubbeltjes (10 cent), dan de centen.', 'Schrijf de waarde als bedrag, bijvoorbeeld € 0,30.'],
    fingerprint: `mdigit:${amount}:${pick.value}`,
  })
}

// ---- Paying ----

function payLabels(amount: number): { labels: string[]; values: Record<string, number> } {
  const values: Record<string, number> = {}
  for (const d of DENOMINATIONS_CENTS) {
    if (d <= amount && d >= 5) values[denominationLabel(d)] = d
  }
  return { labels: Object.keys(values), values }
}

function payExact(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  // Spaarpot: counting a collection is the other direction of paying exactly.
  if (!isSupported(ctx) && rng.bool(0.35)) {
    const parts = rng.shuffle([500, 200, 100, 50, 20, 10]).slice(0, 4).map((v) => ({ v, n: rng.int(1, 8) }))
    const total = parts.reduce((s, p) => s + p.v * p.n, 0)
    const words = parts.map((p) => `${p.n} ${p.v >= 500 ? (p.n === 1 ? 'briefje' : 'briefjes') : p.n === 1 ? 'munt' : 'munten'} van ${euro(p.v)}`)
    return makeExercise(ctx, rng, {
      archetypeId: 'money-collection',
      instructionNl: BOOK.rekenUit,
      steps: [moneyStep({ id: 'total', prompt: `Judit telt haar spaarpot: ${words.join(', ')}. Hoeveel geld zit er in de spaarpot?`, skill: ctx.primarySkillId, cents: total, solution: parts.map((p) => `${p.n} × ${euro(p.v)}`).join(' + ') + ` = ${euro(total)}` })],
      widget: null, supportingSkillIds: [], representation: 'story',
      variationTags: ['count-collection'],
      explanationNl: [parts.map((p) => `${p.n} × ${euro(p.v)} = ${euro(p.n * p.v)}`).join('; ') + `. Samen ${euro(total)}.`],
      hintsNl: ['Reken per soort: aantal × waarde.', 'Schrijf de tussenbedragen onder elkaar.', 'Tel ze op.'],
      fingerprint: `collect:${parts.map((p) => `${p.n}x${p.v}`).join('+')}`,
    })
  }
  const amount = byBand(ctx.band, { easier: randomCents(rng, 1, 9, 5), standard: randomCents(rng, 10, 99, 5), harder: randomCents(rng, 100, 299, 5) })
  const { labels, values } = payLabels(amount)
  const greedy = Object.fromEntries(greedyBreakdown(amount).map(({ denom, count }) => [denominationLabel(denom), count]))
  return makeExercise(ctx, rng, {
    archetypeId: 'pay-exact',
    instructionNl: BOOK.betaalGepast,
    steps: [countsStep({
      id: 'pay', prompt: `${euro(amount)} = (hoeveel van elk?)`, skill: ctx.primarySkillId, labels, expected: greedy,
      solution: greedyBreakdown(amount).map(({ denom, count }) => `${count} × ${denominationLabel(denom)}`).join(' + '),
      accept: (counts) => {
        const sum = labels.reduce((s, l) => s + (counts[l] ?? 0) * values[l]!, 0)
        return sum === amount ? true : `Jouw munten en biljetten zijn samen ${euro(sum)}. Dat is ${sum > amount ? 'te veel' : 'te weinig'}.`
      },
    })],
    widget: null, supportingSkillIds: ['MONEY.VALUE.Denomination'], representation: 'symbolic',
    variationTags: ['exact'],
    explanationNl: [`Bijvoorbeeld: ${greedyBreakdown(amount).map(({ denom, count }) => `${count} × ${denominationLabel(denom)}`).join(' + ')} = ${euro(amount)}.`],
    hintsNl: ['Begin met het grootste briefje dat past.', 'Kijk wat er nog over is en pak weer de grootste munt die past.', 'Tel aan het eind alles op: is het precies het bedrag?'],
    fingerprint: `payx:${amount}`,
  })
}

function payMinimal(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const amount = byBand(ctx.band, { easier: randomCents(rng, 2, 19, 5), standard: randomCents(rng, 20, 99, 1), harder: randomCents(rng, 100, 499, 1) })
  const { labels, values } = payLabels(Math.max(amount, 1))
  // 1 and 2 cent coins only when the amount needs them.
  for (const d of [2, 1]) if (amount % 5 !== 0 && d <= amount) { values[denominationLabel(d)] = d; labels.push(denominationLabel(d)) }
  const breakdown = greedyBreakdown(amount)
  const minimal = breakdown.reduce((s, b) => s + b.count, 0)
  return makeExercise(ctx, rng, {
    archetypeId: 'pay-minimal',
    instructionNl: BOOK.verdeelBedrag,
    steps: [countsStep({
      id: 'pay', prompt: `${euro(amount)} =`, skill: ctx.primarySkillId, labels,
      expected: Object.fromEntries(breakdown.map(({ denom, count }) => [denominationLabel(denom), count])),
      solution: breakdown.map(({ denom, count }) => `${count} × ${denominationLabel(denom)}`).join(' + '),
      accept: (counts) => {
        const sum = labels.reduce((s, l) => s + (counts[l] ?? 0) * values[l]!, 0)
        if (sum !== amount) return `Eerst moet het bedrag kloppen: jij hebt ${euro(sum)}.`
        const used = labels.reduce((s, l) => s + (counts[l] ?? 0), 0)
        return used === minimal ? true : `Het bedrag klopt! Maar het kan met minder: jij gebruikt ${used} stuks, het kan met ${minimal}. Ruil kleine munten voor een grotere.`
      },
    })],
    widget: null, supportingSkillIds: ['MONEY.PAY.Exact'], representation: 'symbolic',
    variationTags: ['equality-first'],
    explanationNl: [`${breakdown.map(({ denom, count }) => `${count} × ${denominationLabel(denom)}`).join(' + ')} = ${euro(amount)}: ${minimal} stuks.`],
    hintsNl: ['Begin met het grootste briefje of de grootste munt die past.', 'Neem er zoveel van als kan, ga dan naar de volgende.', 'Controleer: klopt het bedrag precies?'],
    fingerprint: `paymin:${amount}`,
  })
}

// ---- Adding and subtracting amounts (lesson 8; Test jezelf item 10) ----

function calc(ctx: GeneratorContext, rng: SeededRng, sub: boolean): GeneratedExercise {
  let a = 0
  let b = 0
  const regroup = ctx.band !== 'easier'
  for (let i = 0; i < 300; i++) {
    a = randomCents(rng, byBand(ctx.band, { easier: 2, standard: 5, harder: 10 }), byBand(ctx.band, { easier: 30, standard: 99, harder: 250 }), 5)
    b = randomCents(rng, 1, byBand(ctx.band, { easier: 20, standard: 60, harder: 120 }), 5)
    if (sub) {
      // Subtracting from a round note: "€ 100,00 − € 2,25" is in the test.
      if (ctx.band === 'harder' && rng.bool(0.4)) a = rng.pick([1000, 2000, 5000, 10000])
      if (a <= b) continue
      if (regroup === (a % 100 < b % 100)) break
    } else if (regroup === ((a % 100) + (b % 100) >= 100)) break
  }
  const result = sub ? a - b : a + b
  const op = sub ? '−' : '+'
  const estimates = wholeEuroEstimates([a, b], sub ? '−' : '+')
  const canonical = sub ? roundTo(a, 100) - roundTo(b, 100) : roundTo(a, 100) + roundTo(b, 100)
  const book = !isSupported(ctx)
  const ca = a % 100
  const cb = b % 100
  const steps: GeneratedStep[] = book
    ? [
        moneyEstimateStep('estimate', `${euro(a)} ${op} ${euro(b)} ≈`, 'MONEY.ESTIMATE.Total', estimates, canonical, `${euro(roundTo(a, 100))} ${op} ${euro(roundTo(b, 100))} = ${euro(canonical)}`, result),
        moneyStep({
          id: 'answer', prompt: `${euro(a)} ${op} ${euro(b)} =`, skill: ctx.primarySkillId, cents: result, solution: `${euro(a)} ${op} ${euro(b)} = ${euro(result)}`,
          wrong: (v) => (Math.abs(v - result) === 100 ? { feedbackNl: sub ? 'Kijk bij de centen: moest je een euro lenen?' : '100 cent is 1 euro: tel die euro erbij.', misconceptionId: sub ? 'MC.MONEY.BorrowLost' : 'MC.MONEY.CentCarryLost' } : 'Zet de komma’s recht onder elkaar en reken eerst de centen.'),
        }),
      ]
    : [
        intStep({
          id: 'cents', prompt: sub ? `Centen: ${ca} − ${cb} = … cent${ca < cb ? ' (leen 1 euro = 100 cent)' : ''}` : `Centen: ${ca} + ${cb} = … cent`, skill: ctx.primarySkillId,
          answer: sub ? (ca < cb ? ca + 100 - cb : ca - cb) : ca + cb, solution: sub ? `${ca < cb ? ca + 100 : ca} − ${cb} = ${(ca < cb ? ca + 100 : ca) - cb}` : `${ca} + ${cb} = ${ca + cb}`, reveals: false,
        }),
        moneyStep({ id: 'answer', prompt: `${euro(a)} ${op} ${euro(b)} =`, skill: ctx.primarySkillId, cents: result, solution: `${euro(a)} ${op} ${euro(b)} = ${euro(result)}` }),
      ]
  return makeExercise(ctx, rng, {
    archetypeId: sub ? 'money-subtract' : 'money-add',
    instructionNl: book ? BOOK.zetOnderElkaarSchatEerst : 'Bij optellen en aftrekken van geldbedragen moet je de komma’s recht onder elkaar zetten. Begin bij de centen.',
    steps,
    widget: book ? null : { type: 'column-grid', props: { operation: op, operands: [cents2(a), cents2(b)], money: true } },
    supportingSkillIds: [sub ? 'SUB.COLUMN.BorrowCrossout' : 'ADD.COLUMN.Carry'],
    representation: 'symbolic',
    variationTags: [sub ? (ca < cb ? 'euro-regroup' : 'no-regroup') : (ca + cb >= 100 ? 'cent-regroup' : 'no-regroup')],
    explanationNl: [`${euro(a)} ${op} ${euro(b)} = ${euro(result)}.`, `Schatting: ${euro(canonical)}. Het antwoord ligt in de buurt van de schatting.`],
    hintsNl: ['Zet de komma’s recht onder elkaar.', sub ? 'Begin bij de centen. Te weinig centen? Leen 1 euro = 100 cent.' : 'Begin bij de centen. Meer dan 100 cent? Dat is 1 euro erbij.', 'Controleer met je schatting.'],
    fingerprint: `m${sub ? 'sub' : 'add'}:${a}:${b}`,
  })
}

// ---- Stories (lesson 9) ----

function discountShortfall(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const k = rng.int(0, 3)
  let text: string
  let sum: string
  let wrongSums: string[]
  let answer: number
  if (k === 0) {
    const p1 = randomCents(rng, 3, 15, 5)
    const p2 = randomCents(rng, 2, 12, 5)
    const off = rng.pick([100, 150, 200, 250, 500])
    text = `Els koopt een zonnebril van ${euro(p1)} en badslippers van ${euro(p2)}. Ze krijgt ${euro(off)} korting. Hoeveel moet Els betalen?`
    sum = `${euro(p1)} + ${euro(p2)} − ${euro(off)}`
    wrongSums = [`${euro(p1)} + ${euro(p2)} + ${euro(off)}`, `${euro(p1)} − ${euro(p2)} − ${euro(off)}`]
    answer = p1 + p2 - off
  } else if (k === 1) {
    const goal = rng.int(40, 90) * 100
    const have = rng.int(15, goal / 100 - 5) * 100 + rng.pick([0, 50])
    text = `Timo spaart voor een waveboard van ${euro(goal)}. Hij heeft al ${euro(have)}. Hoeveel moet Timo nog sparen?`
    sum = `${euro(goal)} − ${euro(have)}`
    wrongSums = [`${euro(goal)} + ${euro(have)}`, `${euro(have)} − ${euro(goal)}`]
    answer = goal - have
  } else if (k === 2) {
    const p1 = randomCents(rng, 1, 3, 5)
    const p2 = randomCents(rng, 1, 3, 5)
    const back = rng.pick([25, 50, 75, 100, 125])
    text = `Sven koopt appels voor ${euro(p1)} en frisdrank voor ${euro(p2)}. Hij levert lege flessen in en krijgt ${euro(back)} statiegeld terug. Hoeveel moet Sven betalen?`
    sum = `${euro(p1)} + ${euro(p2)} − ${euro(back)}`
    wrongSums = [`${euro(p1)} + ${euro(p2)} + ${euro(back)}`, `${euro(p1)} − ${euro(p2)}`]
    answer = p1 + p2 - back
  } else {
    const p1 = rng.pick([800, 950, 1150])
    const p2 = rng.pick([1050, 1150, 1250])
    const fee = rng.pick([200, 250, 300])
    text = `Sacha bestelt een pizza van ${euro(p1)} en een pizza van ${euro(p2)}. Bezorgen kost ${euro(fee)}. Hoeveel moet Sacha afrekenen?`
    sum = `${euro(p1)} + ${euro(p2)} + ${euro(fee)}`
    wrongSums = [`${euro(p1)} + ${euro(p2)} − ${euro(fee)}`, `${euro(p1)} + ${euro(p2)}`]
    answer = p1 + p2 + fee
  }
  const steps: GeneratedStep[] = [
    ...(isSupported(ctx) ? [choiceStep({ id: 'sum', prompt: 'Wat moet je uitrekenen?', skill: 'META.EQUATION.Select', role: 'supporting' as const, options: shuffleOptions(rng, sum, wrongSums), answer: sum, solution: sum, reveals: false })] : []),
    moneyStep({ id: 'answer', prompt: 'Antwoord:', skill: ctx.primarySkillId, cents: answer, solution: `${sum} = ${euro(answer)}` }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'money-story',
    instructionNl: `${isSupported(ctx) ? BOOK.stappenplan : BOOK.schrijfBerekening} ${text}`,
    steps,
    widget: null,
    supportingSkillIds: ['META.EQUATION.Select'],
    representation: 'story',
    variationTags: [['discount', 'shortfall', 'deposit', 'extra-cost'][k]!],
    explanationNl: [`${sum} = ${euro(answer)}.`],
    hintsNl: ['Wat moet er betaald worden, en wat gaat eraf?', 'Korting en statiegeld maken het minder. Bezorgen maakt het meer.', 'Schrijf de som op en reken uit.'],
    fingerprint: `mstory:${text}`,
  })
}

const SHOP = ['brood', 'melk', 'kaas', 'appels', 'bananen', 'jam', 'shampoo', 'schriften', 'potloden', 'stickers', 'tijdschrift', 'pen']

function receiptItems(ctx: GeneratorContext, rng: SeededRng): Array<{ name: string; cents: number }> {
  const n = byBand(ctx.band, { easier: 2, standard: 3, harder: rng.int(4, 5) })
  return rng.shuffle(SHOP).slice(0, n).map((name) => ({ name, cents: randomCents(rng, 0, byBand(ctx.band, { easier: 6, standard: 9, harder: 14 }), 5) + 25 }))
}

function estimateTotal(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const items = receiptItems(ctx, rng)
  const exact = items.reduce((s, i) => s + i.cents, 0)
  const canonical = items.reduce((s, i) => s + roundTo(i.cents, 100), 0)
  const accepted = [...new Set([canonical, roundTo(exact, 100)])]
  return makeExercise(ctx, rng, {
    archetypeId: 'receipt-estimate',
    instructionNl: BOOK.hoeveelSamenOngeveer,
    steps: [moneyEstimateStep('estimate', items.map((i) => euro(i.cents)).join(' + ') + ' ≈', ctx.primarySkillId, accepted, canonical,
      `${items.map((i) => euro(roundTo(i.cents, 100))).join(' + ')} = ${euro(canonical)}`, exact, 'primary')],
    widget: { type: 'receipt', props: { items, showTotal: false } },
    supportingSkillIds: ['MONEY.ROUND.WholeEuro'],
    representation: 'pictorial',
    variationTags: [items.length >= 3 ? 'receipt' : 'two-items'],
    explanationNl: [`Afgerond: ${items.map((i) => `${euro(i.cents)} ≈ ${euro(roundTo(i.cents, 100))}`).join(', ')}. Samen ongeveer ${euro(canonical)}. (Precies: ${euro(exact)}.)`],
    hintsNl: ["Rond elk bedrag af op hele euro's.", 'Minder dan 50 cent naar beneden, 50 cent of meer naar boven.', 'Tel de afgeronde bedragen op.'],
    fingerprint: `rcpt:${items.map((i) => i.cents).join('+')}`,
  })
}

function budget(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const items = receiptItems(ctx, rng)
  const exact = items.reduce((s, i) => s + i.cents, 0)
  const have = roundTo(exact, 500) + rng.pick([-500, 500, 0])
  const wallet = Math.max(500, have === exact ? have + 500 : have)
  const enough = wallet >= exact
  return makeExercise(ctx, rng, {
    archetypeId: 'receipt-budget',
    instructionNl: `${BOOK.rekenUit} Heb je genoeg aan ${euro(wallet)}?`,
    steps: [
      choiceStep({ id: 'enough', prompt: `Heb je genoeg aan ${euro(wallet)}?`, skill: ctx.primarySkillId, options: ['ja', 'nee'], answer: enough ? 'ja' : 'nee', solution: `Samen ${euro(exact)}: ${enough ? 'genoeg' : 'niet genoeg'}.`, reveals: false }),
      moneyStep({
        id: 'difference', prompt: enough ? 'Hoeveel houd je over?' : 'Hoeveel kom je tekort?', skill: ctx.primarySkillId, cents: Math.abs(wallet - exact),
        solution: enough ? `${euro(wallet)} − ${euro(exact)} = ${euro(wallet - exact)}` : `${euro(exact)} − ${euro(wallet)} = ${euro(exact - wallet)}`,
      }),
    ],
    widget: { type: 'receipt', props: { items, showTotal: false } },
    supportingSkillIds: ['MONEY.CALC.Add', 'MONEY.CALC.Subtract'],
    representation: 'pictorial',
    variationTags: [enough ? 'enough' : 'not-enough'],
    explanationNl: [`Samen: ${items.map((i) => euro(i.cents)).join(' + ')} = ${euro(exact)}.`, enough ? `Je houdt ${euro(wallet - exact)} over.` : `Je komt ${euro(exact - wallet)} tekort.`],
    hintsNl: ['Schat eerst: rond af op hele euro’s.', 'Reken dan precies hoeveel het samen kost.', 'Vergelijk met het geld dat je hebt.'],
    fingerprint: `budget:${items.map((i) => i.cents).join('+')}:${wallet}`,
  })
}

export function generateMoney(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  switch (ctx.primarySkillId) {
    case 'MONEY.VALUE.Denomination': return denomination(ctx, rng)
    case 'MONEY.NOTATION.EuroCent': return notation(ctx, rng)
    case 'MONEY.PAY.Exact': return payExact(ctx, rng)
    case 'MONEY.PAY.Minimal': return payMinimal(ctx, rng)
    case 'MONEY.CALC.Add': return calc(ctx, rng, false)
    case 'MONEY.CALC.Subtract': return calc(ctx, rng, true)
    case 'MONEY.CONTEXT.DiscountShortfall': return discountShortfall(ctx, rng)
    case 'MONEY.ESTIMATE.Total': return estimateTotal(ctx, rng)
    case 'MONEY.CONTEXT.Budget': return budget(ctx, rng)
    default: throw new Error(`money: unsupported skill ${ctx.primarySkillId}`)
  }
}

export const MONEY_SKILLS = [
  'MONEY.VALUE.Denomination', 'MONEY.NOTATION.EuroCent', 'MONEY.PAY.Exact', 'MONEY.PAY.Minimal',
  'MONEY.CALC.Add', 'MONEY.CALC.Subtract', 'MONEY.CONTEXT.DiscountShortfall', 'MONEY.ESTIMATE.Total', 'MONEY.CONTEXT.Budget',
]
