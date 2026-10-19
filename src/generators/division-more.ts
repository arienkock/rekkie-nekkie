/**
 * Delen met nullen (DIV.SCALE.CancelFactor: 240 : 6 via 24 : 6, 1800 : 30
 * via 180 : 3) and what a remainder means in its own unit
 * (DIV.REMAINDER.LeftoverUnit: "Hoeveel eieren blijven er over?").
 */
import type { GeneratedExercise } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { byBand, intStep, isSupported, makeExercise } from './kit'

function cancelFactor(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const d = rng.int(2, 9)
  const q = rng.int(2, 9)
  const zerosN = byBand(ctx.band, { easier: 1, standard: 2, harder: 2 })
  const zerosD = ctx.band === 'harder' ? 1 : 0
  const N = d * q * 10 ** zerosN
  const D = d * 10 ** zerosD
  const answer = N / D
  const steps = [
    ...(isSupported(ctx) ? [intStep({ id: 'fact', prompt: `${d * q} : ${d} =`, skill: 'DIV.FACT.Inverse', role: 'supporting' as const, answer: q, solution: `${d * q} : ${d} = ${q}`, reveals: false })] : []),
    intStep({
      id: 'answer', prompt: `${N} : ${D} =`, skill: ctx.primarySkillId, answer,
      solution: `${N} : ${D} = ${answer}, want ${answer} × ${D} = ${N}`,
      wrong: (v) => (v === answer * 10 || v * 10 === answer ? 'Controleer met keer: is jouw antwoord × de deler precies het getal?' : null),
    }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'div-zeros',
    instructionNl: isSupported(ctx) ? `Gebruik de deeltafel: ${d * q} : ${d}. Kijk dan naar de nullen.` : BOOK.rekenUit,
    steps,
    widget: null,
    supportingSkillIds: ['DIV.FACT.Inverse'],
    representation: 'symbolic',
    variationTags: [zerosD > 0 ? 'both-scaled' : 'dividend-scaled'],
    explanationNl: [`${N} : ${D} = ${answer}. Controle: ${answer} × ${D} = ${N}.`],
    hintsNl: [`Zonder nullen: ${d * q} : ${d} = ${q}.`, 'Hoeveel nullen heeft het getal, en hoeveel de deler?', 'Controleer met een keersom.'],
    fingerprint: `divzero:${N}:${D}`,
  })
}

function leftover(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const d = rng.int(4, 9)
  const q = rng.int(3, 9)
  const r = rng.int(1, d - 1)
  const N = q * d + r
  const s = rng.pick([
    { what: 'eieren', box: 'doosjes' },
    { what: 'kinderen', box: 'groepjes' },
    { what: 'stoelen', box: 'rijen' },
  ])
  return makeExercise(ctx, rng, {
    archetypeId: 'div-leftover',
    instructionNl: BOOK.schrijfBerekening,
    steps: [
      ...(isSupported(ctx) ? [intStep({ id: 'groups', prompt: `${N} : ${d} = … (hele ${s.box})`, skill: 'DIV.REMAINDER.Compute', role: 'supporting' as const, answer: q, solution: `${q} hele ${s.box}`, reveals: false })] : []),
      intStep({
        id: 'rest', prompt: `${N} ${s.what} gaan in ${s.box} van ${d}. Hoeveel ${s.what} blijven er over?`, skill: ctx.primarySkillId, answer: r, unit: s.what,
        solution: `${N} : ${d} = ${q} rest ${r}: er blijven ${r} ${s.what} over`,
        wrong: (v) => (v === q ? `Dat is het aantal ${s.box}. De vraag gaat over de ${s.what} die overblijven.` : v >= d ? `Als er ${v} over zijn, past er nog een volle groep van ${d}.` : null),
      }),
    ],
    widget: isSupported(ctx) ? { type: 'division-groups', props: { total: N, groupSize: d, mode: 'grouped' } } : null,
    supportingSkillIds: ['DIV.REMAINDER.Compute'],
    representation: 'story',
    variationTags: ['leftover'],
    explanationNl: [`${q} × ${d} = ${q * d}. ${N} − ${q * d} = ${r} ${s.what} blijven over. De rest is altijd kleiner dan ${d}.`],
    hintsNl: [`Hoeveel volle ${s.box} van ${d} kun je maken?`, `Hoeveel ${s.what} zitten in die volle ${s.box}?`, 'Wat blijft er over van het begin?'],
    fingerprint: `leftover:${N}:${d}:${s.what}`,
  })
}

export function generateDivisionMore(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  if (ctx.primarySkillId === 'DIV.SCALE.CancelFactor') return cancelFactor(ctx, rng)
  if (ctx.primarySkillId === 'DIV.REMAINDER.LeftoverUnit') return leftover(ctx, rng)
  throw new Error(`division-more: unsupported skill ${ctx.primarySkillId}`)
}

export const DIVISION_MORE_SKILLS = ['DIV.SCALE.CancelFactor', 'DIV.REMAINDER.LeftoverUnit']
