/**
 * Review scheduling and retention (docs/adaptive-learning-design.md §2.3).
 *
 *  - Gap ladder: 1, 3, 7, 14, 30, 60 days; before Level 3, cap at 14 days.
 *  - Half-life: S = I × ln(2) / −ln(0.85), so availability ≈ .85 at the due date.
 *  - A review advances its rung only if due + independent + correct + actual
 *    unrefreshed gap ≥ scheduled interval.
 *  - lastMemoryRefreshAt gates both the due date and the notBefore cooldown.
 */
import type { Freshness, ReviewMemoryState } from '../domain/types'

export const GAP_LADDER: readonly number[] = [1, 3, 7, 14, 30, 60]
/** Before Level 3, cap the ladder at 14 days. */
export const PRE_LEVEL3_CAP = 14
const MS_PER_DAY = 86_400_000
const MS_PER_HOUR = 3_600_000

export function intervalToHalfLifeDays(intervalDays: number): number {
  return (intervalDays * Math.LN2) / -Math.log(0.85)
}

export function newMemoryState(): ReviewMemoryState {
  // Exposed novice memory starts with I = 1 (§2.3).
  return {
    stabilityHalfLifeDays: intervalToHalfLifeDays(1),
    intervalDays: 1,
    intervalRung: 0,
    reviewDueAt: null,
    reviewNotBeforeAt: null,
    lastMemoryRefreshAt: null,
    lastQualifyingReviewAt: null,
    delayedSuccessSeriesStartedAt: null,
    delayedSuccessCount: 0,
    delayedSuccessGapsDays: [],
    freshness: 'new',
    lapseCount: 0,
  }
}

export function ladderIntervalForRung(rung: number, masteryLevel: number): number {
  const capped = masteryLevel < 3 ? Math.min(rung, GAP_LADDER.indexOf(PRE_LEVEL3_CAP)) : rung
  return GAP_LADDER[clampInt(capped, 0, GAP_LADDER.length - 1)]!
}

function clampInt(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_DAY
}

export function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_HOUR
}

export interface ReviewEligibility {
  due: boolean
  /** Gap since the last meaningful memory refresh (days), never negative. */
  gapSinceRefreshDays: number
  notBeforeArrived: boolean
}

export function reviewEligibility(memory: ReviewMemoryState, now: Date): ReviewEligibility {
  if (!memory.reviewDueAt) return { due: false, gapSinceRefreshDays: 0, notBeforeArrived: false }
  const due = new Date(memory.reviewDueAt).getTime() <= now.getTime()
  const notBeforeArrived =
    !memory.reviewNotBeforeAt || new Date(memory.reviewNotBeforeAt).getTime() <= now.getTime()
  const gapSinceRefreshDays = memory.lastMemoryRefreshAt
    ? Math.max(0, daysBetween(new Date(memory.lastMemoryRefreshAt), now))
    : Infinity
  return { due, gapSinceRefreshDays, notBeforeArrived }
}

/**
 * Result of applying a review outcome. Pure: returns the next memory state.
 */
export function applyReviewOutcome(
  memory: ReviewMemoryState,
  opts: {
    wasIndependent: boolean
    wasDue: boolean
    correct: boolean
    gapSinceRefreshDays: number
    masteryLevel: number
    now: Date
  },
): ReviewMemoryState {
  const next: ReviewMemoryState = { ...memory }

  if (opts.wasDue && opts.wasIndependent && opts.correct && opts.gapSinceRefreshDays >= memory.intervalDays) {
    // Qualifying spaced retrieval: advance the rung.
    next.intervalRung = clampInt(memory.intervalRung + 1, 0, GAP_LADDER.length - 1)
    next.intervalDays = ladderIntervalForRung(next.intervalRung, opts.masteryLevel)
    next.stabilityHalfLifeDays = intervalToHalfLifeDays(next.intervalDays)
    next.lastQualifyingReviewAt = opts.now.toISOString()
    next.reviewDueAt = new Date(opts.now.getTime() + next.intervalDays * MS_PER_DAY).toISOString()
    next.reviewNotBeforeAt = next.reviewDueAt
    next.delayedSuccessCount = memory.delayedSuccessCount + 1
    next.delayedSuccessGapsDays = [...(memory.delayedSuccessGapsDays ?? []), opts.gapSinceRefreshDays].slice(-5)
    if (!next.delayedSuccessSeriesStartedAt) next.delayedSuccessSeriesStartedAt = opts.now.toISOString()
    if (!next.lastMemoryRefreshAt) next.lastMemoryRefreshAt = opts.now.toISOString()
    return next
  }

  if (opts.wasDue && opts.wasIndependent && !opts.correct) {
    // Failed due review: keep evidence, mark refresh, reset to 1 day.
    next.intervalRung = 0
    next.intervalDays = 1
    next.stabilityHalfLifeDays = intervalToHalfLifeDays(1)
    next.reviewDueAt = new Date(opts.now.getTime() + MS_PER_DAY).toISOString()
    next.reviewNotBeforeAt = next.reviewDueAt
    next.lapseCount = memory.lapseCount + 1
    next.delayedSuccessCount = 0
    next.delayedSuccessSeriesStartedAt = null
    return next
  }

  return next
}

/**
 * A meaningful instruction or early-practice episode refreshes memory but does
 * NOT advance the rung or postpone the original due date beyond the cooldown:
 * reviewNotBeforeAt = lastMemoryRefreshAt + intervalDays.
 */
export function applyEarlyRefresh(
  memory: ReviewMemoryState,
  now: Date,
  kind: 'instruction' | 'independent-success',
): ReviewMemoryState {
  const next: ReviewMemoryState = { ...memory }
  next.lastMemoryRefreshAt = now.toISOString()
  next.reviewNotBeforeAt = new Date(now.getTime() + memory.intervalDays * MS_PER_DAY).toISOString()
  if (kind === 'instruction') {
    // Instruction resets the memory refresh but never postpones the review due date.
  } else {
    // An independent success may start the very first review schedule.
    if (!next.reviewDueAt) {
      next.reviewDueAt = new Date(now.getTime() + MS_PER_DAY).toISOString()
      next.reviewNotBeforeAt = next.reviewDueAt
    }
  }
  return next
}

/** Freshness derived on load (§ LearnerSkillState.memory.freshness). */
export function deriveFreshness(
  memory: ReviewMemoryState,
  masteryLevel: number,
  now: Date,
): Freshness {
  if (!memory.reviewDueAt) return masteryLevel > 0 ? 'fresh' : 'new'
  if (reviewEligibility(memory, now).due) return 'due'
  if (memory.lastMemoryRefreshAt && daysBetween(new Date(memory.lastMemoryRefreshAt), now) < 1) {
    return 'refresh'
  }
  return 'fresh'
}

/** Level 4 delayed-series check: gaps ≥ 1, ≥ 7, ≥ 14 days spanning ≥ 21 days. */
export function delayedSeriesQualifies(
  gapsDays: number[],
  firstSeriesAt: Date,
  now: Date,
): boolean {
  if (gapsDays.length < 3) return false
  if (daysBetween(firstSeriesAt, now) < 21) return false
  const sorted = [...gapsDays].sort((a, b) => a - b)
  return sorted[0]! >= 1 && sorted[1]! >= 7 && sorted[2]! >= 14
}