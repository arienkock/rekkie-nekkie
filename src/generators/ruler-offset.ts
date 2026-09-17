/**
 * Archetype 3.2: Ruler reading — MEAS.RULER.ZeroStart / MEAS.RULER.Offset.
 * The primary skill selects the variation (docs §2.4: one critical
 * dimension at a time); the band only modulates the numeric range:
 * easier = object at zero or a round offset, standard = round offset,
 * harder = arbitrary offset. Invariant: only the origin changes; the length
 * bracket stays fixed.
 */
import type { GeneratedExercise } from '../domain/types'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { parseIntAnswer, uniqueId } from './types'

export function generateRulerOffset(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  const lengthMm = rng.int(5, 15) * 5 // 25..75 mm
  // The requested primary skill decides the variation; the band modulates
  // the offset range. (Deriving the skill from the band would misroute
  // evidence: a ZeroStart request at a harder band must stay ZeroStart.)
  const askOffset = ctx.primarySkillId === 'MEAS.RULER.Offset'
  let startMm = 0
  if (askOffset) {
    startMm = ctx.band === 'harder' ? rng.int(30, 70) : ctx.band === 'standard' ? rng.int(2, 8) * 10 : rng.int(1, 8) * 5
  }
  const endMm = startMm + lengthMm
  const target = lengthMm
  const primary = ctx.primarySkillId

  return {
    id: uniqueId(rng),
    archetypeId: 'ruler-reading',
    seed: ctx.seed,
    instructionNl: askOffset
      ? 'Het potlood ligt niet bij nul. Lengte = eind − begin.'
      : 'Lees af hoe lang het potlood is.',
    steps: [
      {
        id: 'length',
        promptNl: `Hoe lang is het potlood? Geef het antwoord in millimeters.`,
        answerType: { kind: 'integer', unit: 'mm' },
        solutionNl: `${endMm} − ${startMm} = ${target} mm`,
        skillTarget: { skillId: primary, role: 'primary' },
        revealsAnswer: true,
        validate: (answer) => {
          const v = parseIntAnswer(answer as string | number)
          if (v === null) return { isCorrect: false, feedbackNl: 'Schrijf een heel getal in millimeters.', misconceptionId: null, invalidFormat: true }
          if (v === target) return { isCorrect: true, feedbackNl: `Klopt: ${target} mm, ook wel ${(target / 10).toLocaleString('nl-NL')} cm.`, misconceptionId: null }
          // Origin-one signature: learner reports the endpoint instead of the length.
          const originOne = v === endMm
          // Tick-count signature: reports number of cm marks touched.
          const countTicks = v === endMm - startMm + Math.floor((endMm - startMm) / 10) + 1
          return {
            isCorrect: false,
            feedbackNl: originOne
              ? 'Je las de stand van het einde af. Waar begint het potlood? Wat is eind − begin?'
              : countTicks
                ? 'Tel de ruimtes tussen de streepjes, niet de streepjes zelf.'
                : 'Schuif met je oog het begin van het potlood naar nul. De lengte verandert niet!',
            misconceptionId: originOne ? 'MC.MEAS.OriginOne' : countTicks ? 'MC.MEAS.CountTicks' : null,
          }
        },
      },
    ],
    widget: {
      type: 'ruler',
      props: { startMm, endMm, lengthCm: 15 },
    },
    primarySkillId: primary,
    supportingSkillIds: [],
    difficultyBand: ctx.band,
    representation: 'pictorial',
    // MEAS.RULER.ZeroStart lists 'millimeter' as a critical variation ("ook in
    // millimeters"), so the item has to say whether it actually asks for a
    // sub-centimetre reading: lengths are multiples of 5 mm, and only the ones
    // that are not whole centimetres exercise the mm subdivisions.
    variationTags: [askOffset ? 'offset' : 'zero-start', ...(lengthMm % 10 === 0 ? [] : ['millimeter'])],
    purpose: ctx.purpose,
    explanationNl: [
      `Het potlood begint bij ${startMm} mm en eindigt bij ${endMm} mm.`,
      `Lengte = ${endMm} − ${startMm} = ${target} mm = ${target / 10} cm.`,
    ],
    hintsNl: [
      'Kijk op de liniaal: waar begint het potlood, en waar eindigt het?',
      'De lengte is: eind − begin. Het maakt niet uit waar het potlood ligt!',
      'Schuif het begin in je hoofd naar de 0. De afstand blijft hetzelfde.',
    ],
    fingerprint: `ruler:${startMm}-${endMm}`,
  }
}