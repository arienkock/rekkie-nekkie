/**
 * Four-tier scaffold controller (docs/adaptive-learning-design.md §2.5).
 * Pure decision helpers — the session runner applies them.
 */
import type { LearnerSkillState, ScaffoldTier } from '../domain/types'

export const TIER_ORDER: ScaffoldTier[] = ['S0', 'S1', 'S2', 'S3']

export function tierIndex(tier: ScaffoldTier): number {
  return TIER_ORDER.indexOf(tier)
}

/**
 * Choose the starting tier for a fresh item on a skill.
 * S0 for a genuinely unfamiliar relation, S1 for weak foundations,
 * S2 for plausible prior competence, S3 only with independent/variation
 * evidence.
 */
export function chooseStartTier(state: LearnerSkillState | undefined): ScaffoldTier {
  if (!state || state.exposureCount === 0) return 'S0'
  const level = state.currentVerifiedLevel
  if (level >= 2 && state.transferSuccessCount >= 1) return 'S3'
  if (level >= 2) return 'S2'
  if (state.masteryProbability >= 0.75) return 'S2'
  if (state.masteryProbability >= 0.5) return 'S1'
  return 'S0'
}

export interface FadeDecision {
  fade: boolean
  nextTier: ScaffoldTier
  reason: string
}

/**
 * Fade ONE tier on the next fresh item, after:
 *  - ≥3 meaningful first-attempt successes across ≥2 items,
 *  - no conceptual hint in the last two attempts,
 *  - at least one prediction/model-to-symbol explanation.
 * S1→S2 additionally requires p(L) ≥ .75; S2→S3 requires Level 2.
 */
export function decideFade(state: LearnerSkillState): FadeDecision {
  const sc = state.scaffolding
  const current = sc.currentTier
  if (current === 'S3') return { fade: false, nextTier: current, reason: 'already-transfer' }

  const streakOk = sc.qualifyingSuccessStreak >= 3 && sc.streakExerciseIds.length >= 2
  if (!streakOk) return { fade: false, nextTier: current, reason: 'streak' }
  if (sc.recentComparableFailures > 0) return { fade: false, nextTier: current, reason: 'recent-failure' }

  const next = TIER_ORDER[tierIndex(current) + 1]!
  if (current === 'S1' && state.masteryProbability < 0.75) {
    return { fade: false, nextTier: current, reason: 'p<0.75' }
  }
  if (current === 'S2' && state.currentVerifiedLevel < 2) {
    return { fade: false, nextTier: current, reason: 'needs-level-2' }
  }
  return { fade: true, nextTier: next, reason: 'fade' }
}

/**
 * After a wrong submission or confirmed misconception, move one tier toward
 * more support. Learner-requested support is always available and handled
 * by the session runner (hint ladder), not here.
 */
export function decideReSupport(state: LearnerSkillState): ScaffoldTier {
  const current = state.scaffolding.currentTier
  if (state.scaffolding.recentComparableFailures >= 2 || state.hasUnresolvedMisconception) {
    return TIER_ORDER[Math.max(0, tierIndex(current) - 1)]!
  }
  return current
}