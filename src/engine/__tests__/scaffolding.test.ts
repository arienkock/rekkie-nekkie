/**
 * Scaffold fading (docs/test-readiness-plan.md §A): support fades within a
 * session, so a child reaches independent items instead of staying supported.
 */
import { describe, expect, it } from 'vitest'
import { decideFade } from '../scaffolding'
import { newSkillState } from '../evidence'
import type { ScaffoldTier } from '../../domain/types'

function withStreak(tier: ScaffoldTier, streak: number, level = 0) {
  const s = newSkillState('ADD.COLUMN.Carry')
  s.scaffolding.currentTier = tier
  s.scaffolding.qualifyingSuccessStreak = streak
  s.scaffolding.streakExerciseIds = Array.from({ length: streak }, (_, i) => `ex-${i}`)
  s.currentVerifiedLevel = level as 0
  return s
}

describe('decideFade', () => {
  it('fades S1 to S2 after two successes on distinct items, whatever the belief', () => {
    const s = withStreak('S1', 2)
    s.masteryProbability = 0.3
    expect(decideFade(s)).toMatchObject({ fade: true, nextTier: 'S2' })
    expect(decideFade(withStreak('S1', 1)).fade).toBe(false)
  })

  it('fades S0 to S1 after two successes', () => {
    expect(decideFade(withStreak('S0', 2))).toMatchObject({ fade: true, nextTier: 'S1' })
  })

  it('keeps S2 until three independent successes and Level 2', () => {
    expect(decideFade(withStreak('S2', 2, 2)).fade).toBe(false)
    expect(decideFade(withStreak('S2', 3, 1)).fade).toBe(false)
    expect(decideFade(withStreak('S2', 3, 2))).toMatchObject({ fade: true, nextTier: 'S3' })
  })

  it('never fades right after a comparable failure', () => {
    const s = withStreak('S1', 3)
    s.scaffolding.recentComparableFailures = 1
    expect(decideFade(s).fade).toBe(false)
  })
})
