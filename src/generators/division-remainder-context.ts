/**
 * Archetypes 4.3/4.4: Delen met rest and contextual remainder
 * interpretation — DIV.REMAINDER.Compute / .CeilContext / .FloorContext.
 * Same arithmetic 32÷6=5 rest 2; only the requested quantity changes.
 */
import type { GeneratedExercise, GeneratedStep } from '../domain/types'
import { SeededRng } from '../engine/rng'
import { parseIntAnswer, uniqueId } from './types'
import type { GeneratorContext } from './types'

interface RemainderProblem {
  N: number
  d: number
  q: number
  r: number
}

function findProblem(rng: SeededRng, exact: boolean): RemainderProblem {
  for (let i = 0; i < 500; i++) {
    const d = rng.int(3, 9)
    const q = rng.int(3, 9)
    const r = exact ? 0 : rng.int(1, d - 1)
    const N = q * d + r
    if (N >= 12 && N <= 90) return { N, d, q, r }
  }
  throw new Error('division-remainder: constraints unsatisfiable')
}

interface Story {
  questionNl: string
  unitNl: string
  interpretation: 'ceil' | 'floor'
  ceilAnswer: number
  floorAnswer: number
}

function busStory(rng: SeededRng, N: number, d: number, q: number, r: number): Story {
  const who = rng.pick(['kinderen', 'leerlingen', 'reizigers'])
  return {
    questionNl: `Er gaan ${N} ${who} op schoolreis. In elke bus passen ${d} ${who}. Hoeveel bussen zijn er nodig, zodat iedereen een plek heeft?`,
    unitNl: 'bussen',
    interpretation: 'ceil',
    ceilAnswer: r === 0 ? q : q + 1,
    floorAnswer: q,
  }
}

function bookStory(rng: SeededRng, N: number, d: number, q: number, r: number): Story {
  const item = rng.pick([
    { what: 'boeken', een: 'boek' },
    { what: 'pennen', een: 'pen' },
  ])
  return {
    questionNl: `Een ${item.een} kost € ${d}. Met € ${N} koop je zoveel mogelijk ${item.what}. Hoeveel ${item.what} kun je kopen?`,
    unitNl: item.what,
    interpretation: 'floor',
    ceilAnswer: r === 0 ? q : q + 1,
    floorAnswer: q,
  }
}

function mkQuotientStep(p: RemainderProblem): GeneratedStep {
  const { N, d, q, r } = p
  return {
    id: 'quotient',
    promptNl: `Reken eerst uit: ${N} : ${d} = ? Vul de deling in met rest.`,
    answerType: { kind: 'quotient-remainder' },
    solutionNl: `${N} : ${d} = ${q}, rest ${r}`,
    skillTarget: { skillId: 'DIV.REMAINDER.Compute', role: 'supporting' },
    revealsAnswer: false,
    validate: (answer) => {
      const a = answer as Record<string, string | number>
      const qAns = parseIntAnswer(String(a.quotient ?? ''))
      const rAns = parseIntAnswer(String(a.remainder ?? ''))
      if (qAns === null || rAns === null) {
        return { isCorrect: false, feedbackNl: 'Vul beide hokjes in: quotient en rest.', misconceptionId: null, invalidFormat: true }
      }
      if (qAns === q && rAns === r) {
        return { isCorrect: true, feedbackNl: `${N} = ${q} × ${d} + ${r}. Klopt!`, misconceptionId: null }
      }
      if (rAns >= d) {
        return {
          isCorrect: false,
          feedbackNl: `Past er nog één hele groep van ${d} bij? ${N} − ${q} × ${d} = ${r}, en ${r} < ${d}.`,
          misconceptionId: 'MC.DIV.RemainderTooLarge',
        }
      }
      return { isCorrect: false, feedbackNl: `Reken: ${q} × ${d} = ${q * d}. Wat blijft er over van ${N}?`, misconceptionId: null }
    },
  }
}

export function generateDivisionRemainderContext(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  const exact = ctx.band === 'harder' // exact-case variation
  const p = findProblem(rng, exact)
  const { N, d, q, r } = p

  // Pure computation item for DIV.REMAINDER.Compute.
  if (ctx.primarySkillId === 'DIV.REMAINDER.Compute') {
    const quotientStep: GeneratedStep = { ...mkQuotientStep(p), skillTarget: { skillId: 'DIV.REMAINDER.Compute', role: 'primary' } }
    return {
      id: uniqueId(rng),
      archetypeId: 'division-remainder',
      seed: ctx.seed,
      instructionNl: 'Delen met rest: het quotiënt is het aantal hele groepen, de rest is wat overblijft.',
      steps: [quotientStep],
      widget: {
        type: 'division-groups',
        props: {
          total: N,
          groupSize: d,
          // Grouped circles reveal the quotient and remainder: scaffolding
          // at S0/S1, an answer leak at independent tiers.
          mode: ctx.tier === 'S0' || ctx.tier === 'S1' ? 'grouped' : 'ungrouped',
        },
      },
      primarySkillId: 'DIV.REMAINDER.Compute',
      supportingSkillIds: [],
      difficultyBand: ctx.band,
      representation: ctx.tier === 'S0' || ctx.tier === 'S1' ? 'pictorial' : 'symbolic',
      variationTags: [exact ? 'exact' : 'non-exact'],
      purpose: ctx.purpose,
      explanationNl: [
        `${N} : ${d} = ${q} rest ${r}, want ${q} × ${d} = ${q * d} en ${N} − ${q * d} = ${r}.`,
        `Controleer: de rest (${r}) is kleiner dan de deler (${d}).`,
      ],
      hintsNl: [
        'Hoeveel hele groepjes passen er? Tel ze op de tekening.',
        'De rest is wat overblijft en is altijd kleiner dan de deler.',
        'Controleer met vermenigvuldigen: aantal groepjes × groepsgrootte, en dan de rest erbij.',
      ],
      fingerprint: `divrem:${N}:${d}`,
    }
  }

  // Contextual interpretation item (ceil or floor).
  const isCeil = ctx.primarySkillId === 'DIV.REMAINDER.CeilContext'
  const story = isCeil ? busStory(rng, N, d, q, r) : bookStory(rng, N, d, q, r)
  const targetAnswer = story.interpretation === 'ceil' ? story.ceilAnswer : story.floorAnswer

  const interpretationStep: GeneratedStep = {
    id: 'interpret',
    promptNl: story.questionNl,
    answerType: { kind: 'integer', unit: story.unitNl },
    solutionNl: `${N} : ${d} = ${q} rest ${r} → ${targetAnswer} ${story.unitNl}.`,
    skillTarget: { skillId: ctx.primarySkillId, role: 'primary' },
    revealsAnswer: true,
    validate: (answer) => {
      const v = parseIntAnswer(answer as string | number)
      if (v === null) return { isCorrect: false, feedbackNl: 'Schrijf een heel getal.', misconceptionId: null, invalidFormat: true }
      if (v === targetAnswer) {
        return {
          isCorrect: true,
          feedbackNl: `Klopt: ${targetAnswer} ${story.unitNl}.${r > 0 ? (isCeil ? ` De rest van ${r} heeft ook nog een plek nodig.` : ` De rest van ${r} is niet genoeg voor één extra.`) : ''}`,
          misconceptionId: null,
        }
      }
      // Always-round signature: chose the other rounding direction.
      const alwaysRound = v === (story.interpretation === 'ceil' ? story.floorAnswer : story.ceilAnswer)
      return {
        isCorrect: false,
        feedbackNl: alwaysRound
          ? isCeil
            ? `Bijna! Wat doen de ${r} die overblijven? Zij moeten ook mee.`
            : `Bijna! Wat gebeurt er met de rest van ${r}? Kun je daar nog één van kopen?`
          : `Reken eerst: ${N} : ${d}. Wat betekent de rest in dit verhaal?`,
        misconceptionId: alwaysRound ? 'MC.DIV.AlwaysRound' : null,
      }
    },
  }

  const steps = ctx.tier === 'S0' || ctx.tier === 'S1' ? [mkQuotientStep(p), interpretationStep] : [interpretationStep]

  return {
    id: uniqueId(rng),
    archetypeId: 'remainder-word-problem',
    seed: ctx.seed,
    instructionNl: 'Stappenplan: reken de deling uit, denk dan na over wat de rest betekent.',
    steps,
    widget: {
      type: 'division-groups',
      props: {
        total: N,
        groupSize: d,
        // Grouped circles reveal the quotient and remainder: intended
        // scaffolding at S0/S1, an answer leak at independent tiers.
        mode: ctx.tier === 'S0' || ctx.tier === 'S1' ? 'grouped' : 'ungrouped',
      },
    },
    primarySkillId: ctx.primarySkillId,
    supportingSkillIds: ['DIV.REMAINDER.Compute'],
    difficultyBand: ctx.band,
    representation: 'story',
    variationTags: [story.interpretation === 'ceil' ? 'ceil' : 'floor', exact ? 'exact-case' : 'non-exact'],
    purpose: ctx.purpose,
    explanationNl: [
      `${N} : ${d} = ${q} rest ${r} (${q} × ${d} = ${q * d}).`,
      story.interpretation === 'ceil'
        ? `${r > 0 ? `De ${r} overgebleven ${r === 1 ? 'kind' : 'kinderen'} passen niet meer in een volle bus, dus je hebt ${targetAnswer} bussen nodig.` : 'Iedereen past precies: geen extra bus nodig.'}`
        : `Van de rest (${r}) kun je niets extra kopen, dus het antwoord is ${targetAnswer}.`,
      `Let op: dezelfde deling, andere vraag, ander antwoord!`,
    ],
    hintsNl: [
      'Reken eerst uit: hoeveel hele groepjes passen er, en wat blijft er over?',
      'De rest is niet genoeg voor een vol groepje — denk aan wat de vraag vraagt.',
      'Lees de vraag nog eens: moet iedereen een plekje hebben (omhoog afgerond), of koop je alleen hele dingen?',
    ],
    fingerprint: `remctx:${story.interpretation}:${N}:${d}`,
  }
}