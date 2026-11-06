import type { DifficultyBand, ExerciseAnswer, PracticePurpose, Representation, ScaffoldTier } from '../domain/types'
import type { SavedPractice } from '../domain/practice-types'

export type PracticeMode = 'curriculum' | 'tables' | 'lesson' | 'proeftoets'
export type AppScreen = 'home' | 'exercise' | 'progress' | 'path' | 'settings'
export type ExerciseEnd = 'completed' | 'skipped' | 'stopped' | 'replaced' | 'interrupted'
/** The one-tap answer to "Waarom sla je deze over?". 'no-reason' = she chose not to say. */
export type SkipReason = 'too-easy' | 'too-hard' | 'unclear' | 'no-reason'
export const SKIP_REASONS: readonly SkipReason[] = ['too-easy', 'too-hard', 'unclear', 'no-reason']
export type UsageAction = 'edit' | 'submit' | 'check_block' | 'hint' | 'reveal' | 'step_select'
  | 'step_focus' | 'selection_note' | 'screen' | 'hidden' | 'visible' | 'restored' | ExerciseEnd

/** Durations are mutually exclusive. Active means visible, on the exercise,
 * and within 60 seconds of input; it does not establish attention. */
export interface UsageTime {
  activeMs: number
  idleMs: number
  hiddenMs: number
  otherScreenMs: number
  unobservedMs: number
}

export interface UsageEvent {
  offsetMs: number
  action: UsageAction
  stepId?: string
  result?: 'correct' | 'incorrect' | 'invalid' | 'blank' | 'blocked' | 'accepted'
  level?: number
  screen?: AppScreen
  /** On a 'skipped' event: why she skipped, when she said. */
  reason?: SkipReason
  /** Submitted answers only, bounded; never keystroke contents. */
  answer?: ExerciseAnswer
}

export interface StepUsage extends UsageTime {
  stepId: string
  promptNl: string
  answerKind: string
  firstActionMs: number | null
  firstSubmitMs: number | null
  editEpisodes: number
  submissions: number
  invalidSubmissions: number
  blankSubmissions: number
  repeatedSubmissions: number
  hintRequests: number
  firstAnswer: ExerciseAnswer | null
  lastAnswer: ExerciseAnswer | null
  firstOutcome: 'correct' | 'incorrect' | null
  lastOutcome: 'correct' | 'incorrect' | null
  correctedAfterError: boolean
  succeededAfterHint: boolean
  hintLevelAtSuccess: number | null
  errorPatterns: string[]
}

export interface ExerciseUsage extends UsageTime {
  id: string
  exerciseId: string
  practiceId: string
  visitId: string
  appVersion: string
  catalogVersion: string
  modelVersion: string
  skillId: string
  archetypeId: string
  seed: string
  fingerprint: string
  instructionNl: string
  mode: PracticeMode
  lessonId: string | null
  proeftoetsId: string | null
  position: number
  scaffold: ScaffoldTier
  difficulty: DifficultyBand
  purpose: PracticePurpose
  selectionReasonNl: string
  representation: Representation
  format: 'item' | 'block'
  siblingOf: string | null
  startedAt: string
  checkpointAt: string
  endedAt: string | null
  end: ExerciseEnd | null
  firstActionMs: number | null
  firstSubmitMs: number | null
  actionCounts: Partial<Record<UsageAction, number>>
  hints: number
  revealed: boolean
  reloads: number
  /** Null until assessed. Items: every answered step right the first time and
   *  no answer revealed. Blocks: the first-response pass threshold. */
  firstAttemptCorrect: boolean | null
  /** Skipped exercises: the reason she tapped (absent in older traces). */
  skipReason?: SkipReason | null
  steps: StepUsage[]
  events: UsageEvent[]
  droppedEvents: number
  timingReliable: boolean
  interruptionReason?: string
  /** Preserve drafts/feedback when updated generator code cannot resume them. */
  unrestorablePractice?: SavedPractice
}

export interface UsageTotals extends UsageTime {
  exercises: number
  completed: number
  skipped: number
  stopped: number
  replaced: number
  interrupted: number
  assessed: number
  firstAttemptCorrect: number
  stepsSubmitted: number
  stepsCorrected: number
  stepsSucceededAfterHint: number
  submissions: number
  invalidSubmissions: number
  blankSubmissions: number
  repeatedSubmissions: number
  editEpisodes: number
  hintRequests: number
  reveals: number
  departures: number
  returns: number
  reloads: number
  timingSamples: number
  /** Active time summed over exactly the samples in activeTimeBuckets. */
  timedActiveMs: number | null
  /** Counts in <=15s, <=30s, <=1m, <=2m, <=5m, >5m active time. */
  activeTimeBuckets: number[]
  /** Skips per reason she tapped (absent until the first such skip). */
  skipReasons?: Partial<Record<SkipReason, number>>
}

export interface PracticeUsage {
  id: string
  startedAt: string
  endedAt: string | null
  mode: PracticeMode
  lessonId: string | null
  proeftoetsId: string | null
  target: number
  completed: number
  skipped: number
  status: 'in_progress' | 'paused' | 'completed' | 'stopped' | 'replaced' | 'interrupted'
}

export interface UsageData {
  version: 1
  collectedSince: string
  policy: { idleAfterMs: number; editEpisodeGapMs: number; detailDays: number; detailLimit: number; eventLimit: number }
  lifetime: UsageTotals
  /** Independent totals for bounded UTC date/month windows; do not add them
   * to lifetime, or to each other. Only finalized exercises contribute. */
  daily: Array<{ date: string; totals: UsageTotals }>
  monthly: Array<{ month: string; totals: UsageTotals }>
  bySkill: Array<{ skillId: string; totals: UsageTotals }>
  byFormat: Array<{ archetypeId: string; scaffold: ScaffoldTier; mode: PracticeMode; totals: UsageTotals }>
  currentPractice: PracticeUsage | null
  sessions: PracticeUsage[]
  sessionCounts: { completed: number; stopped: number; replaced: number; interrupted: number }
  activeExercise: ExerciseUsage | null
  exercises: ExerciseUsage[]
  retention: { prunedExercises: number; prunedSessions: number; prunedFormatSummaries: number; prunedSkillSummaries: number }
}
