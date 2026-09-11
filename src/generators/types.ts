/**
 * Generator architecture (docs/webapp-architecture-spec.md §5 and
 * docs/adaptive-learning-design.md §5.3.2).
 *
 * Generators are pure functions of (seed, tier, band, purpose, primary skill).
 * They must validate their own numeric constraints and throw on unsatisfiable
 * requests; the session runner discards invalid items before display.
 */
import type {
  DifficultyBand,
  GeneratedExercise,
  PracticePurpose,
  ScaffoldTier,
  SkillId,
} from '../domain/types'
import { SeededRng } from '../engine/rng'

export interface GeneratorContext {
  seed: string
  tier: ScaffoldTier
  band: DifficultyBand
  purpose: PracticePurpose
  primarySkillId: SkillId
}

export type Generator = (ctx: GeneratorContext) => GeneratedExercise

/** Parse a learner integer; trims, accepts Dutch separators in plain integers. */
export function parseIntAnswer(input: string | number): number | null {
  if (typeof input === 'number') return Number.isInteger(input) ? input : null
  const s = String(input).trim().replace(/\s+/g, '')
  if (!/^-?\d+$/.test(s)) return null
  return Number(s)
}

/** Parse "HH:MM" / "H:MM" into minuteOfDay (12-hour tolerant: 8:20 == 08:20). */
export function parseTimeAnswer(input: string | number): number | null {
  const s = String(input).trim()
  const m = s.match(/^(\d{1,2})[:.u](\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  // 12-hour tolerant: an answer of 8:20 matches 08:20.
  return h % 12 === 0 ? (h === 12 ? 720 : 0) + min : h * 60 + min
}

/** Normalize two 12-hour-flexible times for comparison. */
export function sameClockTime(answer: number, target: number): boolean {
  const a = ((answer % 720) + 720) % 720
  const t = ((target % 720) + 720) % 720
  return a === t
}

export function digitsAnswer(map: Record<string, string | number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(map)) {
    const n = parseIntAnswer(v)
    if (n === null) throw new Error(`Non-numeric digit input: ${k}=${v}`)
    out[k] = n
  }
  return out
}

export function uniqueId(rng: SeededRng): string {
  return `ex-${Math.floor(rng.next() * 1e9).toString(36)}`
}