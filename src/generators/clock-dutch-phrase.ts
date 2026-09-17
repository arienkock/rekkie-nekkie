/**
 * Archetype 5.1: Analog to digital & Dutch verbal clock — TIME.READ.MinuteFive,
 * TIME.READ.DutchHourQuarter, TIME.READ.DutchHourOffset,
 * TIME.READ.DutchHalfNextHour, TIME.READ.DutchPhrasingHalfHourOffset.
 * The Dutch phrasing engine lives in domain/dutch-time.ts.
 */
import type { GeneratedExercise } from '../domain/types'
import type { DutchPhraseShape } from '../domain/dutch-time'
import { formatDigital, toDutchVerbalTime, fromMinuteOfDay, dutchPhraseShape } from '../domain/dutch-time'
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

/**
 * Coaching copy for one phrase family. Every clock item used to carry the
 * half-hour ladder, so "5 over 2" was taught with "half 9 is 08:30" — text
 * about a rule the item does not exercise. The copy now follows the phrase.
 */
interface PhraseCoaching {
  /** Supported-tier instruction: the one rule this phrase family turns on. */
  supportedInstructionNl: string
  /** Hint ladder levels 1–3: where to look, the rule, a worked example. */
  hintsNl: [string, string, string]
  /** Closing line of the worked explanation. */
  ruleNl: string
  /** Feedback for a wrong answer with no recognised misconception signature. */
  fallbackFeedbackNl: string
}

/** A same-shaped phrase on a different hour, so the example never leaks the answer. */
interface WorkedExample {
  phrase: string
  digital: string
}

function coachingFor(shape: DutchPhraseShape, example: WorkedExample): PhraseCoaching {
  const worked = `Zo werkt het: "${example.phrase}" is ${example.digital}.`
  switch (shape) {
    case 'whole':
      return {
        supportedInstructionNl: 'Onthoud: bij "… uur" staat de grote wijzer op de 12; de minuten zijn 00.',
        hintsNl: [
          'Welk uur noemt de zin? Dat is het hele uur.',
          'Bij een heel uur zijn er geen losse minuten: je schrijft :00.',
          worked,
        ],
        ruleNl: 'Bij een heel uur staat de grote wijzer op de 12 en zijn de minuten 00.',
        fallbackFeedbackNl: 'Bij "… uur" zijn de minuten 00. Neem het uur uit de zin over.',
      }
    case 'over-hour':
      return {
        supportedInstructionNl: 'Onthoud: bij "over" is het hele uur al geweest; je telt de minuten erbij op.',
        hintsNl: [
          'Welk uur noemt de zin? Dat hele uur is al geweest.',
          'Bij "over" tel je de minuten op bij dat hele uur.',
          worked,
        ],
        ruleNl: 'Bij "over" tel je de minuten op bij het hele uur dat al geweest is.',
        fallbackFeedbackNl: 'Kijk naar het uur in de zin en tel de minuten van "over" daarbij op.',
      }
    case 'quarter-over':
      return {
        supportedInstructionNl: 'Onthoud: "kwart over" is 15 minuten ná het hele uur.',
        hintsNl: [
          'Welk uur noemt de zin? Dat hele uur is al geweest.',
          'Een kwart is 15 minuten; bij "kwart over" tel je die op bij het hele uur.',
          worked,
        ],
        ruleNl: '"Kwart over" is 15 minuten ná het hele uur.',
        fallbackFeedbackNl: 'Een kwart is 15 minuten. Tel ze op bij het uur uit de zin.',
      }
    case 'to-half':
      return {
        supportedInstructionNl: 'Onthoud: half betekent dat het uur ERAAN KOMT ("half 9" is 08:30); bij "voor half" tel je daar nog van terug.',
        hintsNl: [
          'Zoek eerst het halve uur in de zin: "half 9" is 8:30.',
          '"Voor" betekent teruggaan in de tijd: begin bij dat halve uur en tel de minuten eraf.',
          worked,
        ],
        ruleNl: 'Zoek eerst het halve uur; bij "voor half" tel je daar minuten vanaf.',
        fallbackFeedbackNl: 'Zoek eerst het halve uur in de zin en tel dan terug.',
      }
    case 'half':
      return {
        supportedInstructionNl: 'Onthoud: half betekent dat het uur ERAAN KOMT. "Half 9" is 08:30.',
        hintsNl: [
          'Kijk goed naar het uur in de zin: welk uur komt eraan?',
          '"Half 9" betekent: nog een half uur, dán is het 9 uur — dus 8:30.',
          worked,
        ],
        ruleNl: '"Half" hoort bij het uur dat eraan komt: een half uur eerder.',
        fallbackFeedbackNl: 'Bij "half" komt het genoemde uur er nog aan. Ga een half uur terug.',
      }
    case 'past-half':
      return {
        supportedInstructionNl: 'Onthoud: half betekent dat het uur ERAAN KOMT ("half 9" is 08:30); bij "over half" tel je daar nog bij op.',
        hintsNl: [
          'Zoek eerst het halve uur in de zin: "half 9" is 8:30.',
          '"Over" betekent vooruit in de tijd: begin bij dat halve uur en tel de minuten erbij op.',
          worked,
        ],
        ruleNl: 'Zoek eerst het halve uur; bij "over half" tel je daar minuten bij op.',
        fallbackFeedbackNl: 'Zoek eerst het halve uur in de zin en tel dan de minuten erbij op.',
      }
    case 'quarter-to':
      return {
        supportedInstructionNl: 'Onthoud: "kwart voor" is 15 minuten vóór het uur dat eraan komt.',
        hintsNl: [
          'Het uur in de zin komt er nog aan; zo laat is het nog niet.',
          'Een kwart is 15 minuten; bij "kwart voor" tel je die af van dat uur.',
          worked,
        ],
        ruleNl: '"Kwart voor" is 15 minuten vóór het uur dat eraan komt.',
        fallbackFeedbackNl: 'Bij "kwart voor" is het genoemde uur nog niet geweest. Tel 15 minuten terug.',
      }
    case 'to-hour':
      return {
        supportedInstructionNl: 'Onthoud: bij "voor" komt het genoemde uur er nog aan; je telt de minuten eraf.',
        hintsNl: [
          'Het uur in de zin komt er nog aan; zo laat is het nog niet.',
          'Bij "voor" ga je terug in de tijd: tel de minuten af van dat hele uur.',
          worked,
        ],
        ruleNl: 'Bij "voor" tel je de minuten af van het uur dat eraan komt.',
        fallbackFeedbackNl: 'Bij "voor" is het genoemde uur nog niet geweest. Tel de minuten terug.',
      }
  }
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

  // Same phrase shape, three hours later: illustrates the rule without
  // handing over this item's answer.
  const exampleTime = fromMinuteOfDay((minuteOfDay + 180) % 720)
  const coaching = coachingFor(dutchPhraseShape(minutes), {
    phrase: toDutchVerbalTime(exampleTime),
    digital: formatDigital(exampleTime),
  })
  // The hour "half"/"voor" refers to, for feedback that names the child's phrase.
  const halfNumeral = phrase.match(/half (\d{1,2})/)?.[1] ?? null
  const supported = ctx.tier === 'S0' || ctx.tier === 'S1'

  return {
    id: uniqueId(rng),
    archetypeId: 'clock-reading',
    seed: ctx.seed,
    instructionNl: supported ? coaching.supportedInstructionNl : 'Hoe laat is het?',
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
          if (halfNumeral !== null && halfHourReferenceError(phrase, v)) {
            return {
              isCorrect: false,
              feedbackNl: `Half ${halfNumeral} betekent: eraan komen! Nog een half uur, dán is het ${halfNumeral} uur.`,
              misconceptionId: 'MC.TIME.HalfReference',
            }
          }
          // Half-direction error: "10 voor half 9" answered as 08:40 (mirrored).
          if (minutes === 20 && halfNumeral !== null && v % 720 === ((minuteOfDay + 20) % 720)) {
            return {
              isCorrect: false,
              feedbackNl: `"Voor" betekent teruggaan in de tijd. Ga terug naar half ${halfNumeral} en dan nog 10 minuten.`,
              misconceptionId: 'MC.TIME.HalfDirection',
            }
          }
          return { isCorrect: false, feedbackNl: coaching.fallbackFeedbackNl, misconceptionId: null }
        },
      },
    ],
    widget: supported
      ? { type: 'clock', props: { hours: time.hours, minutes: time.minutes, showDutchLabel: false } }
      : // The analog face IS the answer for a phrase→digital conversion;
        // at independent tiers it would let the child bypass reading the
        // Dutch phrase, so the item is verbal-only (matching the
        // 'symbolic' representation declared below).
        null,
    primarySkillId: skill,
    supportingSkillIds: [],
    difficultyBand: ctx.band,
    representation: supported ? 'pictorial' : 'symbolic',
    variationTags: [hour12 === 12 ? '12-wrap' : 'standard'],
    purpose: ctx.purpose,
    explanationNl: [phrase, formatDigital(time), coaching.ruleNl],
    hintsNl: coaching.hintsNl,
    fingerprint: `clock:${minuteOfDay}`,
  }
}
