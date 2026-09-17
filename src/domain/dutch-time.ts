/**
 * Dutch natural time phrasing engine — archetype 5.1 in
 * docs/exercise-archetypes-and-generators.md, including the 12 o'clock wrap
 * ("5 voor 1" is 00:55, never "5 voor 13") required by
 * docs/adaptive-learning-design.md §7 (all 12 five-minute cases incl. 12-wrap).
 *
 * Times are minuteOfDay 0..1439 in 5-minute resolution.
 */

export interface ClockTime {
  hours: number // 0..23
  minutes: number // 0..59
}

export function toMinuteOfDay(t: ClockTime): number {
  return (t.hours % 24) * 60 + t.minutes
}

export function fromMinuteOfDay(minuteOfDay: number): ClockTime {
  const m = ((minuteOfDay % 1440) + 1440) % 1440
  return { hours: Math.floor(m / 60), minutes: m % 60 }
}

/** 12-hour clock numeral, with the 12 o'clock wrap (13 → 1, 0 → 12). */
function dutch12(hour24: number): number {
  const h = hour24 % 12
  return h === 0 ? 12 : h
}

/** The hour that "half H" / "voor H" refers to: the upcoming hour, 12-wrapped. */
function nextHour12(hour24: number): number {
  return dutch12(hour24 + 1)
}

/** Dutch verbal phrase for a 5-minute-resolution time (archetype 5.1). */
export function toDutchVerbalTime(t: ClockTime): string {
  const curH = dutch12(t.hours)
  const nextH = nextHour12(t.hours)
  switch (t.minutes) {
    case 0: return `${curH} uur`
    case 5: return `5 over ${curH}`
    case 10: return `10 over ${curH}`
    case 15: return `kwart over ${curH}`
    case 20: return `10 voor half ${nextH}`
    case 25: return `5 voor half ${nextH}`
    case 30: return `half ${nextH}`
    case 35: return `5 over half ${nextH}`
    case 40: return `10 over half ${nextH}`
    case 45: return `kwart voor ${nextH}`
    // 5/10 “voor” refer to the NEXT hour (08:50 = “10 voor 9”); the KC
    // definition says “5/10 voor the next hour”. (The archetype snippet in
    // docs/exercise-archetypes-and-generators.md uses curH here — a known
    // erratum; correct Dutch and §1.3 of the adaptive design use nextH.)
    case 50: return `10 voor ${nextH}`
    case 55: return `5 voor ${nextH}`
    default:
      throw new Error(`Dutch verbal time only supports 5-minute resolution; got ${t.minutes}`)
  }
}

/**
 * The structural family a Dutch clock phrase belongs to. Coaching text (rules,
 * hints, feedback) differs per family: "5 over 2" needs the over-the-hour rule,
 * not the half-hour rule, so callers key their copy on this instead of assuming
 * every clock item is a half-hour item.
 */
export type DutchPhraseShape =
  | 'whole'
  | 'over-hour'
  | 'quarter-over'
  | 'to-half'
  | 'half'
  | 'past-half'
  | 'quarter-to'
  | 'to-hour'

export function dutchPhraseShape(minutes: number): DutchPhraseShape {
  switch (minutes) {
    case 0: return 'whole'
    case 5:
    case 10: return 'over-hour'
    case 15: return 'quarter-over'
    case 20:
    case 25: return 'to-half'
    case 30: return 'half'
    case 35:
    case 40: return 'past-half'
    case 45: return 'quarter-to'
    case 50:
    case 55: return 'to-hour'
    default:
      throw new Error(`Dutch verbal time only supports 5-minute resolution; got ${minutes}`)
  }
}

/** Digital 24-hour display, e.g. "08:20". */
export function formatDigital(t: ClockTime): string {
  const hh = String(t.hours).padStart(2, '0')
  const mm = String(t.minutes).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Parse Dutch verbal phrases back to a minuteOfDay in the morning half-day
 * (0..719), always reduced modulo 720 so the 12 o’clock wrap is handled
 * ("5 voor 12" → 715 = 11:55, "half 12" → 690 = 11:30).
 */
const mod720 = (x: number) => ((x % 720) + 720) % 720
const hour12ToMinuteOfDay = (h: number) => (h % 12) * 60
const halfAnchorMinuteOfDay = (h: number) => mod720(((h % 12) + 11) % 12 * 60 + 30)

export function parseDutchVerbalTime(phrase: string): number {
  const s = phrase.trim().toLowerCase()
  const mHour = s.match(/^(\d{1,2}) uur$/)
  const mOver = s.match(/^(\d{1,2}) over (\d{1,2})$/)
  const mVoor = s.match(/^(\d{1,2}) voor (\d{1,2})$/)
  const mKwartOver = s.match(/^kwart over (\d{1,2})$/)
  const mKwartVoor = s.match(/^kwart voor (\d{1,2})$/)
  const mHalf = s.match(/^half (\d{1,2})$/)
  const mHalfOffset = s.match(/^(\d{1,2}) (over|voor) half (\d{1,2})$/)

  if (mHour) return mod720(hour12ToMinuteOfDay(Number(mHour[1])))
  if (mOver) return mod720(hour12ToMinuteOfDay(Number(mOver[2])) + Number(mOver[1]))
  if (mVoor) return mod720(hour12ToMinuteOfDay(Number(mVoor[2])) - Number(mVoor[1]))
  if (mKwartOver) return mod720(hour12ToMinuteOfDay(Number(mKwartOver[1])) + 15)
  if (mKwartVoor) return mod720(hour12ToMinuteOfDay(Number(mKwartVoor[1])) - 15)
  if (mHalf) return halfAnchorMinuteOfDay(Number(mHalf[1]))
  if (mHalfOffset) {
    const min = Number(mHalfOffset[1])
    const dir = mHalfOffset[2] === 'over' ? min : -min
    return mod720(halfAnchorMinuteOfDay(Number(mHalfOffset[3])) + dir)
  }
  throw new Error(`Unparseable Dutch verbal time: ${phrase}`)
}

/**
 * The canonical Dutch half-hour misconception check: does the learner's answer
 * treat "half H" as H:30 (wrong, MC.TIME.HalfReference) instead of (H−1):30?
 */
export function halfHourReferenceError(phrase: string, learnerMinuteOfDay: number): boolean {
  const m = phrase.match(/half (\d{1,2})/i)
  if (!m) return false
  const h = Number(m[1])
  const wrong = (h % 12) * 60 + 30 // "half 9" misread as 09:30
  return learnerMinuteOfDay % 720 === wrong % 720
}