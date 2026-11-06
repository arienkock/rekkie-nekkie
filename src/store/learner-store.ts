/**
 * LearnerStore: the runtime tying graph, evidence engine, selector,
 * generators and persistence together. Owns the active practice session and
 * implements the core learning loop state machine (docs §4.1) in a pragmatic
 * form: presenting → working → (submitting/diagnosing) → feedback →
 * retrying → completing (evidence commit) → next.
 */
import { KNOWLEDGE_GRAPH, getSkill } from '../domain/knowledge-graph'
import type {
  ExerciseAnswer,
  ExerciseSessionState,
  ExerciseWorkState,
  GeneratedExercise,
  LearnerSnapshot,
  LearnerSkillState,
  ScaffoldTier,
  SkillId,
  StepValidation,
} from '../domain/types'
import {
  CATALOG_VERSION,
  EVIDENCE_WEIGHTS,
  MODEL_VERSION,
  SCHEMA_VERSION,
} from '../domain/types'
import { applyObservationToSkill, newSkillState } from '../engine/evidence'
import { evaluatePromotion, confirmedLapse } from '../engine/mastery'
import { deriveFreshness } from '../engine/memory'
import { randomSeed, SeededRng } from '../engine/rng'
import { chooseStartTier, decideFade, decideReSupport, tierIndex } from '../engine/scaffolding'
import { selectNextSkill } from '../engine/selector'
import { generateExercise, generateTestBlockFor, hasGenerator, CURRICULUM_SKILLS, SUPPORTED_SKILLS } from '../generators'
import { blockPassed } from '../generators/test-block'
import { currentLessons, lessonById, proeftoetsById, type Proeftoets } from '../domain/learning-path'
import {
  canonicalStringify,
  checksumOf,
  LocalStorageDriver,
  MemoryDriver,
  ProfileStore,
  ProfileBudgetError,
  StorageConflictError,
  type StorageDriver,
} from '../storage/persistence'
import { validateSnapshot } from '../storage/validate-snapshot'

import { DEFAULT_TABLES, TABLES } from '../generators/multiplication-facts'
import type { ProeftoetsGroupResult, SessionResult } from '../domain/practice-types'
import type { AppScreen, ExerciseEnd, ExerciseUsage, PracticeMode, SkipReason, UsageData } from '../analytics/types'
import {
  APP_VERSION, ExerciseRecorder, emptyTime, finalizeExercise, finishPractice, newStepUsage, newUsage,
  PROFILE_BUDGET_BYTES, pruneUsage, shrinkUsage, SNAPSHOT_TARGET_BYTES, systemClock,
  USAGE_DEFINITIONS, type UsageClock,
} from '../analytics/usage'

export type { PracticeMode } from '../analytics/types'
export type { ProeftoetsGroupResult, SessionResult } from '../domain/practice-types'
export const SESSION_TARGET_ITEMS = 8
/** The next hint waits this long after the previous one, so it gets read
 *  (she clicked through all three hints to the answer in two seconds). */
export const HINT_PAUSE_MS = 5_000
/** A supported (S0/S1) item answered right first time, without hints, within
 *  this much active time per step shows she already knows it: go straight
 *  to Zelf (S2), where her answers count fully. */
export const FLUENT_MS_PER_STEP = 15_000
/** Her class is in blok 2 (October 2026); a parent can change it in Instellingen. */
export const DEFAULT_BLOK_ID = 'blok-2'

/** The result of checking a whole test-format block at once. */
export interface BlockCheck {
  /** Steps whose answer could not be read (fix the notation, nothing recorded). */
  invalid: string[]
  /** Steps left empty. Unless the check confirmed them, nothing is recorded:
   *  a field hidden under the keyboard must not fail the page. */
  blank: string[]
  results: Record<string, StepValidation>
}

function freshSnapshot(profileId: string): LearnerSnapshot {
  const skills: Record<SkillId, LearnerSkillState> = {}
  for (const n of KNOWLEDGE_GRAPH) skills[n.id] = newSkillState(n.id)
  return {
    schemaVersion: SCHEMA_VERSION,
    catalogVersion: CATALOG_VERSION,
    modelVersion: MODEL_VERSION,
    profileId,
    revision: 0,
    savedAt: new Date().toISOString(),
    checksum: '',
    preferences: { nickname: null, reducedMotion: false, chosenTheme: null },
    skills,
    observations: [],
    learningTransitions: [],
    recentExerciseFingerprints: [],
    lastAppliedSequence: 0,
    totalExercisesCompleted: 0,
  }
}

export class LearnerStore {
  private profileStore: ProfileStore<LearnerSnapshot>
  private listeners = new Set<() => void>()
  private sessionRng = new SeededRng(randomSeed())
  private recorder: ExerciseRecorder | null = null
  private clock: UsageClock
  private visible = true
  private screen: AppScreen = 'exercise'
  private workSaveTimer: ReturnType<typeof setTimeout> | null = null
  readonly visitId = `visit-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
  /** Stable profile identifier this store persists under. */
  readonly profileId: string

  /** In-progress session state; null between sessions. */
  currentSession: ExerciseSessionState | null = null
  practiceMode: PracticeMode = 'curriculum'
  selectedTables: number[] = [...DEFAULT_TABLES]
  sessionItemPurposes: string[] = []
  sessionItemsDone = 0
  sessionResults: SessionResult[] = []
  /** Primary skills of the last few served items (selector anti-repetition). */
  sessionRecentSkills: SkillId[] = []
  /** After a revealed answer: serve one fresh item of the same skill and
   *  tier next ("Nu jij"), so a reveal never ends the practice. */
  private pendingSibling: { skillId: SkillId; tier: ScaffoldTier; usageId: string } | null = null
  /** Lesson practice: the lesson whose skills this session draws from. */
  lessonId: string | null = null
  /** Practice test in progress (or just finished, for the summary). */
  proeftoets: Proeftoets | null = null
  proeftoetsResults: ProeftoetsGroupResult[] = []
  lastSelectionExplanation = ''
  /** True when the last checkpoint save failed (visible recovery path). */
  saveFailed = false
  /** Recovery is explicit: never silently overwrite unreadable/future progress. */
  storageIssue: string | null = null
  private protectedExport: string | null = null
  private writerPending = false
  private deferredSave = false

  constructor(
    profileId: string,
    driver: StorageDriver = defaultDriver(),
    clock: UsageClock = systemClock,
  ) {
    this.clock = clock
    this.profileId = profileId
    this.profileStore = new ProfileStore<LearnerSnapshot>(profileId, driver)
    this.snapshot = this.restoreOrInit()
    try {
      validateSnapshot(this.snapshot)
      this.normalizeSnapshot()
      this.restorePractice()
      this.recomputeFreshness(new Date(this.clock.now()))
      if (!this.storageIssue) this.protectedExport = null
    } catch {
      this.protectStoredProgress()
      try {
        // Optional telemetry can be unreadable while learning progress is
        // intact. Display that progress, but export the untouched original.
        const display = { ...this.snapshot, usage: undefined, practice: null }
        validateSnapshot(display)
        this.snapshot = display
        this.normalizeSnapshot()
        this.recomputeFreshness(new Date(this.clock.now()))
      } catch {
        this.snapshot = freshSnapshot(profileId)
        this.snapshot.usage = newUsage(this.clock.now())
      }
      this.resetPracticeRuntime()
    }
    this.saveFailed = this.storageIssue !== null
  }

  snapshot: LearnerSnapshot

  get usage(): UsageData { return this.snapshot.usage! }

  // ---- Store plumbing ----

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }

  private restoreOrInit(): LearnerSnapshot {
    // Restore before selecting work; never overwrite progress with defaults.
    try {
      const record = this.profileStore.load((data) => canonicalStringify(data))
      if (record) {
        this.protectedExport = JSON.stringify(record.data, null, 2)
        if (record.data.schemaVersion === SCHEMA_VERSION) {
          const journal = this.profileStore.readJournalRaw()
          if (journal !== null) {
            record.data.recoveredLegacyJournals ??= []
            if (!record.data.recoveredLegacyJournals.includes(journal)) record.data.recoveredLegacyJournals.push(journal)
            this.protectedExport = JSON.stringify(record.data, null, 2)
          }
          return record.data
        }
        this.protectStoredProgress()
      } else if (this.profileStore.hasStoredData()) {
        this.protectedExport = this.profileStore.recoveryJson()
        this.protectStoredProgress()
      }
    } catch {
      // A temporary read failure is not evidence of an empty profile.
      this.protectStoredProgress()
    }
    return freshSnapshot(this.profileId)
  }

  /** Checkpoint save of the current snapshot (also used by tests and unload). */
  persist(): void {
    if (this.workSaveTimer !== null) {
      clearTimeout(this.workSaveTimer)
      this.workSaveTimer = null
    }
    if (this.writerPending) { this.deferredSave = true; this.notify(); return }
    if (this.storageIssue) { this.saveFailed = true; this.notify(); return }
    this.recorder?.flush()
    this.capturePractice()
    const candidate = this.checkpointCandidate()
    candidate.revision += 1
    candidate.savedAt = new Date(this.clock.now()).toISOString()
    this.saveFailed = false
    try {
      this.compactSnapshot(candidate)
      try {
        this.saveSnapshot(candidate)
      } catch (error) {
        if (!(error instanceof ProfileBudgetError) && !isQuotaError(error)) throw error
        // A smaller actual browser quota can still reject our conservative
        // budget. Sacrifice optional history, then retry the progress save.
        while (shrinkUsage(candidate.usage!)) { /* bounded optional history */ }
        candidate.learningTransitions = []
        candidate.observations = candidate.observations.slice(-20)
        this.saveSnapshot(candidate)
      }
      this.snapshot = candidate
    } catch (error) {
      if (error instanceof StorageConflictError) this.externalProgressChanged()
      // Visible recovery path: the UI shows a save-failure banner (§4.1).
      this.saveFailed = true
    }
    this.notify()
  }

  /** Only optional completed history is copied: a failed save must leave the
   * live history/export intact, and the recorder keeps its current trace. */
  private checkpointCandidate(): LearnerSnapshot {
    return { ...this.snapshot, observations: this.snapshot.observations.slice(), learningTransitions: this.snapshot.learningTransitions.slice(),
      usage: { ...this.usage, exercises: this.usage.exercises.map((e) => ({ ...e, events: e.events.slice() })),
        sessions: this.usage.sessions.slice(), daily: this.usage.daily.slice(), monthly: this.usage.monthly.slice(),
        bySkill: this.usage.bySkill.slice(), byFormat: this.usage.byFormat.slice(), retention: { ...this.usage.retention } },
    }
  }

  private saveSnapshot(snapshot: LearnerSnapshot): void {
    const record = { revision: snapshot.revision, savedAt: snapshot.savedAt, data: snapshot }
    this.profileStore.save(record, canonicalStringify, PROFILE_BUDGET_BYTES, true)
    try { this.profileStore.clearJournal() } catch { /* The committed snapshot is authoritative. */ }
  }

  private compactSnapshot(snapshot: LearnerSnapshot): void {
    pruneUsage(snapshot.usage!, this.clock.now())
    snapshot.observations = snapshot.observations.slice(-200)
    snapshot.learningTransitions = snapshot.learningTransitions.slice(-200)
    while (JSON.stringify(snapshot).length * 2 > SNAPSHOT_TARGET_BYTES) {
      if (shrinkUsage(snapshot.usage!)) continue
      if (snapshot.learningTransitions.length) { snapshot.learningTransitions.shift(); continue }
      if (snapshot.observations.length) { snapshot.observations.shift(); continue }
      break
    }
  }

  private saveWorkSoon(): void {
    if (typeof window === 'undefined' || this.workSaveTimer !== null) return
    this.workSaveTimer = setTimeout(() => { this.workSaveTimer = null; this.persist() }, 500)
  }

  /** Fill in fields added after a snapshot was first persisted. */
  private normalizeSnapshot(): void {
    this.snapshot.totalExercisesCompleted ??= 0
    this.snapshot.usage ??= newUsage(this.clock.now())
    this.usage.retention.prunedSkillSummaries ??= 0
    const aggregates = [this.usage.lifetime, ...this.usage.daily.map((b) => b.totals),
      ...this.usage.monthly.map((b) => b.totals), ...this.usage.bySkill.map((b) => b.totals),
      ...this.usage.byFormat.map((b) => b.totals)]
    for (const totals of aggregates) {
      // An older partial export can lack the reliable-time sum. Never turn
      // missing historical timing into a fabricated zero-minute average.
      totals.timedActiveMs ??= totals.timingSamples === 0 ? 0 : null
    }
    // Historical activeTimeMs values were hard-coded, not measurements.
    for (const observation of this.snapshot.observations) {
      if (!observation.timingMeasured) {
        if (typeof observation.activeTimeMs === 'number') observation.legacyActiveTimeMs ??= observation.activeTimeMs
        observation.activeTimeMs = null
        observation.timingMeasured = false
      }
    }
    const selected = this.snapshot.preferences.selectedTables
    this.snapshot.preferences.selectedTables = Array.isArray(selected)
      ? [...new Set(selected)].filter((n) => TABLES.includes(n)) : [...DEFAULT_TABLES]
    // Carry restored profiles forward to the active evidence rules. This is a
    // metadata update only: existing observations, counters, and star levels
    // remain intact.
    this.snapshot.modelVersion = MODEL_VERSION
    for (const state of Object.values(this.snapshot.skills)) {
      state.memory.delayedSuccessGapsDays ??= []
    }
    // Skills added to the graph after this profile was created start fresh.
    for (const node of KNOWLEDGE_GRAPH) this.snapshot.skills[node.id] ??= newSkillState(node.id)
    this.snapshot.focusSkills ??= []
  }

  /** Freshness is derived, never authoritative: recompute from due dates. */
  private recomputeFreshness(now: Date): void {
    for (const state of Object.values(this.snapshot.skills)) {
      state.memory.freshness = deriveFreshness(state.memory, state.currentVerifiedLevel, now)
    }
  }

  exportJson(): string {
    if (this.storageIssue && this.protectedExport) return this.protectedExport
    if (this.storageIssue) throw new Error('Existing progress cannot be read safely')
    this.persist()
    return JSON.stringify({
      ...this.snapshot, checksum: undefined, exportedAt: new Date(this.clock.now()).toISOString(),
      usageDefinitions: USAGE_DEFINITIONS,
    }, null, 2)
  }

  importJson(json: string): boolean {
    try {
      // Legacy exports predate retention and can be larger when pretty-printed.
      if (json.length > 16 * 1024 * 1024) return false
      const parsed = JSON.parse(json) as LearnerSnapshot & { exportedAt?: string; usageDefinitions?: unknown }
      if (parsed.schemaVersion !== SCHEMA_VERSION) return false
      if (!parsed.skills || typeof parsed.revision !== 'number') return false
      // Tampered exports must never silently overwrite progress: verify the
      // embedded checksum when present (exports strip it).
      if (parsed.checksum && parsed.checksum !== checksumOf(canonicalStringify(parsed))) return false
      if (parsed.usage && parsed.usage.version !== 1) return false
      validateSnapshot(parsed)
      delete parsed.exportedAt
      delete parsed.usageDefinitions
      // Stage normalization and resume validation before replacing live work.
      const candidate = new LearnerStore(this.profileId, new MemoryDriver(), this.clock)
      candidate.snapshot = { ...parsed, profileId: this.profileId }
      candidate.normalizeSnapshot()
      candidate.restorePractice()
      // Explicit import replaces the current history. Its new commit must
      // outrank both existing slots, even if the export itself is much older.
      const current = this.profileStore.load(canonicalStringify)
      candidate.snapshot.revision = Math.max(candidate.snapshot.revision, this.snapshot.revision, current?.revision ?? 0)
      this.resetPracticeRuntime()
      this.snapshot = candidate.snapshot
      this.storageIssue = null
      this.protectedExport = null
      this.restorePractice(false)
      this.recomputeFreshness(new Date(this.clock.now()))
      this.persist()
      return true
    } catch {
      return false
    }
  }

  private protectStoredProgress(): void {
    this.storageIssue = 'Je bestaande gegevens zijn beschermd. Opslaan is gepauzeerd. Exporteer ze via Instellingen om ze te herstellen.'
  }

  externalProgressChanged(): void {
    if (this.storageIssue) return
    this.recorder?.flush()
    this.capturePractice()
    this.storageIssue = 'Je voortgang is in een ander tabblad veranderd. Sluit dit tabblad en ga daar verder, of laad deze pagina opnieuw.'
    // Export the current in-memory work for recovery without pretending it is
    // the newer on-device state, and without dropping any optional history.
    this.protectedExport = JSON.stringify({ ...this.snapshot, checksum: undefined,
      recoveryReason: 'newer-progress-in-another-tab', exportedAt: new Date(this.clock.now()).toISOString(),
    }, null, 2)
    this.saveFailed = true
    this.notify()
  }

  requireWriterLease(): void { this.writerPending = true }

  grantWriterLease(): void {
    this.writerPending = false
    if (this.deferredSave) { this.deferredSave = false; this.persist() }
  }

  private resetPracticeRuntime(): void {
    this.currentSession = null
    this.recorder = null
    this.practiceMode = 'curriculum'
    this.lessonId = null
    this.proeftoets = null
    this.proeftoetsResults = []
    this.sessionItemPurposes = []
    this.sessionItemsDone = 0
    this.sessionResults = []
    this.sessionRecentSkills = []
    this.pendingSibling = null
    this.lastSelectionExplanation = ''
    this.selectedTables = [...DEFAULT_TABLES]
  }

  private capturePractice(): void {
    if (!this.usage.currentPractice) { this.snapshot.practice = null; return }
    const session = this.currentSession
    let exercise = null
    if (session?.exercise.recipe) {
      const { exercise: generated, ...state } = session
      exercise = { recipe: generated.recipe!, signature: exerciseSignature(generated), session: state }
    }
    this.snapshot.practice = {
      mode: this.practiceMode, selectedTables: this.selectedTables, lessonId: this.lessonId,
      proeftoetsId: this.proeftoets?.id ?? null, proeftoetsResults: this.proeftoetsResults,
      itemPurposes: this.sessionItemPurposes, itemsDone: this.sessionItemsDone, results: this.sessionResults,
      recentSkills: this.sessionRecentSkills, pendingSibling: this.pendingSibling,
      selectionExplanation: this.lastSelectionExplanation, exercise,
    }
  }

  private restorePractice(countRestore = true): void {
    const saved = this.snapshot.practice
    const trace = this.usage.activeExercise
    if (!saved || !this.usage.currentPractice) return
    this.practiceMode = saved.mode
    this.selectedTables = saved.selectedTables
    this.lessonId = saved.lessonId
    this.proeftoets = saved.proeftoetsId ? proeftoetsById(saved.proeftoetsId) : null
    this.proeftoetsResults = saved.proeftoetsResults
    this.sessionItemPurposes = saved.itemPurposes
    this.sessionItemsDone = saved.itemsDone
    this.sessionResults = saved.results
    this.sessionRecentSkills = saved.recentSkills
    this.pendingSibling = saved.pendingSibling
    this.lastSelectionExplanation = saved.selectionExplanation
    if (!saved.exercise || !trace) return
    try {
      const { recipe, signature, session } = saved.exercise
      const generated = recipe.format === 'block' ? generateTestBlockFor(recipe, recipe.size) : generateExercise(recipe)
      if (exerciseSignature(generated) !== signature || trace.id !== session.id) throw new Error('Exercise changed')
      this.currentSession = { ...session, exercise: generated }
      this.recorder = new ExerciseRecorder(trace, this.clock, this.visible, this.screen, countRestore)
      this.recorder.focus(generated.steps[session.work.stepIndex]?.id ?? generated.steps[0]!.id)
    } catch {
      // Generator changes never turn an old submitted response into evidence
      // for a different problem. Keep a truthful interrupted trace instead.
      trace.interruptionReason = 'exercise-could-not-be-restored'
      trace.unrestorablePractice = saved
      const recorder = new ExerciseRecorder(trace, this.clock, this.visible, this.screen, countRestore)
      finalizeExercise(this.usage, recorder, 'interrupted', this.clock.now())
      finishPractice(this.usage, 'interrupted', this.clock.now())
      this.snapshot.practice = null
      this.resetPracticeRuntime()
    }
  }

  /** Browser lifecycle and input activity are observed locally only. */
  activity(): void { this.recorder?.activity() }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return
    this.visible = visible
    this.recorder?.setVisible(visible)
    if (this.currentSession || this.usage.currentPractice) this.persist()
  }

  setScreen(screen: AppScreen): void {
    if (this.screen === screen) return
    this.screen = screen
    this.recorder?.setScreen(screen)
    if (this.currentSession) this.persist()
  }

  focusStep(index: number): void {
    const step = this.currentSession?.exercise.steps[index]
    if (step) this.recorder?.focus(step.id, 'step_focus')
  }

  selectStep(index: number): void {
    const step = this.currentSession?.exercise.steps[index]
    if (step) this.recorder?.focus(step.id, 'step_select')
  }

  editAnswer(index: number, answer: ExerciseAnswer): void {
    const session = this.currentSession
    if (!session) return
    const step = session.exercise.steps[index]
    if (!step || JSON.stringify(session.work.answers[index]) === JSON.stringify(answer)) return
    this.recorder?.edit(step.id)
    const answers = [...session.work.answers]
    answers[index] = answer
    this.setExerciseWork('answers', answers)
  }

  private finishUsage(end: ExerciseEnd, correct: boolean | null = null): void {
    if (!this.recorder) return
    finalizeExercise(this.usage, this.recorder, end, this.clock.now(), correct)
    this.recorder = null
  }

  // ---- Reading state ----

  skillState(skillId: SkillId): LearnerSkillState {
    return this.snapshot.skills[skillId] ?? newSkillState(skillId)
  }

  /** Update learner preferences (nickname, motion, theme) and persist. */
  savePreferences(prefs: Partial<LearnerSnapshot['preferences']>): void {
    if (this.storageIssue) return
    this.snapshot.preferences = { ...this.snapshot.preferences, ...prefs }
    this.persist()
  }

  // ---- Session flow ----

  /** Items in the running session: 8, or one per group of a proeftoets. */
  get sessionTargetItems(): number {
    return this.practiceMode === 'proeftoets' && this.proeftoets ? this.proeftoets.groups.length : SESSION_TARGET_ITEMS
  }

  startSession(
    mode: PracticeMode = 'curriculum',
    tables: number[] = DEFAULT_TABLES,
    options: { lessonId?: string; proeftoetsId?: string } = {},
  ): ExerciseSessionState | null {
    if (this.storageIssue) return null
    const validTables = [...new Set(tables)].filter((n) => TABLES.includes(n))
    if (mode === 'tables' && validTables.length === 0) return null
    if (mode === 'lesson' && !lessonById(options.lessonId ?? '')) return null
    if (mode === 'proeftoets' && !proeftoetsById(options.proeftoetsId ?? '')) return null
    this.finishUsage('replaced')
    finishPractice(this.usage, 'replaced', this.clock.now())
    this.practiceMode = mode
    this.selectedTables = validTables
    this.lessonId = mode === 'lesson' ? options.lessonId! : null
    this.proeftoets = mode === 'proeftoets' ? proeftoetsById(options.proeftoetsId!) : null
    this.proeftoetsResults = []
    this.sessionItemPurposes = []
    this.sessionItemsDone = 0
    this.sessionResults = []
    this.sessionRecentSkills = []
    this.pendingSibling = null
    this.usage.currentPractice = {
      id: `practice-${randomSeed()}`, startedAt: new Date(this.clock.now()).toISOString(), endedAt: null,
      mode, lessonId: this.lessonId, proeftoetsId: this.proeftoets?.id ?? null,
      target: this.sessionTargetItems, completed: 0, skipped: 0, status: 'in_progress',
    }
    return this.nextExercise()
  }

  /** Select and present the next exercise, or null when the session is done. */
  nextExercise(): ExerciseSessionState | null {
    if (this.storageIssue) return null
    if (this.sessionItemsDone >= this.sessionTargetItems) {
      this.currentSession = null
      finishPractice(this.usage, 'completed', this.clock.now())
      this.persist()
      return null
    }
    if (this.usage.currentPractice) this.usage.currentPractice.status = 'in_progress'
    if (this.practiceMode === 'proeftoets' && this.proeftoets) return this.nextProeftoetsGroup(this.proeftoets)
    const sibling = this.pendingSibling
    this.pendingSibling = null
    const lesson = this.practiceMode === 'lesson' && this.lessonId ? lessonById(this.lessonId) : null
    const selection = sibling ? {
      skillId: sibling.skillId,
      purpose: 'growth' as const,
      explanationNl: 'Nu jij: eentje zoals net, maar dan zelf.',
    } : selectNextSkill(
      {
        skills: {
          supported: this.practiceMode === 'tables'
            ? this.selectedTables.map((n) => `MUL.FACT.T${n}`)
            : lesson ? lesson.skills.filter(hasGenerator) : this.pathSkillsForSession(),
          states: this.snapshot.skills,
          practisable: SUPPORTED_SKILLS,
        },
        recentPurposes: this.sessionItemPurposes as never[],
        recentSkillIds: this.sessionRecentSkills,
        now: new Date(this.clock.now()),
        // Skill-directed practice ("vrij oefenen") is a future feature;
        // chosenTheme is a ThemeId, not a SkillId, and must not leak in here.
        intentSkill: null,
        focusSkills: this.snapshot.focusSkills ?? [],
      },
      () => this.sessionRng.next(),
    )
    if (!selection) {
      finishPractice(this.usage, 'interrupted', this.clock.now())
      this.currentSession = null
      this.persist()
      return null
    }
    this.lastSelectionExplanation = selection.explanationNl

    const state = this.skillState(selection.skillId)
    // Merge the fade-managed tier with the competence-based start tier:
    // chooseStartTier may jump ahead for strong prior competence, but never
    // reduces support below the fade ladder's current tier.
    const startTier = chooseStartTier(state)
    const managedTier = state.scaffolding.currentTier
    let tier: ScaffoldTier = sibling
      ? sibling.tier
      : state.exposureCount === 0
        ? 'S0'
        : tierIndex(startTier) > tierIndex(managedTier)
          ? startTier
          : managedTier
    // Never open a session with a whole test page: she quit one within a
    // minute. The first item is a single "Zelf" item; test pages follow.
    if (tier === 'S3' && this.sessionItemsDone === 0) tier = 'S2'
    const band =
      selection.purpose === 'review'
        ? 'standard'
        : state.masteryProbability < 0.45
          ? 'easier'
          : state.masteryProbability < 0.85
            ? 'standard'
            : 'harder'

    let exercise: GeneratedExercise | null = null
    for (let attempt = 0; attempt < 6 && !exercise; attempt++) {
      try {
        // S3 is the test format: a block of book-format items without help.
        const candidate = (tier === 'S3' ? generateTestBlockFor : generateExercise)({
          seed: `${selection.skillId}:${this.snapshot.revision}:${this.sessionItemsDone}:${attempt}:${randomSeed()}`,
          tier,
          band,
          purpose: selection.purpose,
          primarySkillId: selection.skillId,
        })
        const repeated = this.snapshot.recentExerciseFingerprints.slice(-20).includes(candidate.fingerprint)
        if (!repeated || attempt === 5) exercise = candidate
      } catch {
        // Constraint failure: fresh seed, try again.
      }
    }
    if (!exercise) {
      // Constraint failures are rare; retry the SAME skill with safe support
      // settings rather than silently switching skills (which would misroute
      // evidence and invalidate the selection explanation).
      try {
        exercise = generateExercise({
          seed: `${selection.skillId}:fallback:${this.snapshot.revision}:${randomSeed()}`,
          tier: 'S1',
          band: 'standard',
          purpose: 'free',
          primarySkillId: selection.skillId,
        })
      } catch {
        exercise = null
      }
    }
    if (!exercise) {
      finishPractice(this.usage, 'interrupted', this.clock.now())
      this.currentSession = null
      this.persist()
      return null
    }
    return this.present(exercise, exercise.recipe?.tier ?? tier, sibling !== null, sibling?.usageId ?? null)
  }

  /**
   * A general session follows the path of the current blok (default: blok 2,
   * where her class is), plus anything already practised that is due for
   * review — not all 100 skills at once.
   */
  pathSkillsForSession(): SkillId[] {
    const blokId = this.snapshot.preferences.currentBlokId ?? DEFAULT_BLOK_ID
    const window = currentLessons(blokId, this.snapshot.skills).flatMap((l) => l.skills)
    const practised = CURRICULUM_SKILLS.filter((id) => (this.snapshot.skills[id]?.currentVerifiedLevel ?? 0) >= 1)
    const focus = this.snapshot.focusSkills ?? []
    return [...new Set([...window, ...practised, ...focus])].filter((id) => hasGenerator(id))
  }

  /** Practice test: the next group is a block in test format, in the book's order. */
  private nextProeftoetsGroup(test: Proeftoets): ExerciseSessionState | null {
    const group = test.groups[this.sessionItemsDone]!
    const exercise = generateTestBlockFor({
      seed: `${test.id}:${group.skillId}:${this.snapshot.revision}:${randomSeed()}`,
      tier: 'S3',
      band: 'standard',
      purpose: 'diagnostic',
      primarySkillId: group.skillId,
      variant: group.variant,
    }, group.items)
    this.lastSelectionExplanation = `${test.titleNl}: opdracht ${this.sessionItemsDone + 1} van ${test.groups.length}.`
    return this.present(exercise, 'S3', false)
  }

  private present(exercise: GeneratedExercise, tier: ScaffoldTier, sibling: boolean, siblingOf: string | null = null): ExerciseSessionState {
    // Defensive callers may advance without closing the open exercise.
    this.finishUsage('replaced')
    this.currentSession = {
      id: `sess-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      visitId: this.visitId,
      exercise,
      work: {
        stepIndex: 0, feedback: null, hint: null, noteOpen: false,
        answers: exercise.steps.map(() => ''),
        solved: exercise.steps.map(() => false),
      },
      currentScaffold: tier,
      highestAssistanceUsed: tier,
      hintLevel: 0,
      steps: exercise.steps.map((s) => ({
        stepId: s.id,
        firstAnswer: null,
        outcome: 'unknown',
        attemptCount: 0,
      })),
      phase: 'working',
      attempts: 0,
      startedAt: new Date(this.clock.now()).toISOString(),
      evidenceWeight:
        tier === 'S0' || tier === 'S1'
          ? EVIDENCE_WEIGHTS.scaffoldedPrediction
          : EVIDENCE_WEIGHTS.independent,
      lastSavedAt: null,
      isSibling: sibling,
    }
    const trace: ExerciseUsage = {
      ...emptyTime(), id: this.currentSession.id, exerciseId: exercise.id,
      practiceId: this.usage.currentPractice?.id ?? 'untracked-practice', visitId: this.currentSession.visitId,
      appVersion: APP_VERSION, catalogVersion: CATALOG_VERSION, modelVersion: MODEL_VERSION,
      skillId: exercise.primarySkillId, archetypeId: exercise.archetypeId,
      seed: exercise.recipe?.seed ?? exercise.seed, fingerprint: exercise.fingerprint,
      instructionNl: exercise.instructionNl.slice(0, 600), mode: this.practiceMode,
      lessonId: this.lessonId, proeftoetsId: this.proeftoets?.id ?? null,
      position: this.sessionItemsDone + 1, scaffold: tier, difficulty: exercise.difficultyBand,
      purpose: exercise.purpose, selectionReasonNl: this.lastSelectionExplanation.slice(0, 400),
      representation: exercise.representation, format: exercise.format ?? 'item', siblingOf,
      startedAt: this.currentSession.startedAt, checkpointAt: this.currentSession.startedAt,
      endedAt: null, end: null, firstActionMs: null, firstSubmitMs: null,
      actionCounts: {}, hints: 0, revealed: false, reloads: 0, firstAttemptCorrect: null,
      steps: exercise.steps.map(newStepUsage), events: [], droppedEvents: 0, timingReliable: true,
    }
    this.usage.activeExercise = trace
    this.recorder = new ExerciseRecorder(trace, this.clock, this.visible, this.screen)
    this.sessionItemPurposes.push(exercise.purpose)
    this.sessionRecentSkills = [...this.sessionRecentSkills, exercise.primarySkillId].slice(-3)
    this.persist()
    return this.currentSession
  }

  /** Update presentation state without committing or changing learning evidence. */
  setExerciseWork<K extends keyof ExerciseWorkState>(key: K, value: ExerciseWorkState[K]): void {
    if (!this.currentSession) return
    if (key === 'stepIndex' && typeof value === 'number') {
      const step = this.currentSession.exercise.steps[value]
      if (step) this.recorder?.focus(step.id)
    }
    if (key === 'noteOpen' && value !== this.currentSession.work.noteOpen) {
      this.recorder?.event('selection_note', {}, true)
    }
    this.currentSession.work[key] = value
    this.saveWorkSoon()
    this.notify()
  }

  /** Validate a learner answer for the given step (no evidence yet).
   *  Blank or unparseable input stays in `working` and never becomes
   *  wrong-math evidence (docs §4.1: "invalid formatting remains in working"). */
  submitStepAnswer(stepId: string, answer: string | number | Record<string, string | number>, { checkpoint = true } = {}): StepValidation {
    const session = this.currentSession
    if (!session) throw new Error('No active session')
    const step = session.exercise.steps.find((s) => s.id === stepId)
    if (!step) throw new Error(`Unknown step ${stepId}`)
    const response = session.steps.find((r) => r.stepId === stepId)!

    if (isEmptyAnswer(answer)) {
      const validation = { isCorrect: false, feedbackNl: 'Vul eerst je antwoord in.', misconceptionId: null, invalidFormat: true }
      this.recorder?.submit(stepId, answer, validation, session.hintLevel, true)
      if (checkpoint) this.persist()
      return validation
    }

    const validation = step.validate(answer)
    this.recorder?.submit(stepId, answer, validation, session.hintLevel, false)
    if (validation.invalidFormat) {
      // Unparseable notation: no attempt is recorded, no evidence is created.
      if (checkpoint) this.persist()
      return validation
    }

    if (response.firstAnswer === null) response.firstAnswer = answer
    response.attemptCount += 1
    if (response.attemptCount === 1) {
      response.outcome = validation.isCorrect ? 'correct' : 'incorrect'
      response.firstSubmittedAt = new Date(this.clock.now()).toISOString()
    }
    session.attempts += 1
    if (checkpoint) this.persist()
    return validation
  }

  /**
   * Check a whole test-format block at once ("Klaar, nakijken"). Unreadable
   * notation records nothing: the child fixes it and checks again. Blank
   * answers first come back as `blank` (nothing recorded); once she chooses
   * to check anyway (`confirmBlank`), they count as wrong, as on a test.
   */
  submitBlock(answers: Record<string, ExerciseAnswer>, { confirmBlank = false }: { confirmBlank?: boolean } = {}): BlockCheck {
    const session = this.currentSession
    if (!session) throw new Error('No active session')
    if (session.phase === 'feedback') return { invalid: [], blank: [], results: {} }
    const results: Record<string, StepValidation> = {}
    const invalid: string[] = []
    const blank: string[] = []
    for (const step of session.exercise.steps) {
      const answer = answers[step.id] ?? ''
      if (isEmptyAnswer(answer)) {
        blank.push(step.id)
        results[step.id] = { isCorrect: false, feedbackNl: 'Niet ingevuld.', misconceptionId: null }
        continue
      }
      const validation = step.validate(answer)
      if (validation.invalidFormat) invalid.push(step.id)
      results[step.id] = validation
    }
    const blocked = invalid.length > 0 || (blank.length > 0 && !confirmBlank)
    this.recorder?.activity()
    this.recorder?.event('check_block', { result: blocked ? 'blocked' : 'accepted' }, true)
    for (const step of session.exercise.steps) {
      const answer = answers[step.id] ?? ''
      this.recorder?.submit(step.id, answer, results[step.id]!, session.hintLevel, isEmptyAnswer(answer), !blocked, false)
    }
    if (blocked) {
      this.persist()
      return { invalid, blank, results }
    }
    for (const step of session.exercise.steps) {
      const response = session.steps.find((r) => r.stepId === step.id)!
      if (response.attemptCount > 0) continue
      response.firstAnswer = answers[step.id] ?? ''
      response.attemptCount = 1
      response.firstSubmittedAt = new Date(this.clock.now()).toISOString()
      response.outcome = results[step.id]!.isCorrect ? 'correct' : 'incorrect'
      session.attempts += 1
    }
    session.phase = 'feedback'
    session.work.answers = session.exercise.steps.map((st) => answers[st.id] ?? '')
    session.work.solved = session.exercise.steps.map(() => true)
    this.persist()
    return { invalid, blank, results }
  }

  /** Learner-requested help: expand one layer at a time (§2.5).
   *  Levels 1–3 use the exercise's archetype-specific hint ladder (padded
   *  with generic hints); level 4 reveals the solution and voids evidence. */
  requestHint({ checkpoint = true } = {}): string {
    const session = this.currentSession
    if (!session) throw new Error('No active session')
    if (session.exercise.format === 'block') {
      // A test has no hints: help comes afterwards, with the explanation.
      return 'Bij een toets is er geen hulp. Doe je best; daarna zie je de uitleg.'
    }
    const generic = [
      'Kijk goed naar de vraag. Wat wordt er gevraagd?',
      'Welke maat, sprong of plek hoort bij dit onderdeel?',
      'Bekijk het plaatje: wat blijft hetzelfde?',
    ]
    const specific = session.exercise.hintsNl ?? []
    const ladder = [...specific, ...generic].slice(0, 3)
    while (ladder.length < 3) ladder.push(generic[ladder.length]!)

    if (session.hintLevel >= 4) return 'Hier zie je het antwoord.'
    // Pause between hints: a quick second press shows the same hint again.
    if (session.hintLevel > 0 && this.hintWaitMs() > 0) return ladder[session.hintLevel - 1]!
    session.hintLevel = Math.min(4, session.hintLevel + 1)
    session.lastHintAt = new Date(this.clock.now()).toISOString()
    this.recorder?.hint(session.hintLevel, session.exercise.steps[session.work.stepIndex]!.id)
    if (session.hintLevel >= 4) {
      session.revealedAt = session.lastHintAt
      session.evidenceWeight = EVIDENCE_WEIGHTS.revealed
      if (checkpoint) this.persist()
      return 'Hier zie je het antwoord.'
    }
    if (session.hintLevel >= 1) {
      session.evidenceWeight = Math.min(session.evidenceWeight, EVIDENCE_WEIGHTS.scaffoldedPrediction)
    }
    if (checkpoint) this.persist()
    return ladder[session.hintLevel - 1]!
  }

  /** Milliseconds until the next hint can be shown (0 = now). */
  hintWaitMs(): number {
    const last = this.currentSession?.lastHintAt
    if (!last) return 0
    return Math.max(0, Date.parse(last) + HINT_PAUSE_MS - this.clock.now())
  }

  /**
   * Complete the exercise: commit one observation per skill (primary
   * aggregate + separately attributable supporting steps), update mastery,
   * scaffolding, fingerprints; persist.
   */
  completeExercise(): void {
    const session = this.currentSession
    if (!session) return
    const ex = session.exercise
    const now = new Date(this.clock.now())
    this.recorder?.flush()

    // --- Primary skill: one decisive aggregate observation (§2.2) ---
    // A test-format block passes like a test group: 80% of all its lines
    // right (estimates included), never "everything or nothing".
    const isBlock = ex.format === 'block'
    // A sub-step on the item's own skill is part of the primary evidence,
    // whatever its role: one item, one observation per skill (§2.2).
    const countsAsPrimary = (stepId: string) => {
      const target = ex.steps.find((s) => s.id === stepId)?.skillTarget
      return !!target && (target.role === 'primary' || target.skillId === ex.primarySkillId)
    }
    const primaryFirstOutcomes = session.steps
      .filter((r) => isBlock || countsAsPrimary(r.stepId))
      .map((r) => r.outcome)
    const blockCorrect = session.steps.filter((r) => r.outcome === 'correct').length
    const primaryCorrect = isBlock
      ? blockPassed(blockCorrect, session.steps.length)
      : primaryFirstOutcomes.length > 0 && primaryFirstOutcomes.every((o) => o === 'correct')

    const revealed = session.hintLevel >= 4
    const eligibility = {
      independent: !revealed && (session.currentScaffold === 'S2' || session.currentScaffold === 'S3') && session.hintLevel === 0,
      firstCommittedResponse: true,
      attributable: true,
      answerRevealed: revealed,
      weight: revealed ? EVIDENCE_WEIGHTS.revealed : session.evidenceWeight,
    }

    const primaryState = this.skillState(ex.primarySkillId)
    const wasDue = ex.purpose === 'review'
    const wasUnexposed = primaryState.exposureCount === 0
    const primaryAnswered = primaryFirstOutcomes.some((o) => o !== 'unknown')
    // Finishing a saved problem tomorrow must not turn yesterday's retrieval
    // into a new delayed-review success. Use the earliest primary response.
    const responseDates = session.steps.filter((r) => (isBlock || countsAsPrimary(r.stepId)) && r.firstSubmittedAt)
      .map((r) => Date.parse(r.firstSubmittedAt!)).filter(Number.isFinite)
    const primaryResponseAt = responseDates.length ? new Date(Math.min(...responseDates)) : now

    // Unanswered items are unassessed, not incorrect (§4.5): commit evidence
    // only when at least one primary step has a committed response.
    let applied: ReturnType<typeof applyObservationToSkill> | null = null
    if (primaryAnswered) {
      applied = applyObservationToSkill(primaryState, {
        skillId: ex.primarySkillId,
        exerciseId: ex.id,
        visitId: session.visitId,
        outcome: primaryCorrect ? 'correct' : 'incorrect',
        eligibility,
        scaffold: session.currentScaffold,
        representation: ex.representation,
        difficultyBand: ex.difficultyBand,
        variationTags: ex.variationTags,
        isInverse: ex.variationTags.includes('inverse-verification'),
        // A practice test mixes skills like the real test: that is transfer.
        isTransfer: ex.purpose === 'transfer' || ex.representation === 'story' || this.practiceMode === 'proeftoets',
        efficientStrategyObserved: primaryCorrect && session.attempts <= session.exercise.steps.length,
        activeTimeMs: Math.round(this.recorder?.trace.activeMs ?? 0),
        now: primaryResponseAt,
        // Meaningful instruction (S0/S1 episode with active learner actions) may
        // trigger a learning transition; S2/S3 independent work relies on p(T)=0
        // through eligibility alone.
        withLearningTransition: (session.currentScaffold === 'S0' || session.currentScaffold === 'S1') && !revealed,
        wasDueReview: wasDue,
      })
      this.snapshot.skills[ex.primarySkillId] = applied.state
      this.snapshot.observations.push(applied.observation)
      if (applied.transition) this.snapshot.learningTransitions.push(applied.transition)
      if (this.snapshot.observations.length > 200) {
        this.snapshot.observations = this.snapshot.observations.slice(-200)
      }
    }

    // --- Supporting skills: one attributable sub-step each (0.6 weight) ---
    for (const r of session.steps) {
      const step = ex.steps.find((s) => s.id === r.stepId)
      if (!step || isBlock || countsAsPrimary(step.id) || r.outcome === 'unknown') continue
      const supportingState = this.skillState(step.skillTarget.skillId)
      // A step answered before the reveal is her own work; one answered after
      // it was made with the answer in view (unknown timing: assume after).
      const afterReveal = revealed && (!session.revealedAt || !r.firstSubmittedAt || r.firstSubmittedAt >= session.revealedAt)
      const sub = applyObservationToSkill(supportingState, {
        skillId: step.skillTarget.skillId,
        exerciseId: ex.id,
        visitId: session.visitId,
        outcome: r.outcome,
        eligibility: {
          independent: false,
          firstCommittedResponse: true,
          attributable: true,
          answerRevealed: afterReveal,
          weight: afterReveal ? EVIDENCE_WEIGHTS.revealed : EVIDENCE_WEIGHTS.attributableSubStep,
        },
        scaffold: session.currentScaffold,
        representation: ex.representation,
        difficultyBand: ex.difficultyBand,
        variationTags: ex.variationTags,
        isInverse: false,
        isTransfer: false,
        efficientStrategyObserved: r.outcome === 'correct',
        activeTimeMs: Math.round(this.recorder?.trace.steps.find((s) => s.stepId === r.stepId)?.activeMs ?? 0),
        now: r.firstSubmittedAt ? new Date(r.firstSubmittedAt) : now,
        withLearningTransition: false,
        wasDueReview: false,
      })
      this.snapshot.skills[step.skillTarget.skillId] = sub.state
      this.snapshot.observations.push(sub.observation)
    }

    // Every answered step right the first time, and nothing revealed.
    const answeredSteps = session.steps.filter((r) => r.outcome !== 'unknown')
    const allFirstCorrect = !revealed && answeredSteps.length > 0 && answeredSteps.every((r) => r.outcome === 'correct')
    const trace = this.recorder?.trace
    const fluent = !isBlock && (session.currentScaffold === 'S0' || session.currentScaffold === 'S1')
      && primaryCorrect && allFirstCorrect && session.hintLevel === 0
      && answeredSteps.length === ex.steps.length
      && !!trace && trace.timingReliable && trace.activeMs <= FLUENT_MS_PER_STEP * ex.steps.length

    // --- Mastery promotion & lapse confirmation (only for assessed items) ---
    const node = getSkill(ex.primarySkillId)
    if (applied) {
      const { newLevel } = evaluatePromotion(applied.state, node.criticalVariationTags, now)
      if (newLevel > applied.state.currentVerifiedLevel) {
        applied.state.currentVerifiedLevel = newLevel as LearnerSkillState['currentVerifiedLevel']
        applied.state.highestDemonstratedLevel = Math.max(
          applied.state.highestDemonstratedLevel,
          newLevel,
        ) as LearnerSkillState['highestDemonstratedLevel']
      }
      // Two independent failures among the latest three comparable checks
      // may lower the verified level; the historical high is never touched.
      if (confirmedLapse(applied.state) && applied.state.currentVerifiedLevel > 0) {
        applied.state.currentVerifiedLevel = (applied.state.currentVerifiedLevel - 1) as LearnerSkillState['currentVerifiedLevel']
      }

      // --- Scaffolding fading / re-support for the next fresh item ---
      const sc = applied.state.scaffolding
      if (isBlock && !primaryCorrect) {
        // A failed test block goes back to practising on her own (Zelf).
        sc.currentTier = 'S2'
        sc.qualifyingSuccessStreak = 0
      } else if (isBlock && primaryCorrect) {
        // Maatwerk is done once the skill passes in test format again.
        this.snapshot.focusSkills = (this.snapshot.focusSkills ?? []).filter((id) => id !== ex.primarySkillId)
      } else if (fluent) {
        // She clearly knows it already: skip the rest of the guided path.
        sc.currentTier = 'S2'
        sc.qualifyingSuccessStreak = 0
      } else if (primaryCorrect && eligibility.weight > 0) {
        const fade = decideFade(applied.state)
        if (fade.fade) {
          sc.currentTier = fade.nextTier
          // The new tier must earn its own streak; the distinct item ids stay
          // as Level 1 evidence.
          sc.qualifyingSuccessStreak = 0
        }
      } else if (!primaryCorrect) {
        sc.currentTier = decideReSupport(applied.state)
      }
    }

    // --- Recent-pattern exclusion (last 20 fingerprints) ---
    this.snapshot.recentExerciseFingerprints = [
      ...this.snapshot.recentExerciseFingerprints.slice(-19),
      ex.fingerprint,
    ]

    // --- Session history & totals ---
    this.sessionResults.push({
      skillTitleNl: node.titleNl,
      correct: primaryCorrect,
      skipped: false,
      firstTimeSuccess: wasUnexposed && primaryCorrect,
    })
    if (this.practiceMode === 'proeftoets' && this.proeftoets) {
      const group = this.proeftoets.groups[this.sessionItemsDone]
      this.proeftoetsResults.push({
        skillId: ex.primarySkillId,
        correct: blockCorrect,
        total: session.steps.length,
        passed: primaryCorrect,
        maatwerkNl: group?.maatwerkNl,
      })
      // Per group, so a test she stops halfway still yields its maatwerk.
      this.applyMaatwerk(this.proeftoetsResults[this.proeftoetsResults.length - 1]!)
    }
    this.snapshot.totalExercisesCompleted += 1

    const usageId = this.recorder?.trace.id ?? session.id
    this.finishUsage('completed', primaryAnswered ? (isBlock ? primaryCorrect : primaryCorrect && allFirstCorrect) : null)
    this.sessionItemsDone += 1
    this.currentSession = null
    if (this.sessionItemsDone >= this.sessionTargetItems) finishPractice(this.usage, 'completed', this.clock.now())
    // A reveal is followed by one sibling item, but a revealed sibling is not,
    // so help can never trap her in a loop of the same skill.
    if (revealed && applied && !session.isSibling) {
      this.pendingSibling = { skillId: ex.primarySkillId, tier: session.currentScaffold, usageId }
    }

    // Freshness is derived state (docs §5.3.2): recompute after committing
    // evidence so the dashboard reflects this visit's practice immediately
    // instead of showing stale page-load labels.
    this.recomputeFreshness(now)

    // Learning evidence, usage finalization and unfinished work share one
    // checksummed checkpoint. Reloading cannot apply either of them twice.
    this.persist()
    this.notify()
  }

  /**
   * A practice-test group that did not pass becomes maatwerk. More than
   * half wrong → back to the bridge (S1: model and written layout side by
   * side); otherwise practise on her own (S2). Focus skills are favoured in
   * every session until they pass a test block again.
   */
  private applyMaatwerk(result: ProeftoetsGroupResult): void {
    if (result.passed) return
    const state = this.skillState(result.skillId)
    state.scaffolding.currentTier = result.correct / result.total < 0.5 ? 'S1' : 'S2'
    state.scaffolding.qualifyingSuccessStreak = 0
    this.snapshot.skills[result.skillId] = state
    this.snapshot.focusSkills = [...new Set([...(this.snapshot.focusSkills ?? []), result.skillId])]
  }

  /** A practice test that was stopped before its last group: "Ga verder"
   *  continues with the next group (nextExercise). */
  get proeftoetsPaused(): boolean {
    return this.currentSession === null && this.practiceMode === 'proeftoets' && this.proeftoets !== null
      && this.sessionItemsDone < this.proeftoets.groups.length
  }

  get practicePaused(): boolean {
    return this.currentSession === null && this.usage.currentPractice !== null
      && this.sessionItemsDone < this.sessionTargetItems
  }

  /** Stop without penalty: unfinished work is preserved, no negative update.
   *  `reason` is her one-tap answer to "Waarom sla je deze over?". */
  deferExercise(reason: SkipReason | null = null): void {
    if (!this.currentSession) return
    if (this.recorder) this.recorder.trace.skipReason = reason
    const ex = this.currentSession.exercise
    // Remember the fingerprint so a skip does not immediately re-serve the
    // same generated item.
    this.snapshot.recentExerciseFingerprints = [
      ...this.snapshot.recentExerciseFingerprints.slice(-19),
      ex.fingerprint,
    ]
    this.sessionResults.push({
      skillTitleNl: getSkill(ex.primarySkillId).titleNl,
      correct: false,
      skipped: true,
      firstTimeSuccess: false,
    })
    this.sessionItemsDone += 1
    this.finishUsage('skipped')
    this.currentSession = null
    if (this.sessionItemsDone >= this.sessionTargetItems) finishPractice(this.usage, 'completed', this.clock.now())
    this.persist()
    this.notify()
  }

  /** Stop without a learning penalty. A checked test page is committed first;
   *  a paused practice test continues at its next unchecked group. */
  endSession(): void {
    if (!this.currentSession) return
    if (this.currentSession.exercise.format === 'block' && this.currentSession.phase === 'feedback') {
      this.completeExercise()
      if (this.usage.currentPractice) this.usage.currentPractice.status = 'paused'
      if (this.sessionItemsDone >= this.sessionTargetItems) finishPractice(this.usage, 'completed', this.clock.now())
      else if (this.practiceMode !== 'proeftoets') finishPractice(this.usage, 'stopped', this.clock.now())
      this.persist()
      return
    }
    this.finishUsage('stopped')
    this.currentSession = null
    if (this.practiceMode === 'proeftoets' && this.usage.currentPractice) this.usage.currentPractice.status = 'paused'
    else finishPractice(this.usage, 'stopped', this.clock.now())
    this.persist()
    this.notify()
  }
}

function exerciseSignature(exercise: GeneratedExercise): string {
  return checksumOf(canonicalStringify(exercise))
}

function isQuotaError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || /quota/i.test(error.message))
}

/** A blank answer (empty string, or a digit/QR map with no filled cells). */
function isEmptyAnswer(answer: string | number | Record<string, string | number>): boolean {
  if (typeof answer === 'number') return false
  if (typeof answer === 'string') return answer.trim() === ''
  return Object.values(answer).every((v) => String(v ?? '').trim() === '')
}

function defaultDriver(): StorageDriver {
  // Memory storage is for SSR/tests. In a browser, blocked localStorage must
  // produce a visible failure instead of falsely claiming durable progress.
  return typeof window === 'undefined' ? new MemoryDriver() : new LocalStorageDriver()
}
