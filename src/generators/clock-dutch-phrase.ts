/**
 * Archetype 5.1: Analog to digital & Dutch verbal clock — TIME.READ.MinuteFive,
 * TIME.READ.DutchHourQuarter, TIME.READ.DutchHourOffset,
 * TIME.READ.DutchHalfNextHour, TIME.READ.DutchPhrasingHalfHourOffset.
 * The Dutch phrasing engine lives in domain/dutch-time.ts.
 */
import type { GeneratedExercise } from '../domain/types'
import { formatDigital, toDutchVerbalTime, fromMinuteOfDay } from '../domain/dutch-time'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { parseTimeAnswer, sameClockTime, uniqueId } from './types'
import { halfHourReferenceError } from '../domain/dutch-time'

const MINUTES_BY_SKILL: Record<string, number[]> = {
  'TIME.READ.MinuteFive': [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
  'TIME.READ.DutchHourQuarter': [0, 15, 45],
  'TIME.READ.DutchHourOffset': [5, 10, 50, 55],
  'TIME.READ.DutchHalfNextHour': [30],
  'TIME.READ.DutchPhrasingHalfHourOffset': [20, 25, 35, 40],
}

export function generateClockDutchPhrase(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  const skill = ctx.primarySkillId
  const minutesOptions = MINUTES_BY_SKILL[skill]
  if (!minutesOptions) throw new Error(`clock-dutch-phrase: unsupported skill ${skill}`)

  const minutes = rng.pick(minutesOptions)
  const hour12 = rng.int(1, 12)
  // minuteOfDay in the morning half-day; the 12-wrap is critical variation.
  let minuteOfDay = (hour12 % 12) * 60 + minutes
  if (minutes >= 25 && minutes <= 40) minuteOfDay = (hour12 - 1 === 0 ? 12 : hour12 - 1) % 12 * 60 + minutes
  const time = fromMinuteOfDay(minuteOfDay)
  const phrase = toDutchVerbalTime(time)
  const target12 = minuteOfDay % 720

  return {
    id: uniqueId(rng),
    archetypeId: 'clock-reading',
    seed: ctx.seed,
    instructionNl:
      ctx.tier === 'S0' || ctx.tier === 'S1'
        ? 'Onthoud: half betekent dat het uur ERAAN KOMT. "Half 9" is 08:30.'
        : 'Hoe laat is het?',
    steps: [
      {
        id: 'digital',
        promptNl: `Het is "${phrase}". Schrijf de digitale tijd (bijv. 8:20).`,
        answerType: { kind: 'time', use24Hour: false },
        solutionNl: formatDigital(time),
        skillTarget: { skillId: skill, role: 'primary' },
        revealsAnswer: true,
        validate: (answer) => {
          const v = parseTimeAnswer(answer as string | number)
          if (v === null) {
            return { isCorrect: false, feedbackNl: 'Gebruik de vorm uur:minuten, bijvoorbeeld 8:20.', misconceptionId: null, invalidFormat: true }
          }
          if (sameClockTime(v, target12)) {
            return { isCorrect: true, feedbackNl: `Klopt: ${phrase} = ${formatDigital(time)}.`, misconceptionId: null }
          }
          // Half-reference error: "half 9" read as 09:30.
          if (halfHourReferenceError(phrase, v)) {
            return {
              isCorrect: false,
              feedbackNl: 'Half 9 betekent: eraan komen! Nog een half uur, dán is het 9 uur.',
              misconceptionId: 'MC.TIME.HalfReference',
            }
          }
          // Half-direction error: "10 voor half 9" answered as 08:40 (mirrored).
          if (minutes === 20 && v % 720 === ((minuteOfDay + 20) % 720)) {
            return {
              isCorrect: false,
              feedbackNl: '"Voor" betekent teruggaan in de tijd. Ga terug naar half 9 en dan nog 10 minuten.',
              misconceptionId: 'MC.TIME.HalfDirection',
            }
          }
          return { isCorrect: false, feedbackNl: 'Kijk eerst waar "half" staat: welk uur komt eraan?', misconceptionId: null }
        },
      },
    ],
    widget:
      ctx.tier === 'S0' || ctx.tier === 'S1'
        ? { type: 'clock', props: { hours: time.hours, minutes: time.minutes, showDutchLabel: false } }
        : // The analog face IS the answer for a phrase→digital conversion;
          // at independent tiers it would let the child bypass reading the
          // Dutch phrase, so the item is verbal-only (matching the
          // 'symbolic' representation declared below).
          null,
    primarySkillId: skill,
    supportingSkillIds: [],
    difficultyBand: ctx.band,
    representation: ctx.tier === 'S0' || ctx.tier === 'S1' ? 'pictorial' : 'symbolic',
    variationTags: [hour12 === 12 ? '12-wrap' : 'standard'],
    purpose: ctx.purpose,
    explanationNl: [phrase, formatDigital(time), 'De grote wijzer telt per 5 minuten; "half" hoort bij het uur dat eraan komt.'],
    hintsNl: [
      'Kijk goed naar het uur in de zin: welk uur komt eraan?',
      '"Half 9" betekent: nog een half uur, dán is het 9 uur — dus 8:30.',
      '"Voor" ga je terug in de tijd, "over" ga je vooruit. Tel vanaf het hele of halve uur.',
    ],
    fingerprint: `clock:${minuteOfDay}`,
  }
}