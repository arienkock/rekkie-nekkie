/**
 * Core domain types for Rekkie Nekkie.
 *
 * These are a pragmatic implementation subset of the design contracts in
 * docs/adaptive-learning-design.md §5.2. Where the design doc uses long-form
 * names (e.g. ScaffoldTier 'S0-full'), we keep a compact equivalent and note
 * the mapping in comments. Runtime validation lives with the modules that
 * own each invariant.
 */

// ---- Shared vocabulary ----

export type SkillId = string
export type ThemeId = 'optellen-aftrekken' | 'meten' | 'vermenigvuldigen-delen' | 'tijd-geld'

export type MasteryLevel = 0 | 1 | 2 | 3 | 4

/** Design doc: 'S0-full' | 'S1-partial' | 'S2-faded' | 'S3-transfer' */
export type ScaffoldTier = 'S0' | 'S1' | 'S2' | 'S3'

export type Representation = 'manipulative' | 'pictorial' | 'symbolic' | 'story'

export type PracticePurpose =
  | 'placement'
  | 'growth'
  | 'review'
  | 'diagnostic'
  | 'transfer'
  | 'free'

export type Outcome = 'correct' | 'incorrect' | 'unknown'

export type DifficultyBand = 'easier' | 'standard' | 'harder'

export interface BktParameters {
  /** Prior knowledge before observed evidence. */
  pL0: number
  /** Chance of learning from one meaningful instructional episode. */
  pT: number
  /** Correct without knowledge (baseline open-response item). */
  pG: number
  /** Incorrect despite knowledge (baseline open-response item). */
  pS: number
}

export const DEFAULT_BKT: BktParameters = { pL0: 0.2, pT: 0.08, pG: 0.1, pS: 0.1 }

/** Probability clamps used in all likelihood math. */
export const P_MIN = 0.01
export const P_MAX = 0.99

// ---- Knowledge graph catalog ----

export interface KnowledgeGraphNode {
  id: SkillId
  titleNl: string
  /** Child-facing capability sentence: "Ik kan …" */
  learnerCanNl: string
  /** The independent observable rubric check. */
  observableCheck: string
  themes: ThemeId[]
  cluster: string
  /** Required-for-instruction prerequisites (default threshold: level 1 + availability >= 0.55). */
  prerequisites: SkillId[]
  /** Node-specific critical variation that must be covered for Level 3. */
  criticalVariationTags: string[]
  /** Related skills: undirected metadata, NOT DAG edges. */
  related?: SkillId[]
}

// ---- Learner evidence model ----

export interface GateWindowEntry {
  exerciseId: string
  visitId: string
  at: string // ISO-8601 UTC
  correct: boolean
  transfer: boolean
  inverse: boolean
  efficientStrategy: boolean
  representation: Representation
  variationTags: string[]
}

export interface CoverageCounter {
  key: string
  opportunities: number
  independentSuccesses: number
}

export type Freshness = 'new' | 'fresh' | 'due' | 'refresh'

export interface ReviewMemoryState {
  /** Half-life S in days: R = 2^(-Δ/S). */
  stabilityHalfLifeDays: number
  /** Current scheduled review interval in days (ladder 1,3,7,14,30,60). */
  intervalDays: number
  intervalRung: number
  reviewDueAt: string | null
  /** Cooldown after early practice/help: never before lastMemoryRefreshAt + interval. */
  reviewNotBeforeAt: string | null
  /** Last meaningful memory refresh (instruction or independent retrieval). */
  lastMemoryRefreshAt: string | null
  lastQualifyingReviewAt: string | null
  delayedSuccessSeriesStartedAt: string | null
  delayedSuccessCount: number
  /** Unrefreshed gap (days) of each qualifying delayed review, last 5 kept. */
  delayedSuccessGapsDays: number[]
  freshness: Freshness
  lapseCount: number
}

export interface ScaffoldingState {
  currentTier: ScaffoldTier
  /** First-attempt successes across distinct items since the last tier change. */
  qualifyingSuccessStreak: number
  streakExerciseIds: string[]
  /** Comparable failures in the latest comparable window. */
  recentComparableFailures: number
}

export interface LearnerSkillState {
  skillId: SkillId
  bkt: BktParameters
  /** Stored conceptual belief p(L_t); never overwritten by availability r. */
  masteryProbability: number
  currentVerifiedLevel: MasteryLevel
  highestDemonstratedLevel: MasteryLevel
  firstExposedAt: string | null
  lastPracticedAt: string | null
  lastIndependentAttemptAt: string | null
  lastIndependentSuccessAt: string | null
  lastUpdatedAt: string
  exposureCount: number
  meaningfulOpportunityCount: number
  independentOpportunityCount: number
  independentSuccessCount: number
  scaffoldedSuccessCount: number
  distinctVisitIds: string[]
  /** Latest 12 qualifying independent opportunities (bounded gate window). */
  independentGateWindow: GateWindowEntry[]
  coverage: CoverageCounter[]
  memory: ReviewMemoryState
  scaffolding: ScaffoldingState
  /** Transfer successes without provided instructional visuals. */
  transferSuccessCount: number
  inverseSuccessCount: number
  /** Whether an unresolved, repeated target misconception blocks Level 2+. */
  hasUnresolvedMisconception: boolean
  revision: number
}

// ---- Observations ----

export interface EvidenceEligibility {
  independent: boolean
  firstCommittedResponse: boolean
  attributable: boolean
  answerRevealed: boolean
  /** Rule-derived tempering weight w; 0 for revealed/copied responses. */
  weight: number
}

export const EVIDENCE_WEIGHTS = {
  /** Independent isolated first response. */
  independent: 1.0,
  /** Attributable first sub-step in a multi-skill task. */
  attributableSubStep: 0.6,
  /** Meaningful scaffolded prediction (S0/S1, unforced). */
  scaffoldedPrediction: 0.35,
  /** Revealed, copied, or repeated same-item response. */
  revealed: 0,
} as const

export interface SkillObservation {
  id: string
  skillId: SkillId
  exerciseId: string
  visitId: string
  observedAt: string
  outcome: Outcome
  eligibility: EvidenceEligibility
  effectiveScaffold: ScaffoldTier
  representation: Representation
  difficultyBand: DifficultyBand
  variationTags: string[]
  isInverse: boolean
  isTransfer: boolean
  efficientStrategyObserved: boolean
  activeTimeMs: number
  /** Whether this observation was a due independent review attempt. */
  wasDueReview: boolean
  beliefBefore: number
  beliefAfter: number
  voidedReason: string | null
}

export interface LearningTransitionEvent {
  id: string
  skillId: SkillId
  exerciseId: string
  occurredAt: string
  beliefBefore: number
  beliefAfter: number
}

// ---- Generated exercises ----

export type AnswerType =
  | { kind: 'integer'; unit?: string }
  | { kind: 'text' }
  | { kind: 'time'; use24Hour: boolean }
  | { kind: 'quotient-remainder'; quotientUnit?: string; remainderUnit?: string }
  | { kind: 'digits'; length: number } // digit-by-digit entry (grids)
  | { kind: 'money'; unit: 'cent' | 'euro-comma' }

export interface GeneratedStep {
  id: string
  promptNl: string
  answerType: AnswerType
  /** Canonical solution for explanation/feedback; validation uses `validate`. */
  solutionNl: string
  /** Accepts a normalized learner answer; returns per-step validity + localized feedback. */
  validate: (answer: string | number | Record<string, string | number>) => StepValidation
  /** Primary or supporting skill this step's first committed response updates. */
  skillTarget: { skillId: SkillId; role: 'primary' | 'supporting' }
  /** Part of the answer that is revealed by full help. */
  revealsAnswer: boolean
}

export interface StepValidation {
  isCorrect: boolean
  feedbackNl: string
  /** Misconception signature suggested by this response, if any. */
  misconceptionId: string | null
  /** True when the response could not be parsed at all: it stays in
   *  `working` and never becomes wrong-math evidence (docs §4.1). */
  invalidFormat?: boolean
}

export interface WidgetSpec {
  type: 'dhte-grid' | 'number-line' | 'column-grid' | 'ruler' | 'clock' | 'division-groups' | 'money-tray'
  props: Record<string, unknown>
}

export interface GeneratedExercise {
  id: string
  archetypeId: string
  seed: string
  instructionNl: string
  steps: GeneratedStep[]
  widget: WidgetSpec | null
  primarySkillId: SkillId
  supportingSkillIds: SkillId[]
  difficultyBand: DifficultyBand
  representation: Representation
  variationTags: string[]
  purpose: PracticePurpose
  explanationNl: string[]
  /** Optional archetype-specific hint ladder (Dutch, ordered shallow→deep).
   *  The store pads with generic hints and reveals the solution at level 4. */
  hintsNl?: string[]
  /** Canonical fingerprint for recent-pattern exclusion (e.g. "coladd:347+278"). */
  fingerprint: string
}

// ---- Exercise session runtime ----

export type ExercisePhase =
  | 'presenting'
  | 'working'
  | 'feedback'
  | 'retrying'
  | 'remediating'
  | 'completed'
  | 'paused'
  | 'deferred'

export interface StepResponse {
  stepId: string
  firstAnswer: string | number | Record<string, string | number> | null
  outcome: Outcome
  attemptCount: number
}

export interface ExerciseSessionState {
  id: string
  visitId: string
  exercise: GeneratedExercise
  currentScaffold: ScaffoldTier
  highestAssistanceUsed: ScaffoldTier
  hintLevel: number // 0 none, 1 attention, 2 relationship, 3 model, 4 worked step
  steps: StepResponse[]
  phase: ExercisePhase
  attempts: number
  startedAt: string
  /** Evidence weight class for the primary skill after assistance adjustments. */
  evidenceWeight: number
  lastSavedAt: string | null
}

// ---- Learner profile & snapshot ----

export interface LearnerPreferences {
  nickname: string | null
  reducedMotion: boolean
  chosenTheme: ThemeId | null
}

export interface LearnerSnapshot {
  schemaVersion: number
  catalogVersion: string
  modelVersion: string
  profileId: string
  revision: number
  savedAt: string
  checksum: string // computed over canonical payload excluding this field
  preferences: LearnerPreferences
  skills: Record<SkillId, LearnerSkillState>
  observations: SkillObservation[]
  learningTransitions: LearningTransitionEvent[]
  recentExerciseFingerprints: string[]
  /** Journal sequence number of the last applied event. */
  lastAppliedSequence: number
  /** Total exercises fully completed (defers excluded). */
  totalExercisesCompleted: number
}

export const SCHEMA_VERSION = 1
export const CATALOG_VERSION = 'groep56-2024-09'
export const MODEL_VERSION = 'bkt-memory-v1'