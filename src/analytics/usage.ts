import type { ExerciseAnswer, GeneratedExercise, StepValidation } from '../domain/types'
import type { AppScreen, ExerciseEnd, ExerciseUsage, StepUsage, UsageAction, UsageData, UsageEvent, UsageTime, UsageTotals } from './types'

export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'development'
export const IDLE_AFTER_MS = 60_000
export const EDIT_EPISODE_GAP_MS = 1_500
export const DETAIL_LIMIT = 100
export const DETAIL_DAYS = 30
export const EVENT_LIMIT = 60
export const PROFILE_BUDGET_BYTES = 2 * 1024 * 1024
export const SNAPSHOT_TARGET_BYTES = 768 * 1024
const DAY_MS = 86_400_000
const TIME_KEYS = ['activeMs', 'idleMs', 'hiddenMs', 'otherScreenMs', 'unobservedMs'] as const
export const USAGE_DEFINITIONS = {
  documentation: 'docs/local-usage-data.md',
  units: 'milliseconds', calendar: 'UTC',
  summaries: 'Finalized exercises only. Lifetime, daily, monthly, skill and format totals overlap; do not add them together.',
  activeTime: 'Estimated interaction time: visible exercise screen, within 60 seconds of input or return. Does not establish attention.',
  latency: 'Exercise firstActionMs/firstSubmitMs use active time since presentation; step latencies use active time on that step.',
  eventOffsets: 'Sum of active, idle, hidden, other-screen and unobserved durations since presentation.',
  interruptions: 'Hidden does not identify a destination or intent. Unobserved time after reload is never counted as active.',
  timingSamples: 'Completed traces with reliable timing only. Use timedActiveMs / timingSamples for their mean if the sum is not null; activeMs includes all finalized traces.',
  activeTimeBucketUpperBoundsMs: [15_000, 30_000, 60_000, 120_000, 300_000, null],
  answers: 'First/last submitted answers can include invalid/blank input; first/last outcomes refer to committed math responses. Truncated values are labelled.',
  actions: 'Edits are grouped into episodes; no keystroke contents. Screen/visibility/restore/focus events also appear in actionCounts and are not effort scores.',
  retention: 'Details may be pruned before age/count limits to fit the byte budget. Summaries are updated at finalization, never by pruning.',
} as const

export interface UsageClock { now(): number; monotonic(): number }
export const systemClock: UsageClock = { now: () => Date.now(), monotonic: () => performance.now() }

export function emptyTime(): UsageTime {
  return { activeMs: 0, idleMs: 0, hiddenMs: 0, otherScreenMs: 0, unobservedMs: 0 }
}

export function emptyTotals(): UsageTotals {
  return {
    ...emptyTime(), exercises: 0, completed: 0, skipped: 0, stopped: 0, replaced: 0, interrupted: 0,
    assessed: 0, firstAttemptCorrect: 0, stepsSubmitted: 0, stepsCorrected: 0, stepsSucceededAfterHint: 0,
    submissions: 0, invalidSubmissions: 0, blankSubmissions: 0, repeatedSubmissions: 0,
    editEpisodes: 0, hintRequests: 0, reveals: 0, departures: 0, returns: 0, reloads: 0,
    timingSamples: 0, timedActiveMs: 0, activeTimeBuckets: [0, 0, 0, 0, 0, 0],
  }
}

export function newUsage(now: number): UsageData {
  return {
    version: 1, collectedSince: new Date(now).toISOString(),
    policy: { idleAfterMs: IDLE_AFTER_MS, editEpisodeGapMs: EDIT_EPISODE_GAP_MS, detailDays: DETAIL_DAYS, detailLimit: DETAIL_LIMIT, eventLimit: EVENT_LIMIT },
    lifetime: emptyTotals(), daily: [], monthly: [], bySkill: [], byFormat: [],
    currentPractice: null, sessions: [], sessionCounts: { completed: 0, stopped: 0, replaced: 0, interrupted: 0 },
    activeExercise: null, exercises: [], retention: { prunedExercises: 0, prunedSessions: 0, prunedFormatSummaries: 0, prunedSkillSummaries: 0 },
  }
}

/** Bound exported answers without touching the learner's real working input. */
export function boundedAnswer(answer: ExerciseAnswer): ExerciseAnswer {
  if (typeof answer === 'number') return Number.isFinite(answer) ? answer : String(answer)
  if (typeof answer === 'string') return answer.length > 160 ? `${answer.slice(0, 160)}…[truncated]` : answer
  return Object.fromEntries(Object.entries(answer).slice(0, 16).map(([k, v]) => [k.slice(0, 40), boundedAnswer(v) as string | number]))
}

export function newStepUsage(step: GeneratedExercise['steps'][number]): StepUsage {
  return {
    ...emptyTime(), stepId: step.id, promptNl: step.promptNl.slice(0, 400), answerKind: step.answerType.kind,
    firstActionMs: null, firstSubmitMs: null, editEpisodes: 0, submissions: 0,
    invalidSubmissions: 0, blankSubmissions: 0, repeatedSubmissions: 0, hintRequests: 0,
    firstAnswer: null, lastAnswer: null, firstOutcome: null, lastOutcome: null,
    correctedAfterError: false, succeededAfterHint: false, hintLevelAtSuccess: null, errorPatterns: [],
  }
}

export function observedMs(time: UsageTime): number {
  return time.activeMs + time.idleMs + time.hiddenMs + time.otherScreenMs + time.unobservedMs
}

/** A live clock is never serialized. Offline gaps after restore are explicitly
 * unobserved; wall-clock changes never become measured active time. */
export class ExerciseRecorder {
  private lastTick: number
  private lastActivity: number
  private editedStep: string | null = null
  private lastEdit = -Infinity
  private lastSubmission = new Map<string, string>()
  private stepId: string | null
  private visible: boolean
  private screen: AppScreen
  readonly trace: ExerciseUsage
  private readonly clock: UsageClock

  constructor(trace: ExerciseUsage, clock: UsageClock, visible: boolean, screen: AppScreen, restored = false) {
    this.trace = trace
    this.clock = clock
    this.lastTick = clock.monotonic()
    this.lastActivity = this.lastTick
    this.visible = visible
    this.screen = screen
    this.stepId = trace.steps[0]?.stepId ?? null
    for (const step of trace.steps) {
      step.hintRequests ??= 0
      if (step.lastAnswer !== null && !JSON.stringify(step.lastAnswer).includes('[truncated]')) {
        const answer = step.lastAnswer
        this.lastSubmission.set(step.stepId, JSON.stringify(answer, typeof answer === 'object' ? Object.keys(answer).sort() : undefined))
      }
    }
    if (restored) {
      const gap = clock.now() - Date.parse(trace.checkpointAt)
      trace.unobservedMs += Math.max(0, gap)
      trace.reloads += 1
      trace.timingReliable = false
      this.event('restored')
    }
  }

  flush(): void {
    const now = this.clock.monotonic()
    const delta = Math.max(0, now - this.lastTick)
    const time = emptyTime()
    if (!this.visible) time.hiddenMs = delta
    else if (this.screen !== 'exercise') time.otherScreenMs = delta
    else {
      time.activeMs = Math.min(delta, Math.max(0, this.lastActivity + IDLE_AFTER_MS - this.lastTick))
      time.idleMs = delta - time.activeMs
    }
    const step = this.trace.steps.find((s) => s.stepId === this.stepId)
    for (const key of TIME_KEYS) {
      // Keep fractional milliseconds between flushes; rounding every input
      // event systematically loses time during rapid typing or scrolling.
      const ms = time[key]
      this.trace[key] += ms
      if (step) step[key] += ms
    }
    this.lastTick = now
    this.trace.checkpointAt = new Date(this.clock.now()).toISOString()
  }

  activity(): void {
    this.flush()
    if (this.visible && this.screen === 'exercise') this.lastActivity = this.clock.monotonic()
  }

  focus(stepId: string, action?: 'step_select' | 'step_focus'): void {
    this.flush()
    if (this.stepId !== stepId) {
      this.stepId = stepId
      this.editedStep = null
      if (action) this.event(action, { stepId }, action === 'step_select')
    }
  }

  edit(stepId: string): void {
    this.focus(stepId)
    this.activity()
    const step = this.trace.steps.find((s) => s.stepId === stepId)
    if (!step) return
    this.firstAction(step)
    const now = this.clock.monotonic()
    if (this.editedStep !== stepId || now - this.lastEdit > EDIT_EPISODE_GAP_MS) {
      step.editEpisodes += 1
      this.event('edit', { stepId }, true)
    }
    this.editedStep = stepId
    this.lastEdit = now
  }

  submit(stepId: string, answer: ExerciseAnswer, validation: StepValidation, hintLevel: number, blank: boolean, committed = true, focus = true): void {
    if (focus) this.focus(stepId)
    this.activity()
    this.editedStep = null
    const step = this.trace.steps.find((s) => s.stepId === stepId)
    if (!step) return
    this.firstAction(step)
    step.firstSubmitMs ??= Math.round(step.activeMs)
    this.trace.firstSubmitMs ??= Math.round(this.trace.activeMs)
    step.submissions += 1
    if (blank) step.blankSubmissions += 1
    else if (validation.invalidFormat) step.invalidSubmissions += 1
    const serialized = JSON.stringify(answer, typeof answer === 'object' ? Object.keys(answer).sort() : undefined)
    if (this.lastSubmission.get(stepId) === serialized) step.repeatedSubmissions += 1
    this.lastSubmission.set(stepId, serialized)
    const bounded = boundedAnswer(answer)
    step.firstAnswer ??= bounded
    step.lastAnswer = bounded
    if (committed && !validation.invalidFormat) {
      const outcome = validation.isCorrect ? 'correct' : 'incorrect'
      step.firstOutcome ??= outcome
      step.lastOutcome = outcome
      step.correctedAfterError = step.firstOutcome === 'incorrect' && outcome === 'correct'
      if (validation.isCorrect) {
        step.hintLevelAtSuccess = hintLevel
        step.succeededAfterHint = step.hintRequests > 0 && hintLevel > 0 && hintLevel < 4
      }
    }
    if (validation.misconceptionId && !step.errorPatterns.includes(validation.misconceptionId)) {
      step.errorPatterns = [...step.errorPatterns, validation.misconceptionId].slice(-8)
    }
    this.event('submit', { stepId, answer: bounded, result: blank ? 'blank' : validation.invalidFormat ? 'invalid' : validation.isCorrect ? 'correct' : 'incorrect', level: hintLevel }, true)
  }

  hint(level: number, stepId: string): void {
    this.activity()
    this.trace.hints += 1
    const step = this.trace.steps.find((s) => s.stepId === stepId)
    if (step) {
      this.firstAction(step)
      step.hintRequests += 1
    }
    this.trace.revealed ||= level >= 4
    this.editedStep = null
    this.event(level >= 4 ? 'reveal' : 'hint', { stepId, level }, true)
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return
    this.flush()
    this.visible = visible
    if (visible) this.lastActivity = this.clock.monotonic()
    this.event(visible ? 'visible' : 'hidden')
  }

  setScreen(screen: AppScreen): void {
    if (this.screen === screen) return
    this.flush()
    this.screen = screen
    if (screen === 'exercise') this.lastActivity = this.clock.monotonic()
    this.event('screen', { screen })
  }

  event(action: UsageAction, details: Omit<UsageEvent, 'action' | 'offsetMs'> = {}, learnerAction = false): void {
    this.flush()
    this.trace.actionCounts[action] = (this.trace.actionCounts[action] ?? 0) + 1
    if (learnerAction) {
      this.trace.firstActionMs ??= Math.round(this.trace.activeMs)
    }
    this.trace.events.push({ offsetMs: Math.round(observedMs(this.trace)), action, ...details })
    if (this.trace.events.length > EVENT_LIMIT) {
      // Keep the beginning and the latest actions, with an explicit gap count.
      this.trace.events.splice(10, 1)
      this.trace.droppedEvents += 1
    }
  }

  private firstAction(step: StepUsage): void {
    step.firstActionMs ??= Math.round(step.activeMs)
    this.trace.firstActionMs ??= Math.round(this.trace.activeMs)
  }
}

function addExercise(totals: UsageTotals, trace: ExerciseUsage): void {
  totals.exercises += 1
  if (trace.end) totals[trace.end] += 1
  if (trace.firstAttemptCorrect !== null) {
    totals.assessed += 1
    if (trace.firstAttemptCorrect) totals.firstAttemptCorrect += 1
  }
  for (const key of TIME_KEYS) totals[key] += trace[key]
  for (const step of trace.steps) {
    if (step.firstOutcome !== null) totals.stepsSubmitted += 1
    if (step.correctedAfterError) totals.stepsCorrected += 1
    if (step.succeededAfterHint) totals.stepsSucceededAfterHint += 1
    totals.submissions += step.submissions
    totals.invalidSubmissions += step.invalidSubmissions
    totals.blankSubmissions += step.blankSubmissions
    totals.repeatedSubmissions += step.repeatedSubmissions
    totals.editEpisodes += step.editEpisodes
  }
  totals.hintRequests += trace.hints
  if (trace.revealed) totals.reveals += 1
  totals.departures += trace.actionCounts.hidden ?? 0
  totals.returns += trace.actionCounts.visible ?? 0
  totals.reloads += trace.reloads
  if (trace.timingReliable && trace.end === 'completed') {
    totals.timingSamples += 1
    if (totals.timedActiveMs !== null) totals.timedActiveMs += trace.activeMs
    const bucket = [15_000, 30_000, 60_000, 120_000, 300_000].findIndex((limit) => trace.activeMs <= limit)
    totals.activeTimeBuckets[bucket < 0 ? 5 : bucket] += 1
  }
}

/** Finalization and its summaries are persisted in the same snapshot. Pruning
 * never rolls up again, so exports, reloads and retries cannot double-count. */
export function finalizeExercise(usage: UsageData, recorder: ExerciseRecorder, end: ExerciseEnd, now: number, firstAttemptCorrect: boolean | null = null): void {
  const trace = recorder.trace
  if (trace.end !== null) return
  recorder.event(end)
  trace.endedAt = new Date(now).toISOString()
  trace.end = end
  trace.firstAttemptCorrect = firstAttemptCorrect
  addExercise(usage.lifetime, trace)
  const date = trace.endedAt.slice(0, 10)
  const month = date.slice(0, 7)
  let daily = usage.daily.find((b) => b.date === date)
  if (!daily) usage.daily.push(daily = { date, totals: emptyTotals() })
  addExercise(daily.totals, trace)
  let monthly = usage.monthly.find((b) => b.month === month)
  if (!monthly) usage.monthly.push(monthly = { month, totals: emptyTotals() })
  addExercise(monthly.totals, trace)
  let skill = usage.bySkill.find((b) => b.skillId === trace.skillId)
  if (!skill) usage.bySkill.push(skill = { skillId: trace.skillId, totals: emptyTotals() })
  addExercise(skill.totals, trace)
  let format = usage.byFormat.find((b) => b.archetypeId === trace.archetypeId && b.scaffold === trace.scaffold && b.mode === trace.mode)
  if (!format) usage.byFormat.push(format = { archetypeId: trace.archetypeId, scaffold: trace.scaffold, mode: trace.mode, totals: emptyTotals() })
  addExercise(format.totals, trace)
  const practice = usage.currentPractice
  if (practice && trace.practiceId === practice.id) {
    if (end === 'completed') practice.completed += 1
    if (end === 'skipped') practice.skipped += 1
  }
  usage.exercises.push(trace)
  usage.activeExercise = null
}

export function finishPractice(usage: UsageData, status: 'completed' | 'stopped' | 'replaced' | 'interrupted', now: number): void {
  const practice = usage.currentPractice
  if (!practice) return
  practice.status = status
  practice.endedAt = new Date(now).toISOString()
  usage.sessions.push(practice)
  usage.sessionCounts[status] += 1
  usage.currentPractice = null
}

export function pruneUsage(usage: UsageData, now: number): void {
  const cutoff = new Date(now - DETAIL_DAYS * DAY_MS).toISOString()
  const exercises = usage.exercises.filter((e) => e.endedAt && e.endedAt >= cutoff).slice(-DETAIL_LIMIT)
  usage.retention.prunedExercises += usage.exercises.length - exercises.length
  usage.exercises = exercises
  const sessions = usage.sessions.filter((s) => s.endedAt && s.endedAt >= cutoff).slice(-100)
  usage.retention.prunedSessions += usage.sessions.length - sessions.length
  usage.sessions = sessions
  const dayCutoff = new Date(now - 89 * DAY_MS).toISOString().slice(0, 10)
  usage.daily = usage.daily.filter((b) => b.date >= dayCutoff).sort((a, b) => a.date.localeCompare(b.date)).slice(-90)
  const today = new Date(now)
  const monthCutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 23, 1)).toISOString().slice(0, 7)
  usage.monthly = usage.monthly.filter((b) => b.month >= monthCutoff).sort((a, b) => a.month.localeCompare(b.month)).slice(-24)
  // Catalog dimensions are finite; also guard against old catalogs and imports.
  if (usage.bySkill.length > 150) {
    usage.retention.prunedSkillSummaries += usage.bySkill.length - 150
    usage.bySkill = usage.bySkill.slice(-150)
  }
  if (usage.byFormat.length > 200) {
    usage.retention.prunedFormatSummaries += usage.byFormat.length - 200
    usage.byFormat = usage.byFormat.slice(-200)
  }
}

/** Drop optional history first. Essential skill state, current work, current
 * trace, lifetime counts and recent gate evidence are never discarded. */
export function shrinkUsage(usage: UsageData): boolean {
  const traced = usage.exercises.find((e) => e.events.length > 0)
  if (traced) {
    traced.droppedEvents += traced.events.length
    traced.events = []
    return true
  }
  if (usage.exercises.length > 0) {
    usage.exercises.shift()
    usage.retention.prunedExercises += 1
    return true
  }
  if (usage.sessions.length > 0) {
    usage.sessions.shift()
    usage.retention.prunedSessions += 1
    return true
  }
  if (usage.daily.length > 7) { usage.daily.shift(); return true }
  if (usage.byFormat.length > 0) {
    usage.byFormat.shift()
    usage.retention.prunedFormatSummaries += 1
    return true
  }
  if (usage.bySkill.length > 0) {
    usage.bySkill.shift()
    usage.retention.prunedSkillSummaries += 1
    return true
  }
  if (usage.monthly.length > 0) { usage.monthly.shift(); return true }
  if (usage.daily.length > 0) { usage.daily.shift(); return true }
  return false
}
