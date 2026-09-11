import { describe, expect, it } from 'vitest'
import {
  applyEarlyRefresh,
  applyReviewOutcome,
  delayedSeriesQualifies,
  deriveFreshness,
  GAP_LADDER,
  intervalToHalfLifeDays,
  newMemoryState,
  reviewEligibility,
} from '../memory'

describe('review scheduling (§2.3)', () => {
  it('uses the gap ladder 1, 3, 7, 14, 30, 60 days', () => {
    expect(GAP_LADDER).toEqual([1, 3, 7, 14, 30, 60])
  })

  it('half-life targets R ≈ .85 at the due date', () => {
    const S = intervalToHalfLifeDays(7)
    const R = Math.pow(2, -7 / S)
    expect(R).toBeCloseTo(0.85, 3)
  })

  it('a qualifying due review advances the rung', () => {
    let mem = newMemoryState()
    const due = new Date('2024-09-10T09:00:00Z')
    // First independent success scheduled the 1-day check.
    mem = applyEarlyRefresh(mem, new Date('2024-09-09T09:00:00Z'), 'independent-success')
    expect(mem.reviewDueAt).toBe(new Date('2024-09-10T09:00:00Z').toISOString())

    const before = { ...mem, intervalRung: mem.intervalRung }
    const next = applyReviewOutcome(mem, {
      wasIndependent: true,
      wasDue: true,
      correct: true,
      gapSinceRefreshDays: 1.2,
      masteryLevel: 1,
      now: due,
    })
    expect(next.intervalRung).toBe(before.intervalRung + 1)
    expect(next.intervalDays).toBe(GAP_LADDER[1])
  })

  it('before Level 3 the ladder is capped at 14 days', () => {
    let mem = { ...newMemoryState(), intervalRung: 4, intervalDays: 30 }
    const next = applyReviewOutcome(mem, {
      wasIndependent: true,
      wasDue: true,
      correct: true,
      gapSinceRefreshDays: 30,
      masteryLevel: 2,
      now: new Date('2024-09-10T09:00:00Z'),
    })
    expect(next.intervalDays).toBe(14)
  })

  it('a failed due review resets to 1 day and keeps the evidence', () => {
    const mem = { ...newMemoryState(), intervalRung: 3, intervalDays: 14 }
    const next = applyReviewOutcome(mem, {
      wasIndependent: true,
      wasDue: true,
      correct: false,
      gapSinceRefreshDays: 15,
      masteryLevel: 2,
      now: new Date('2024-09-10T09:00:00Z'),
    })
    expect(next.intervalDays).toBe(1)
    expect(next.lapseCount).toBe(1)
    expect(next.delayedSuccessCount).toBe(0)
  })

  it('a too-fresh review does not advance the rung (unrefreshed gap rule)', () => {
    const mem = { ...newMemoryState(), intervalRung: 2, intervalDays: 7 }
    const next = applyReviewOutcome(mem, {
      wasIndependent: true,
      wasDue: true,
      correct: true,
      gapSinceRefreshDays: 0.5, // practiced this morning already
      masteryLevel: 2,
      now: new Date('2024-09-10T09:00:00Z'),
    })
    expect(next.intervalRung).toBe(2)
  })

  it('instruction refreshes memory but never postpones the original due date', () => {
    const mem = { ...newMemoryState(), intervalRung: 1, intervalDays: 3 }
    mem.reviewDueAt = new Date('2024-09-10T09:00:00Z').toISOString()
    const next = applyEarlyRefresh(mem, new Date('2024-09-09T09:00:00Z'), 'instruction')
    expect(next.lastMemoryRefreshAt).toBe(new Date('2024-09-09T09:00:00Z').toISOString())
    expect(next.reviewDueAt).toBe(new Date('2024-09-10T09:00:00Z').toISOString()) // unchanged
    expect(next.reviewNotBeforeAt).toBe(new Date('2024-09-12T09:00:00Z').toISOString()) // cooldown
  })

  it('reviewEligibility requires both the due date and the cooldown', () => {
    const mem = { ...newMemoryState(), intervalRung: 1, intervalDays: 3 }
    mem.reviewDueAt = new Date('2024-09-10T09:00:00Z').toISOString()
    mem.reviewNotBeforeAt = new Date('2024-09-12T09:00:00Z').toISOString()
    expect(reviewEligibility(mem, new Date('2024-09-11T09:00:00Z')).due).toBe(true)
    expect(reviewEligibility(mem, new Date('2024-09-11T09:00:00Z')).notBeforeArrived).toBe(false)
    expect(reviewEligibility(mem, new Date('2024-09-13T09:00:00Z')).notBeforeArrived).toBe(true)
  })

  it('freshness never decrements a level; it only marks due/refresh', () => {
    const mem = newMemoryState()
    expect(deriveFreshness(mem, 0, new Date())).toBe('new')
    mem.reviewDueAt = new Date(Date.now() - 86_400_000).toISOString()
    expect(deriveFreshness(mem, 3, new Date())).toBe('due')
  })

  it('Level 4 needs unrefreshed gaps ≥ 1, 7, 14 days spanning ≥ 21 days', () => {
    const now = new Date('2024-10-01T09:00:00Z')
    expect(delayedSeriesQualifies([1, 2, 3], new Date('2024-09-01T09:00:00Z'), now)).toBe(false)
    expect(delayedSeriesQualifies([1, 7, 14], new Date('2024-09-01T09:00:00Z'), now)).toBe(true)
    expect(delayedSeriesQualifies([1, 7, 14], new Date('2024-09-25T09:00:00Z'), now)).toBe(false)
    expect(delayedSeriesQualifies([2], new Date('2024-09-01T09:00:00Z'), now)).toBe(false)
  })
})
