/**
 * Evidence reducer: deterministic updates from immutable observations.
 * One item contributes at most one observation update per KC; aggregates
 * happen here. Owns BKT belief, counters, gate windows, memory/review
 * effects and scaffolding streaks (docs §2.2, §2.3, §2.5, §1.4).
 */
import type {
  DifficultyBand,
  EvidenceEligibility,
  GateWindowEntry,
  LearnerSkillState,
  LearningTransitionEvent,
  Outcome,
  Representation,
  ScaffoldTier,
  SkillObservation,
} from '../domain/types'
import { P_MAX } from '../domain/types'
import { applyLearningTransition, updateBelief } from './bkt'
import {
  applyEarlyRefresh,
  applyReviewOutcome,
  newMemoryState,
  reviewEligibility,
} from './memory'

export function newSkillState(skillId: string): LearnerSkillState {
  return {
    skillId,
    bkt: { pL0: 0.2, pT: 0.08, pG: 0.1, pS: 0.1 },
    masteryProbability: 0.2,
    currentVerifiedLevel: 0,
    highestDemonstratedLevel: 0,
    firstExposedAt: null,
    lastPracticedAt: null,
    lastIndependentAttemptAt: null,
    lastIndependentSuccessAt: null,
    lastUpdatedAt: new Date(0).toISOString(),
    exposureCount: 0,
    meaningfulOpportunityCount: 0,
    independentOpportunityCount: 0,
    independentSuccessCount: 0,
    scaffoldedSuccessCount: 0,
    distinctVisitIds: [],
    independentGateWindow: [],
    coverage: [],
    memory: newMemoryState(),
    scaffolding: { currentTier: 'S1', qualifyingSuccessStreak: 0, streakExerciseIds: [], recentComparableFailures: 0 },
    transferSuccessCount: 0,
    inverseSuccessCount: 0,
    hasUnresolvedMisconception: false,
    revision: 0,
  }
}

let observationCounter = 0
export function nextObservationId(): string {
  observationCounter += 1
  return `obs-${Date.now().toString(36)}-${observationCounter}`
}

export interface ObservationInput {
  skillId: string
  exerciseId: string
  visitId: string
  outcome: Outcome
  eligibility: EvidenceEligibility
  scaffold: ScaffoldTier
  representation: Representation
  difficultyBand: DifficultyBand
  variationTags: string[]
  isInverse: boolean
  isTransfer: boolean
  efficientStrategyObserved: boolean
  activeTimeMs: number
  now: Date
  /** Learning transition requested for this KC/item episode (instruction + active action). */
  withLearningTransition: boolean
  /** Flag: this attempt was scheduled as a due review. */
  wasDueReview: boolean
}

export interface AppliedObservation {
  state: LearnerSkillState
  observation: SkillObservation
  transition: LearningTransitionEvent | null
}

const GATE_WINDOW_MAX = 12

function pushGateWindow(window: GateWindowEntry[], entry: GateWindowEntry): GateWindowEntry[] {
  const next = [...window, entry]
  return next.length > GATE_WINDOW_MAX ? next.slice(next.length - GATE_WINDOW_MAX) : next
}

function bumpCoverage(counters: LearnerSkillState['coverage'], key: string, success: boolean): void {
  const existing = counters.find((c) => c.key === key)
  if (existing) {
    existing.opportunities += 1
    if (success) existing.independentSuccesses += 1
  } else {
    counters.push({ key, opportunities: 1, independentSuccesses: success ? 1 : 0 })
  }
}

/**
 * Apply one observation to one skill's state. Pure: returns new state + events.
 * Caller must ensure at most one call per KC per item.
 */
export function applyObservationToSkill(
  state: LearnerSkillState,
  input: ObservationInput,
): AppliedObservation {
  const s: LearnerSkillState = structuredClone(state)
  const nowIso = input.now.toISOString()

  const eligible = input.eligibility.weight > 0 && input.eligibility.attributable
  const independent = eligible && input.eligibility.independent
  const correct = input.outcome === 'correct'

  // --- Belief update (BKT with forgetting-aware likelihoods) ---
  const refreshAt = s.memory.lastMemoryRefreshAt
    ? new Date(s.memory.lastMemoryRefreshAt)
    : null
  const availability = refreshAt
    ? Math.pow(2, -Math.max(0, (input.now.getTime() - refreshAt.getTime()) / 86_400_000) / s.memory.stabilityHalfLifeDays)
    : 1

  const beliefBefore = s.masteryProbability
  const update = updateBelief(
    s.masteryProbability,
    availability,
    input.scaffold,
    input.difficultyBand,
    correct,
    input.eligibility.weight,
  )
  let beliefAfter = update.posterior

  let transition: LearningTransitionEvent | null = null
  if (eligible && input.withLearningTransition) {
    // Meaningful instruction with an active learner action (at most once per episode).
    const before = beliefAfter
    beliefAfter = applyLearningTransition(beliefAfter, s.bkt.pT)
    transition = {
      id: `lt-${nextObservationId()}`,
      skillId: input.skillId,
      exerciseId: input.exerciseId,
      occurredAt: nowIso,
      beliefBefore: before,
      beliefAfter,
    }
  }
  s.masteryProbability = Math.min(beliefAfter, P_MAX)
  s.revision += 1
  s.lastUpdatedAt = nowIso

  // --- Exposure & opportunity counters ---
  s.exposureCount += 1
  if (eligible) s.meaningfulOpportunityCount += 1
  if (independent) s.independentOpportunityCount += 1
  if (!s.firstExposedAt) s.firstExposedAt = nowIso
  s.lastPracticedAt = nowIso

  // --- Gate window & visit tracking (independent qualifying opportunities only) ---
  if (independent) {
    s.lastIndependentAttemptAt = nowIso
    if (correct) {
      s.independentSuccessCount += 1
      s.lastIndependentSuccessAt = nowIso
    }
    const entry: GateWindowEntry = {
      exerciseId: input.exerciseId,
      visitId: input.visitId,
      at: nowIso,
      correct,
      transfer: input.isTransfer,
      inverse: input.isInverse,
      efficientStrategy: input.efficientStrategyObserved,
      representation: input.representation,
      variationTags: [...input.variationTags],
    }
    s.independentGateWindow = pushGateWindow(s.independentGateWindow, entry)
    if (!s.distinctVisitIds.includes(input.visitId)) {
      s.distinctVisitIds = [...s.distinctVisitIds, input.visitId].slice(-10)
    }
    for (const tag of input.variationTags) bumpCoverage(s.coverage, `variation:${tag}`, correct)
    bumpCoverage(s.coverage, `representation:${input.representation}`, correct)
    if (correct) {
      if (input.isTransfer) s.transferSuccessCount += 1
      if (input.isInverse) s.inverseSuccessCount += 1
    }
  } else if (correct && eligible) {
    s.scaffoldedSuccessCount += 1
  }

  // --- Scaffolding streaks (fade/fail evidence, §2.5) ---
  // Scaffolded S0/S1 successes also build fade evidence: without them the
  // tier could never fade past S1, because fading requires a streak that —
  // before this — only independent work could build, while independent work
  // itself requires a faded tier (S2+). Hints below the reveal level keep
  // eligibility > 0; revealed answers never count.
  if (independent) {
    if (correct) {
      if (!s.scaffolding.streakExerciseIds.includes(input.exerciseId)) {
        s.scaffolding.qualifyingSuccessStreak += 1
        s.scaffolding.streakExerciseIds = [...s.scaffolding.streakExerciseIds, input.exerciseId].slice(-6)
      }
      s.scaffolding.recentComparableFailures = Math.max(0, s.scaffolding.recentComparableFailures - 1)
    } else {
      s.scaffolding.recentComparableFailures += 1
      s.scaffolding.qualifyingSuccessStreak = 0
      s.scaffolding.streakExerciseIds = []
    }
  } else if (correct && eligible) {
    if (!s.scaffolding.streakExerciseIds.includes(input.exerciseId)) {
      s.scaffolding.qualifyingSuccessStreak += 1
      s.scaffolding.streakExerciseIds = [...s.scaffolding.streakExerciseIds, input.exerciseId].slice(-6)
    }
    s.scaffolding.recentComparableFailures = Math.max(0, s.scaffolding.recentComparableFailures - 1)
  }

  // --- Memory / review effects ---
  const { due, gapSinceRefreshDays } = reviewEligibility(s.memory, input.now)
  if (input.wasDueReview && due && independent) {
    s.memory = applyReviewOutcome(s.memory, {
      wasIndependent: true,
      wasDue: true,
      correct,
      gapSinceRefreshDays,
      masteryLevel: s.currentVerifiedLevel,
      now: input.now,
    })
  }
  if (correct && independent) {
    // An independent successful retrieval refreshes memory and may start a schedule.
    s.memory = applyEarlyRefresh(s.memory, input.now, 'independent-success')
  } else if (correct && eligible) {
    // Scaffolded success: supportive practice refresh, no rung advance.
    s.memory = applyEarlyRefresh(s.memory, input.now, 'instruction')
  }
  s.memory.freshness = deriveFreshnessFlag(s.memory, s.currentVerifiedLevel, input.now)

  const observation: SkillObservation = {
    id: nextObservationId(),
    skillId: input.skillId,
    exerciseId: input.exerciseId,
    visitId: input.visitId,
    observedAt: nowIso,
    outcome: input.outcome,
    eligibility: input.eligibility,
    effectiveScaffold: input.scaffold,
    representation: input.representation,
    difficultyBand: input.difficultyBand,
    variationTags: [...input.variationTags],
    isInverse: input.isInverse,
    isTransfer: input.isTransfer,
    efficientStrategyObserved: input.efficientStrategyObserved,
    activeTimeMs: input.activeTimeMs,
    wasDueReview: input.wasDueReview && due,
    beliefBefore,
    beliefAfter: s.masteryProbability,
    voidedReason: null,
  }
  return { state: s, observation, transition }
}

function deriveFreshnessFlag(
  memory: LearnerSkillState['memory'],
  level: number,
  now: Date,
): LearnerSkillState['memory']['freshness'] {
  // Local re-derivation to avoid import cycles in memory.ts types.
  if (!memory.reviewDueAt) return level > 0 ? 'fresh' : 'new'
  if (new Date(memory.reviewDueAt).getTime() <= now.getTime()) return 'due'
  if (
    memory.lastMemoryRefreshAt &&
    (now.getTime() - new Date(memory.lastMemoryRefreshAt).getTime()) / 86_400_000 < 1
  ) {
    return 'refresh'
  }
  return 'fresh'
}