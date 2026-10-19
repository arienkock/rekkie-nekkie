/**
 * Problem-solving habits of the 4-step plan (Stappenplan) and reading the
 * book's instructions: META.MODEL.Quantity (what do you know, what do you
 * look for), META.EQUATION.Select (which sum fits), META.ANSWER.Unit (what
 * does your answer count), META.CHECK.EstimateInverse (does it fit the
 * estimate?) and META.INSTRUCTION.Read ("Wat moet ik doen?").
 */
import type { GeneratedExercise } from '../domain/types'
import { BOOK, INSTRUCTION_MEANINGS } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { choiceStep, isSupported, makeExercise, roundTo, shuffleOptions } from './kit'

interface Story {
  text: string
  /** The sum that solves it, as written in the book. */
  sum: string
  wrongSums: string[]
  answer: number
  unit: string
  wrongUnits: string[]
  known: string[]
  unknown: string
  family: 'add-sub' | 'mul-div'
}

/** Stories modelled on the blok 2 contexts (regentonnen, schoolbieb, kassa). */
function story(rng: SeededRng, harder: boolean): Story {
  const k = rng.int(0, 5)
  const a = rng.int(harder ? 120 : 20, harder ? 480 : 90)
  const b = rng.int(harder ? 110 : 11, harder ? 399 : 49)
  const n = rng.int(3, 8)
  switch (k) {
    case 0: return {
      text: `In de schoolbieb staan ${a} boeken. Er komen ${b} nieuwe boeken bij. Hoeveel boeken staan er nu?`,
      sum: `${a} + ${b}`, wrongSums: [`${a} − ${b}`, `${a} × ${b}`], answer: a + b, unit: 'boeken', wrongUnits: ['euro', 'kasten'],
      known: [`${a} boeken`, `${b} nieuwe boeken`], unknown: 'hoeveel boeken er nu zijn', family: 'add-sub',
    }
    case 1: return {
      text: `Sem heeft ${a + b} kaarten. Hij geeft er ${b} weg. Hoeveel kaarten houdt hij over?`,
      sum: `${a + b} − ${b}`, wrongSums: [`${a + b} + ${b}`, `${b} − ${a + b}`], answer: a, unit: 'kaarten', wrongUnits: ['kinderen', 'euro'],
      known: [`${a + b} kaarten`, `${b} weggegeven`], unknown: 'hoeveel kaarten Sem overhoudt', family: 'add-sub',
    }
    case 2: return {
      text: `Lisa heeft ${a} stickers. Noor heeft er ${b} meer. Hoeveel stickers heeft Noor?`,
      sum: `${a} + ${b}`, wrongSums: [`${a} − ${b}`, `${b} − ${a}`], answer: a + b, unit: 'stickers', wrongUnits: ['kinderen', 'vellen'],
      known: [`Lisa: ${a} stickers`, `Noor: ${b} meer`], unknown: 'hoeveel stickers Noor heeft', family: 'add-sub',
    }
    case 3: return {
      text: `Bij de school staan ${n} regentonnen. In elke ton kan ${a} liter water. Hoeveel liter water kan er in alle tonnen samen?`,
      sum: `${n} × ${a}`, wrongSums: [`${n} + ${a}`, `${a} − ${n}`], answer: n * a, unit: 'liter', wrongUnits: ['tonnen', 'kilogram'],
      known: [`${n} tonnen`, `${a} liter per ton`], unknown: 'hoeveel liter er in alle tonnen samen kan', family: 'mul-div',
    }
    case 4: return {
      text: `Er zijn ${n * 6} kinderen. Ze zitten in groepjes van 6. Hoeveel groepjes zijn er?`,
      sum: `${n * 6} : 6`, wrongSums: [`${n * 6} × 6`, `${n * 6} − 6`], answer: n, unit: 'groepjes', wrongUnits: ['kinderen', 'tafels'],
      known: [`${n * 6} kinderen`, 'groepjes van 6'], unknown: 'hoeveel groepjes er zijn', family: 'mul-div',
    }
    default: return {
      text: `De bus vertrekt om 08:10 en is om 08:${10 + n * 5} op school. Hoe lang duurt de rit?`,
      sum: `08:${10 + n * 5} − 08:10`, wrongSums: [`08:10 + 08:${10 + n * 5}`, `${10 + n * 5} × 10`], answer: n * 5, unit: 'minuten', wrongUnits: ['uur', 'kilometer'],
      known: ['vertrek 08:10', `aankomst 08:${10 + n * 5}`], unknown: 'hoe lang de rit duurt', family: 'add-sub',
    }
  }
}

function modelQuantity(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const s = story(rng, ctx.band === 'harder')
  const other = story(new SeededRng(`${ctx.seed}:other`), ctx.band === 'harder')
  return makeExercise(ctx, rng, {
    archetypeId: 'model-quantity',
    instructionNl: `${BOOK.stappenplan} ${s.text}`,
    steps: [
      choiceStep({
        id: 'unknown', prompt: 'Stap 1: Maak een tekening. Wat zoek je?', skill: ctx.primarySkillId,
        options: shuffleOptions(rng, s.unknown, [...s.known.map((k) => `${k}`), other.unknown].filter((o) => o !== s.unknown).slice(0, 3)),
        answer: s.unknown, solution: `Je zoekt ${s.unknown}.`,
        wrong: () => 'Dat staat al in het verhaal. Wat wordt er gevraagd?',
      }),
    ],
    widget: isSupported(ctx) ? { type: 'bar-model', props: { labels: s.known, unknownLabel: '?' } } : null,
    supportingSkillIds: [],
    representation: 'story',
    variationTags: [s.family],
    explanationNl: [`Je weet: ${s.known.join(' en ')}. Je zoekt: ${s.unknown}.`],
    hintsNl: ['Lees de laatste zin: daar staat de vraag.', 'Wat staat er al in het verhaal? Dat weet je.', 'Wat staat er niet? Dat zoek je.'],
    fingerprint: `model:${s.text}`,
  })
}

function equationSelect(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const s = story(rng, ctx.band === 'harder')
  return makeExercise(ctx, rng, {
    archetypeId: 'equation-select',
    instructionNl: `${BOOK.stappenplan} ${s.text}`,
    steps: [choiceStep({
      id: 'sum', prompt: 'Stap 2: Wat moet je uitrekenen?', skill: ctx.primarySkillId,
      options: shuffleOptions(rng, s.sum, s.wrongSums), answer: s.sum, solution: `${s.sum} = ${s.answer} ${s.unit}`,
      wrong: () => 'Denk aan wat er gebeurt in het verhaal: komt er iets bij, gaat er iets af, of zijn het gelijke groepjes?',
    })],
    widget: null,
    supportingSkillIds: ['META.MODEL.Quantity'],
    representation: 'story',
    variationTags: ['two-operation-families', s.family],
    explanationNl: [`${s.sum} = ${s.answer} ${s.unit}.`],
    hintsNl: ['Maak een tekening van het verhaal.', 'Komt er iets bij, gaat er iets af, of zijn het gelijke groepjes?', 'Kies dan de som die daarbij hoort.'],
    fingerprint: `eqsel:${s.text}`,
  })
}

function answerUnit(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const s = story(rng, ctx.band === 'harder')
  return makeExercise(ctx, rng, {
    archetypeId: 'answer-unit',
    instructionNl: `${BOOK.stappenplan} ${s.text}`,
    steps: [choiceStep({
      id: 'unit', prompt: `Stap 3: Wat is je antwoord? ${s.answer} …`, skill: ctx.primarySkillId,
      options: shuffleOptions(rng, s.unit, s.wrongUnits), answer: s.unit, solution: `${s.answer} ${s.unit}`,
      wrong: () => 'Kijk naar de vraag: waar vraagt die naar?',
    })],
    widget: null,
    supportingSkillIds: [],
    representation: 'story',
    variationTags: [s.family],
    explanationNl: [`De vraag gaat over ${s.unknown}, dus het antwoord is ${s.answer} ${s.unit}.`],
    hintsNl: ['Lees de vraag nog eens.', 'Waar vraagt de vraag naar: “Hoeveel …?”', 'Schrijf dat woord achter je antwoord.'],
    fingerprint: `unit:${s.text}`,
  })
}

/** "Klopt je antwoord? Het antwoord ligt in de buurt van de schatting." */
function checkEstimate(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const a = rng.int(ctx.band === 'easier' ? 110 : 150, 690)
  const b = rng.int(110, 980 - a)
  const exact = a + b
  const off = rng.pick([0, 0, 100, -100, 10, -10])
  const claimed = exact + off
  const estimate = roundTo(a, 100) + roundTo(b, 100)
  const verdict = off === 0 ? 'Klopt' : off > 0 ? 'Klopt niet: te groot' : 'Klopt niet: te klein'
  const nearEstimate = Math.abs(claimed - estimate) < 100
  const name = rng.pick(['Sem', 'Lisa', 'Daoud', 'Fleur'])
  return makeExercise(ctx, rng, {
    archetypeId: 'check-estimate',
    instructionNl: `${BOOK.stappenplan} ${name} rekent ${a} + ${b} = ${claimed}. De schatting was ${a} + ${b} ≈ ${estimate}.`,
    steps: [choiceStep({
      id: 'verdict', prompt: `Stap 4: Klopt het antwoord van ${name}?`, skill: ctx.primarySkillId,
      options: ['Klopt', 'Klopt niet: te groot', 'Klopt niet: te klein'], answer: verdict,
      solution: `${a} + ${b} = ${exact}`,
      wrong: () => (Math.abs(off) === 10
        ? 'Een schatting vangt alleen grote fouten. Kijk ook naar de eenheden: wat is ' + `${a % 10} + ${b % 10}?`
        : nearEstimate ? 'Het ligt in de buurt van de schatting, maar reken het na met omkeren.' : 'Vergelijk met de schatting: ligt het antwoord in de buurt?'),
    })],
    widget: null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: [Math.abs(off) === 100 ? 'estimate-catches' : Math.abs(off) === 10 ? 'inverse-needed' : 'correct-claim'],
    explanationNl: [`Schatting: ${estimate}. Precies: ${exact}.`, off === 0 ? 'Het antwoord klopt.' : `Het antwoord ${claimed} is ${Math.abs(off)} te ${off > 0 ? 'groot' : 'klein'}.`, `Controle met omkeren: ${exact} − ${b} = ${a}.`],
    hintsNl: ['Ligt het antwoord in de buurt van de schatting?', `Controleer met een min-som: ${claimed} − ${b} = ?`, `Krijg je dan ${a}? Dan klopt het.`],
    fingerprint: `check:${a}+${b}:${off}`,
  })
}

function instruction(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const item = rng.pick(INSTRUCTION_MEANINGS)
  return makeExercise(ctx, rng, {
    archetypeId: 'instruction-read',
    instructionNl: 'Wat moet ik doen? Lees de opdracht uit je boek.',
    steps: [choiceStep({
      id: 'meaning', prompt: `«${item.instruction}» Wat moet je doen?`, skill: ctx.primarySkillId,
      options: shuffleOptions(rng, item.meaning, item.distractors), answer: item.meaning, solution: item.meaning,
    })],
    widget: null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: [`instr:${item.instruction}`],
    explanationNl: [`«${item.instruction}» betekent: ${item.meaning}`],
    hintsNl: ['Lees elk woord van de opdracht.', 'Welk woord zegt wat je moet doen? (schat, zet, rond, vul …)', 'Kies wat bij dat woord past.'],
    fingerprint: `instr:${item.instruction}`,
  })
}

export function generateMeta(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  switch (ctx.primarySkillId) {
    case 'META.MODEL.Quantity': return modelQuantity(ctx, rng)
    case 'META.EQUATION.Select': return equationSelect(ctx, rng)
    case 'META.ANSWER.Unit': return answerUnit(ctx, rng)
    case 'META.CHECK.EstimateInverse': return checkEstimate(ctx, rng)
    case 'META.INSTRUCTION.Read': return instruction(ctx, rng)
    default: throw new Error(`meta: unsupported skill ${ctx.primarySkillId}`)
  }
}

export const META_SKILLS = ['META.MODEL.Quantity', 'META.EQUATION.Select', 'META.ANSWER.Unit', 'META.CHECK.EstimateInverse', 'META.INSTRUCTION.Read']
