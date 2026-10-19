/**
 * Foundations: equal groups, facts within 20, arrays, sharing, division
 * facts, and the addition/subtraction inverse (FND.*, MUL.GROUP.Array,
 * DIV.GROUP.EqualShare, DIV.FACT.Inverse, REL.ADD.*).
 */
import type { GeneratedExercise } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { byBand, choiceStep, intStep, isSupported, isTestFormat, makeExercise, shuffleOptions } from './kit'

const THINGS = [
  { many: 'knikkers', bag: 'zakjes' },
  { many: 'potloden', bag: 'doosjes' },
  { many: 'eieren', bag: 'dozen' },
  { many: 'stickers', bag: 'vellen' },
]

function countGroup(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const groups = byBand(ctx.band, { easier: rng.int(2, 4), standard: rng.int(3, 6), harder: rng.int(5, 9) })
  const size = byBand(ctx.band, { easier: rng.int(2, 5), standard: rng.int(3, 8), harder: rng.int(6, 9) })
  const total = groups * size
  const t = rng.pick(THINGS)
  const repeated = Array.from({ length: groups }, () => size).join(' + ')
  const steps = isSupported(ctx)
    ? [
        intStep({ id: 'groups', prompt: 'Hoeveel groepjes zie je?', skill: ctx.primarySkillId, answer: groups, solution: `${groups} groepjes`, reveals: false }),
        intStep({ id: 'total', prompt: `Er zitten ${size} in elk groepje. Hoeveel zijn het er samen?`, skill: ctx.primarySkillId, answer: total, solution: `${repeated} = ${total}` }),
      ]
    : [intStep({
        id: 'total',
        prompt: isTestFormat(ctx) ? `${repeated} =` : `Er zijn ${groups} ${t.bag} met elk ${size} ${t.many}. Hoeveel ${t.many} zijn dat samen?`,
        skill: ctx.primarySkillId, answer: total, solution: `${repeated} = ${groups} × ${size} = ${total}`,
        wrong: (v) => (v === groups + size ? 'Je telde het aantal groepjes en de grootte bij elkaar op. Tel elk groepje mee.' : null),
      })]
  return makeExercise(ctx, rng, {
    archetypeId: 'equal-groups',
    instructionNl: isSupported(ctx) ? 'Tel de groepjes. Elk groepje is even groot.' : BOOK.rekenUit,
    steps,
    widget: isSupported(ctx) ? { type: 'multiplication-array', props: { rows: groups, columns: size, split: groups, mode: 'array' } } : null,
    supportingSkillIds: [],
    representation: isSupported(ctx) ? 'pictorial' : isTestFormat(ctx) ? 'symbolic' : 'story',
    variationTags: ['equal-groups'],
    explanationNl: [`${groups} groepjes van ${size}: ${repeated} = ${total}. Dat is ook ${groups} × ${size}.`],
    hintsNl: ['Hoeveel groepjes zijn er?', `Elk groepje heeft ${size}. Tel ze één voor één bij elkaar.`, `Je kunt ook rekenen: ${groups} × ${size}.`],
    fingerprint: `group:${groups}x${size}`,
  })
}

function factWithin20(ctx: GeneratorContext, rng: SeededRng, sub: boolean): GeneratedExercise {
  // Crossing ten is the critical variation; easier items stay below it.
  const cross = ctx.band !== 'easier'
  let a = 0
  let b = 0
  for (let i = 0; i < 100; i++) {
    a = rng.int(2, 9)
    b = rng.int(2, 9)
    if (cross === a + b > 10) break
  }
  if (cross !== a + b > 10) throw new Error('fact: no pair')
  const sum = a + b
  const [x, y, answer] = sub ? [sum, b, a] : [a, b, sum]
  const op = sub ? '−' : '+'
  const toTen = sub ? x - 10 : 10 - a
  const steps = isSupported(ctx) && cross
    ? [
        intStep({ id: 'to-ten', prompt: sub ? `${x} − … = 10` : `${a} + … = 10`, skill: ctx.primarySkillId, answer: toTen, solution: sub ? `${x} − ${toTen} = 10` : `${a} + ${toTen} = 10`, reveals: false }),
        intStep({ id: 'answer', prompt: `${x} ${op} ${y} =`, skill: ctx.primarySkillId, answer, solution: sub ? `${x} − ${toTen} − ${y - toTen} = ${answer}` : `${a} + ${toTen} + ${b - toTen} = ${answer}` }),
      ]
    : [intStep({ id: 'answer', prompt: `${x} ${op} ${y} =`, skill: ctx.primarySkillId, answer, solution: `${x} ${op} ${y} = ${answer}` })]
  return makeExercise(ctx, rng, {
    archetypeId: sub ? 'sub-within-20' : 'add-within-20',
    instructionNl: isSupported(ctx) && cross ? 'Reken via de 10: eerst naar 10, dan de rest.' : BOOK.rekenUit,
    steps,
    widget: null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: cross ? ['cross-ten'] : ['within-ten'],
    explanationNl: [sub ? `${x} − ${toTen} = 10, en 10 − ${y - toTen} = ${answer}.` : `${a} + ${10 - a} = 10, en 10 + ${b - (10 - a)} = ${answer}.`],
    hintsNl: ['Ga eerst naar 10.', sub ? `Hoeveel moet je van ${x} afhalen om op 10 te komen?` : `Hoeveel moet er bij ${a} om 10 te krijgen?`, 'Doe daarna de rest van de som.'],
    fingerprint: `fact20:${x}${op}${y}`,
  })
}

function array(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const rows = rng.int(2, byBand(ctx.band, { easier: 4, standard: 6, harder: 9 }))
  const cols = rng.int(3, byBand(ctx.band, { easier: 5, standard: 8, harder: 9 }))
  const product = rows * cols
  const equation = `${rows} × ${cols}`
  const steps = [
    choiceStep({
      id: 'equation', prompt: 'Welke som hoort bij de rijen?', skill: ctx.primarySkillId, role: 'supporting',
      options: shuffleOptions(rng, equation, [`${rows} + ${cols}`, `${rows} × ${rows}`, `${cols} − ${rows}`]),
      answer: equation, solution: `${rows} rijen van ${cols}: ${equation}`, reveals: false,
      wrong: (v) => (v.includes('+') ? 'Optellen telt de rijen en de stippen in één rij op. Hoeveel stippen zijn er écht?' : null),
    }),
    intStep({ id: 'product', prompt: `${equation} =`, skill: ctx.primarySkillId, answer: product, solution: `${equation} = ${product}` }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'array',
    instructionNl: 'Hoeveel stippen zijn er? Kijk naar de rijen.',
    steps: isTestFormat(ctx) ? [steps[1]!] : steps,
    widget: { type: 'multiplication-array', props: { rows, columns: cols, split: rows, mode: 'array' } },
    supportingSkillIds: [],
    representation: 'pictorial',
    variationTags: ['array'],
    explanationNl: [`${rows} rijen met elk ${cols} stippen: ${cols} + ${cols} + … = ${equation} = ${product}.`],
    hintsNl: ['Hoeveel rijen zijn er?', 'Hoeveel stippen staan er in één rij?', `Rijen keer stippen per rij: ${equation}.`],
    fingerprint: `array:${rows}x${cols}`,
  })
}

function equalShare(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const d = rng.int(2, byBand(ctx.band, { easier: 5, standard: 8, harder: 9 }))
  const q = rng.int(2, 9)
  const N = d * q
  const t = rng.pick(THINGS)
  // Two meanings of the same division: number of groups vs size of each group.
  const askSize = rng.bool()
  const story = askSize
    ? `${N} ${t.many} worden eerlijk verdeeld over ${d} kinderen. Hoeveel krijgt elk kind?`
    : `${N} ${t.many} gaan in ${t.bag} van ${d}. Hoeveel ${t.bag} zijn dat?`
  const unit = askSize ? t.many : t.bag
  const steps = [
    ...(isSupported(ctx) ? [choiceStep({
      id: 'meaning', prompt: 'Wat zoek je?', skill: ctx.primarySkillId, role: 'supporting',
      options: [`hoeveel er in elk groepje komt`, `hoeveel groepjes er zijn`],
      answer: askSize ? 'hoeveel er in elk groepje komt' : 'hoeveel groepjes er zijn',
      solution: askSize ? 'Het aantal groepjes is bekend; je zoekt hoe groot elk groepje is.' : 'De grootte van een groepje is bekend; je zoekt het aantal groepjes.',
      reveals: false,
    })] : []),
    intStep({
      id: 'answer', prompt: isTestFormat(ctx) ? `${N} : ${d} =` : story, skill: ctx.primarySkillId, answer: q, unit: isTestFormat(ctx) ? undefined : unit,
      solution: `${N} : ${d} = ${q}, want ${q} × ${d} = ${N}`,
      wrong: (v) => (v === N * d ? 'Bij eerlijk delen wordt het minder, niet meer.' : null),
    }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'equal-share',
    instructionNl: isTestFormat(ctx) ? BOOK.rekenUit : isSupported(ctx) ? story : BOOK.rekenUit,
    steps,
    widget: isSupported(ctx) ? { type: 'division-groups', props: { total: N, groupSize: q, mode: 'grouped' } } : null,
    supportingSkillIds: [],
    representation: isTestFormat(ctx) ? 'symbolic' : 'story',
    variationTags: [askSize ? 'partitive' : 'quotitive'],
    explanationNl: [`${N} : ${d} = ${q}. Controle: ${q} × ${d} = ${N}.`],
    hintsNl: ['Wat weet je al: het aantal groepjes, of hoe groot elk groepje is?', `Welk getal keer ${d} is ${N}?`, `Denk aan de tafel van ${d}.`],
    fingerprint: `share:${N}:${d}:${askSize ? 'size' : 'groups'}`,
  })
}

function divisionFact(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const d = rng.int(2, 10)
  const q = rng.int(2, 10)
  const N = d * q
  const missing = ctx.band !== 'easier' && rng.bool(0.4)
  const step = missing
    ? intStep({ id: 'answer', prompt: `… × ${d} = ${N}`, skill: ctx.primarySkillId, answer: q, solution: `${q} × ${d} = ${N}` })
    : intStep({
        id: 'answer', prompt: `${N} : ${d} =`, skill: ctx.primarySkillId, answer: q, solution: `${N} : ${d} = ${q}, want ${q} × ${d} = ${N}`,
        wrong: (v) => (v * d !== N && v === N - d ? 'Bij delen kijk je hoe vaak de deler erin past. Welke keersom hoort erbij?' : null),
      })
  return makeExercise(ctx, rng, {
    archetypeId: 'division-fact',
    instructionNl: isSupported(ctx) ? `Gebruik de tafel van ${d}: welk getal keer ${d} is ${N}?` : BOOK.rekenUit,
    steps: [step],
    widget: isSupported(ctx) ? { type: 'multiplication-array', props: { rows: q, columns: d, split: Math.min(5, q), mode: 'array' } } : null,
    supportingSkillIds: [`MUL.FACT.T${d}`],
    representation: 'symbolic',
    variationTags: [missing ? 'missing-factor' : 'quotient'],
    explanationNl: [`${q} × ${d} = ${N}, dus ${N} : ${d} = ${q}.`],
    hintsNl: [`Zeg de tafel van ${d} op.`, `Welk getal keer ${d} is ${N}?`, `Delen is de omgekeerde som van keer.`],
    fingerprint: `divfact:${N}:${d}:${missing ? 'm' : 'q'}`,
  })
}

function inverse(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const a = byBand(ctx.band, { easier: rng.int(11, 60), standard: rng.int(120, 480), harder: rng.int(1200, 4800) })
  const b = byBand(ctx.band, { easier: rng.int(11, 39), standard: rng.int(110, 499), harder: rng.int(1100, 4999) })
  const c = a + b
  const takeA = rng.bool()
  const given = takeA ? a : b
  const answer = takeA ? b : a
  return makeExercise(ctx, rng, {
    archetypeId: 'add-sub-inverse',
    instructionNl: isSupported(ctx) ? 'Een plus-som en een min-som horen bij elkaar.' : BOOK.vulIn,
    steps: [intStep({
      id: 'answer', prompt: `${a} + ${b} = ${c}, dus ${c} − ${given} =`, skill: ctx.primarySkillId, answer,
      solution: `${c} − ${given} = ${answer}`,
      wrong: (v) => (v === c + given ? 'Bij min wordt het kleiner. Welk deel blijft er over?' : null),
    })],
    widget: isSupported(ctx) ? { type: 'bar-model', props: { total: c, parts: [a, b], unknown: null } } : null,
    supportingSkillIds: [],
    representation: isSupported(ctx) ? 'pictorial' : 'symbolic',
    variationTags: ['inverse'],
    explanationNl: [`${c} bestaat uit ${a} en ${b}. Haal je ${given} weg, dan blijft ${answer} over.`],
    hintsNl: ['Het hele stuk is de uitkomst van de plus-som.', `Welk deel blijft er over als je ${given} weghaalt?`, `Je hoeft niets uit te rekenen: kijk naar de plus-som.`],
    fingerprint: `inverse:${a}+${b}:${given}`,
  })
}

function missingPart(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  // The book's two forms: "265 + … = 500" and the number pyramids
  // ("Vul de trappen in.").
  if (ctx.band !== 'easier' && rng.bool(0.5)) {
    const base = [rng.int(60, 300), rng.int(60, 300), rng.int(60, 300), rng.int(60, 300)]
    const mid = [base[0]! + base[1]!, base[1]! + base[2]!, base[2]! + base[3]!]
    const upper = [mid[0]! + mid[1]!, mid[1]! + mid[2]!]
    const top = upper[0]! + upper[1]!
    // Hide one bottom brick: she works it out from the brick above.
    const hide = rng.int(0, 2)
    const shownBase = base.map((v, i) => (i === hide ? null : v))
    const answer = base[hide]!
    const above = mid[hide]!
    const neighbour = base[hide + 1]!
    return makeExercise(ctx, rng, {
      archetypeId: 'pyramid',
      instructionNl: `${BOOK.vulTrappen} Twee stenen naast elkaar zijn samen de steen erboven.`,
      steps: [
        intStep({
          id: 'missing', prompt: `Welk getal hoort in de lege onderste steen? (… + ${neighbour} = ${above})`, skill: ctx.primarySkillId, answer,
          solution: `${above} − ${neighbour} = ${answer}`,
          wrong: (v) => (v === above + neighbour ? 'De steen erboven is de som. Het ontbrekende deel is kleiner.' : null),
        }),
        intStep({ id: 'top', prompt: 'Welk getal staat in de bovenste steen?', skill: ctx.primarySkillId, answer: top, solution: `${upper[0]} + ${upper[1]} = ${top}` }),
      ],
      widget: { type: 'pyramid', props: { rows: [shownBase, mid.map((v, i) => (i === hide ? v : v)), [null, null], [null]] } },
      supportingSkillIds: ['ADD.COLUMN.Carry'],
      representation: 'pictorial',
      variationTags: ['inverse-verification', 'pyramid'],
      explanationNl: [`${above} − ${neighbour} = ${answer}. Controle: ${answer} + ${neighbour} = ${above}.`, `Bovenaan: ${top}.`],
      hintsNl: ['Twee stenen naast elkaar zijn samen de steen erboven.', `Welk getal plus ${neighbour} is ${above}?`, 'Reken met min: steen erboven − de buursteen.'],
      fingerprint: `pyramid:${base.join('-')}:${hide}`,
    })
  }
  const target = rng.pick(ctx.band === 'easier' ? [100, 100, 500] : [500, 1000])
  const part = rng.int(Math.floor(target * 0.2), Math.floor(target * 0.8))
  const answer = target - part
  const subtract = rng.bool(0.3)
  const prompt = subtract ? `${target + answer} − … = ${target}` : `${part} + … = ${target}`
  return makeExercise(ctx, rng, {
    archetypeId: 'missing-part',
    instructionNl: isSupported(ctx) ? 'Welk getal ontbreekt? Tel door tot het ronde getal.' : BOOK.vulOntbrekende,
    steps: [intStep({
      id: 'missing', prompt, skill: ctx.primarySkillId, answer,
      solution: subtract ? `${target + answer} − ${answer} = ${target}` : `${part} + ${answer} = ${target}`,
      wrong: (v) => (v === target + part ? 'Het ontbrekende deel is kleiner dan het eindgetal.' : null),
    })],
    widget: isSupported(ctx) ? { type: 'bar-model', props: { total: subtract ? target + answer : target, parts: subtract ? [target, answer] : [part, answer], unknown: 1 } } : null,
    supportingSkillIds: [],
    representation: isSupported(ctx) ? 'pictorial' : 'symbolic',
    variationTags: ['inverse-verification', 'missing-addend'],
    explanationNl: [subtract ? `${target + answer} − ${target} = ${answer}.` : `${target} − ${part} = ${answer}. Controle: ${part} + ${answer} = ${target}.`],
    hintsNl: ['Tel door tot een rond getal en dan verder.', subtract ? `Hoeveel moet er af om op ${target} te komen?` : `Van ${part} naar ${target}: hoeveel is dat?`, 'Controleer met een plus-som.'],
    fingerprint: `missing:${prompt}`,
  })
}

export function generateFacts(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  switch (ctx.primarySkillId) {
    case 'FND.COUNT.Group': return countGroup(ctx, rng)
    case 'FND.FACT.AddWithin20': return factWithin20(ctx, rng, false)
    case 'FND.FACT.SubWithin20': return factWithin20(ctx, rng, true)
    case 'MUL.GROUP.Array': return array(ctx, rng)
    case 'DIV.GROUP.EqualShare': return equalShare(ctx, rng)
    case 'DIV.FACT.Inverse': return divisionFact(ctx, rng)
    case 'REL.ADD.Inverse': return inverse(ctx, rng)
    case 'REL.ADD.MissingPart': return missingPart(ctx, rng)
    default: throw new Error(`facts: unsupported skill ${ctx.primarySkillId}`)
  }
}

export const FACT_SKILLS = [
  'FND.COUNT.Group', 'FND.FACT.AddWithin20', 'FND.FACT.SubWithin20', 'MUL.GROUP.Array',
  'DIV.GROUP.EqualShare', 'DIV.FACT.Inverse', 'REL.ADD.Inverse', 'REL.ADD.MissingPart',
]
