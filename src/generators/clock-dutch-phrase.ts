/**
 * Archetype 5.1: Analog to digital & Dutch verbal clock — TIME.READ.MinuteFive,
 * TIME.READ.DutchHourQuarter, TIME.READ.DutchHourOffset,
 * TIME.READ.DutchHalfNextHour, TIME.READ.DutchPhrasingHalfHourOffset.
 * The Dutch phrasing engine lives in domain/dutch-time.ts.
 */
import type { GeneratedExercise } from '../domain/types'
import type { DutchPhraseShape } from '../domain/dutch-time'
import {
  dutchPhraseShape,
  formatDigital12,
  fromMinuteOfDay,
  halfHourReferenceError,
  isTwelveWrap,
  toDutchVerbalTime,
} from '../domain/dutch-time'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { parseTimeAnswer, sameClockTime, uniqueId } from './types'

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

/**
 * The half-hour this item's own phrase is anchored on: "10 voor half 3" is
 * anchored on half 3 = 02:30. Copy that tells the child to look "in de zin"
 * has to name THAT hour; a fixed "half 9" sends them hunting for a phrase
 * that is not in front of them.
 */
interface HalfAnchor {
  numeral: string
  digital: string
}

/**
 * The critical-variation tag each family contributes. These are the names the
 * KC graph uses in `criticalVariationTags`, and `criticalVariationCovered`
 * gates Level 3 on having succeeded at every one of them.
 */
const VARIATION_TAG_BY_SHAPE: Record<DutchPhraseShape, string> = {
  whole: 'uur',
  'over-hour': 'over',
  'quarter-over': 'kwart-over',
  'to-half': 'voor-half',
  half: 'half',
  'past-half': 'over-half',
  'quarter-to': 'kwart-voor',
  'to-hour': 'voor',
}

function coachingFor(
  shape: DutchPhraseShape,
  example: WorkedExample,
  half: HalfAnchor | null,
): PhraseCoaching {
  const worked = `Zo werkt het: "${example.phrase}" is ${example.digital}.`
  switch (shape) {
    case 'whole':
      return {
        supportedInstructionNl: 'Onthoud: bij een heel uur staat de grote wijzer op de 12; de minuten zijn 00.',
        hintsNl: [
          'Welk uur staat er in de zin? Dat is het hele uur.',
          'Bij een heel uur zijn er geen losse minuten: je schrijft 00 bij de minuten.',
          worked,
        ],
        ruleNl: 'Bij een heel uur staat de grote wijzer op de 12 en zijn de minuten 00.',
        fallbackFeedbackNl: 'Bij een heel uur zijn de minuten 00. Neem het uur uit de zin over.',
      }
    case 'over-hour':
      return {
        supportedInstructionNl: 'Onthoud: bij "over" is het hele uur al geweest; je telt de minuten erbij op.',
        hintsNl: [
          'Welk uur staat er in de zin? Dat hele uur is al geweest.',
          'Bij "over" tel je de minuten op bij dat hele uur.',
          worked,
        ],
        ruleNl: 'Bij "over" tel je de minuten op ná het hele uur dat al geweest is.',
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
        supportedInstructionNl: `Onthoud: "half ${half!.numeral}" is ${half!.digital}; bij "voor half" tel je daar minuten vanaf.`,
        hintsNl: [
          `Zoek eerst het halve uur in de zin: "half ${half!.numeral}" is ${half!.digital}.`,
          '"Voor" betekent teruggaan in de tijd: begin bij dat halve uur en tel de minuten eraf.',
          worked,
        ],
        ruleNl: 'Zoek eerst het halve uur; bij "voor half" tel je daar minuten vanaf.',
        fallbackFeedbackNl: 'Zoek eerst het halve uur in de zin en tel dan terug.',
      }
    case 'half':
      return {
        // "Half 9" is exactly this item's answer, so the copy states the rule
        // and leaves the digital time to the worked example on another hour.
        supportedInstructionNl: `Onthoud: "half" hoort bij het uur dat eraan komt. Het is nog geen ${half!.numeral} uur.`,
        hintsNl: [
          'Kijk goed naar het uur in de zin: dat uur komt er nog aan.',
          `"Half ${half!.numeral}" betekent: nog een half uur, dán is het ${half!.numeral} uur.`,
          worked,
        ],
        ruleNl: '"Half" hoort bij het uur dat eraan komt: een half uur vóór dat hele uur.',
        fallbackFeedbackNl: 'Bij "half" komt het genoemde uur er nog aan. Ga een half uur terug.',
      }
    case 'past-half':
      return {
        supportedInstructionNl: `Onthoud: "half ${half!.numeral}" is ${half!.digital}; bij "over half" tel je daar minuten bij op.`,
        hintsNl: [
          `Zoek eerst het halve uur in de zin: "half ${half!.numeral}" is ${half!.digital}.`,
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
        ruleNl: 'Bij "voor" tel je de minuten af vóór het uur dat eraan komt.',
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
  // NOTE: minutes 20 also names the NEXT hour but is not shifted, so hour12 is
  // "the named hour" at 25..40 and "one before the named hour" at 20. Do not
  // derive anything phrase-shaped from hour12 — ask the item (see isTwelveWrap
  // below); changing this line would also renumber every existing seed.
  if (minutes >= 25 && minutes <= 40) minuteOfDay = (hour12 - 1 === 0 ? 12 : hour12 - 1) % 12 * 60 + minutes
  const time = fromMinuteOfDay(minuteOfDay)
  const phrase = toDutchVerbalTime(time)
  const target12 = minuteOfDay % 720

  // Same phrase shape three hours away: illustrates the rule without handing
  // over this item's answer. A whole-hour shift keeps the shape, and three
  // hours is never 0 mod 12, so the example always names a different hour.
  const exampleTime = fromMinuteOfDay((minuteOfDay + 180) % 720)
  // The hour "half"/"voor" refers to, for copy that names the child's phrase.
  const halfNumeral = phrase.match(/half (\d{1,2})/)?.[1] ?? null
  // "10 voor half 3" (02:20) and "5 over half 3" (02:35) are both anchored on
  // half 3 = 02:30, i.e. minute 30 of the item's own hour block.
  const halfAnchor =
    halfNumeral === null
      ? null
      : { numeral: halfNumeral, digital: formatDigital12(fromMinuteOfDay(Math.floor(minuteOfDay / 60) * 60 + 30)) }
  const shape = dutchPhraseShape(minutes)
  const coaching = coachingFor(
    shape,
    { phrase: toDutchVerbalTime(exampleTime), digital: formatDigital12(exampleTime) },
    halfAnchor,
  )
  const supported = ctx.tier === 'S0' || ctx.tier === 'S1'

  return {
    id: uniqueId(rng),
    archetypeId: 'clock-reading',
    seed: ctx.seed,
    instructionNl: supported ? coaching.supportedInstructionNl : 'Hoe laat is het?',
    steps: [
      {
        id: 'digital',
        promptNl: `Het is "${phrase}". Schrijf de digitale tijd (bijv. 08:20).`,
        answerType: { kind: 'time', use24Hour: false },
        solutionNl: formatDigital12(time),
        skillTarget: { skillId: skill, role: 'primary' },
        revealsAnswer: true,
        validate: (answer) => {
          const v = parseTimeAnswer(answer as string | number)
          if (v === null) {
            return { isCorrect: false, feedbackNl: 'Gebruik de vorm uur:minuten, bijvoorbeeld 08:20.', misconceptionId: null, invalidFormat: true }
          }
          if (sameClockTime(v, target12)) {
            return { isCorrect: true, feedbackNl: `Klopt: ${phrase} = ${formatDigital12(time)}.`, misconceptionId: null }
          }
          // Half-reference error: "half 9" read as 09:30. The null check only
          // narrows the numeral for the message; halfHourReferenceError already
          // returns false for a phrase without "half".
          if (halfNumeral !== null && halfHourReferenceError(phrase, v)) {
            return {
              isCorrect: false,
              feedbackNl: `Half ${halfNumeral} betekent: eraan komen! Nog een half uur, dán is het ${halfNumeral} uur.`,
              misconceptionId: 'MC.TIME.HalfReference',
            }
          }
          // Half-direction error: counting the offset the wrong way round the
          // half-hour anchor. "10 voor half 9" (08:20) answered as 08:40, and
          // equally "5 over half 9" (08:35) answered as 08:25 — mirroring the
          // offset across the anchor lands 2×(30 − minutes) away. This used to
          // fire for minutes === 20 only, leaving the other three offsets of
          // the same error unattributed.
          if ((shape === 'to-half' || shape === 'past-half') && halfNumeral !== null) {
            const mirrored = (((minuteOfDay + 2 * (30 - minutes)) % 720) + 720) % 720
            if (v % 720 === mirrored) {
              const offset = Math.abs(30 - minutes)
              return {
                isCorrect: false,
                feedbackNl:
                  shape === 'to-half'
                    ? `"Voor" betekent teruggaan in de tijd. Ga naar half ${halfNumeral} en tel dan ${offset} minuten terug.`
                    : `"Over" betekent vooruit in de tijd. Ga vanaf half ${halfNumeral} en tel dan ${offset} minuten verder.`,
                misconceptionId: 'MC.TIME.HalfDirection',
              }
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
    // NOT derived from hour12: for minutes 25..40 the hour is shifted back a
    // step above, so hour12 === 12 is 11:30 ("half 12") while the genuine wrap
    // 00:30 ("half 1") sits at hour12 === 1. Ask the item itself.
    variationTags: [VARIATION_TAG_BY_SHAPE[shape], isTwelveWrap(time) ? '12-wrap' : 'standard'],
    purpose: ctx.purpose,
    explanationNl: [phrase, formatDigital12(time), coaching.ruleNl],
    hintsNl: coaching.hintsNl,
    fingerprint: `clock:${minuteOfDay}`,
  }
}
