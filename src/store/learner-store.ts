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
  type StorageDriver,
} from '../storage/persistence'

import { DEFAULT_TABLES, TABLES } from '../generators/multiplication-facts'

export type PracticeMode = 'curriculum' | 'tables' | 'lesson' | 'proeftoets'
export const SESSION_TARGET_ITEMS = 8
/** Her class is in blok 2 (October 2026); a parent can change it in Instellingen. */
export const DEFAULT_BLOK_ID = 'blok-2'

/** One group of a finished or running proeftoets. */
export interface ProeftoetsGroupResult {
  skillId: SkillId
  correct: number
  total: number
  passed: boolean
  maatwerkNl?: string
}

/** The result of checking a whole test-format block at once. */
export interface BlockCheck {
  /** Steps whose answer could not be read (fix the notation, nothing recorded). */
  invalid: string[]
  results: Record<string, StepValidation>
}

/** One row of per-item session history for the end-of-session summary. */
export interface SessionResult {
  skillTitleNl: string
  /** Solved correctly on first attempts (primary skill). */
  correct: boolean
  skipped: boolean
  /** First-ever exposure of this skill, solved correctly. */
  firstTimeSuccess: boolean
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
  private pendingSibling: { skillId: SkillId; tier: ScaffoldTier } | null = null
  /** Lesson practice: the lesson whose skills this session draws from. */
  lessonId: string | null = null
  /** Practice test in progress (or just finished, for the summary). */
  proeftoets: Proeftoets | null = null
  proeftoetsResults: ProeftoetsGroupResult[] = []
  lastSelectionExplanation = ''
  /** True when the last checkpoint save failed (visible recovery path). */
  saveFailed = false

  constructor(
    profileId: string,
    driver: StorageDriver = defaultDriver(),
  ) {
    this.profileId = profileId
    this.profileStore = new ProfileStore<LearnerSnapshot>(profileId, driver)
    this.snapshot = this.restoreOrInit()
    this.normalizeSnapshot()
    // Freshness is derived state (docs §2.3): recompute on load so due
    // reviews are visible without new practice.
    this.recomputeFreshness(new Date())
  }

  snapshot: LearnerSnapshot

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
      if (record && record.data.schemaVersion === SCHEMA_VERSION) return record.data
    } catch {
      // Corrupt storage: start fresh rather than fail hard.
    }
    return freshSnapshot(this.profileId)
  }

  /** Checkpoint save of the current snapshot (also used by tests and unload). */
  persist(): void {
    this.snapshot.revision += 1
    this.snapshot.savedAt = new Date().toISOString()
    this.saveFailed = false
    try {
      this.profileStore.save(
        { revision: this.snapshot.revision, savedAt: this.snapshot.savedAt, data: this.snapshot },
        (data) => canonicalStringify(data),
      )
    } catch {
      // Visible recovery path: the UI shows a save-failure banner (§4.1).
      this.saveFailed = true
    }
    this.notify()
  }

  /** Fill in fields added after a snapshot was first persisted. */
  private normalizeSnapshot(): void {
    this.snapshot.totalExercisesCompleted ??= 0
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
    return JSON.stringify({ ...this.snapshot, checksum: undefined }, null, 2)
  }

  importJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as LearnerSnapshot
      if (parsed.schemaVersion !== SCHEMA_VERSION) return false
      if (!parsed.skills || typeof parsed.revision !== 'number') return false
      // Tampered exports must never silently overwrite progress: verify the
      // embedded checksum when present (exports strip it).
      if (parsed.checksum && parsed.checksum !== checksumOf(canonicalStringify(parsed))) return false
      this.snapshot = { ...parsed, profileId: this.profileId }
      this.normalizeSnapshot()
      this.recomputeFreshness(new Date())
      this.persist()
      return true
    } catch {
      return false
    }
  }

  // ---- Reading state ----

  skillState(skillId: SkillId): LearnerSkillState {
    return this.snapshot.skills[skillId] ?? newSkillState(skillId)
  }

  /** Update learner preferences (nickname, motion, theme) and persist. */
  savePreferences(prefs: Partial<LearnerSnapshot['preferences']>): void {
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
    const validTables = [...new Set(tables)].filter((n) => TABLES.includes(n))
    if (mode === 'tables' && validTables.length === 0) return null
    if (mode === 'lesson' && !lessonById(options.lessonId ?? '')) return null
    if (mode === 'proeftoets' && !proeftoetsById(options.proeftoetsId ?? '')) return null
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
    return this.nextExercise()
  }

  /** Select and present the next exercise, or null when the session is done. */
  nextExercise(): ExerciseSessionState | null {
    if (this.sessionItemsDone >= this.sessionTargetItems) {
      this.currentSession = null
      this.notify()
      return null
    }
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
        now: new Date(),
        // Skill-directed practice ("vrij oefenen") is a future feature;
        // chosenTheme is a ThemeId, not a SkillId, and must not leak in here.
        intentSkill: null,
        focusSkills: this.snapshot.focusSkills ?? [],
      },
      () => this.sessionRng.next(),
    )
    if (!selection) {
      this.currentSession = null
      this.notify()
      return null
    }
    this.lastSelectionExplanation = selection.explanationNl

    const state = this.skillState(selection.skillId)
    // Merge the fade-managed tier with the competence-based start tier:
    // chooseStartTier may jump ahead for strong prior competence, but never
    // reduces support below the fade ladder's current tier.
    const startTier = chooseStartTier(state)
    const managedTier = state.scaffolding.currentTier
    const tier: ScaffoldTier = sibling
      ? sibling.tier
      : state.exposureCount === 0
        ? 'S0'
        : tierIndex(startTier) > tierIndex(managedTier)
          ? startTier
          : managedTier
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
      this.currentSession = null
      this.notify()
      return null
    }
    return this.present(exercise, tier, sibling !== null)
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

  private present(exercise: GeneratedExercise, tier: ScaffoldTier, sibling: boolean): ExerciseSessionState {
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
      startedAt: new Date().toISOString(),
      evidenceWeight:
        tier === 'S0' || tier === 'S1'
          ? EVIDENCE_WEIGHTS.scaffoldedPrediction
          : EVIDENCE_WEIGHTS.independent,
      lastSavedAt: null,
      isSibling: sibling,
    }
    this.sessionItemPurposes.push(exercise.purpose)
    this.sessionRecentSkills = [...this.sessionRecentSkills, exercise.primarySkillId].slice(-3)
    this.notify()
    return this.currentSession
  }

  /** Update presentation state without committing or changing learning evidence. */
  setExerciseWork<K extends keyof ExerciseWorkState>(key: K, value: ExerciseWorkState[K]): void {
    if (!this.currentSession) return
    this.currentSession.work[key] = value
    this.notify()
  }

  /** Validate a learner answer for the given step (no evidence yet).
   *  Blank or unparseable input stays in `working` and never becomes
   *  wrong-math evidence (docs §4.1: "invalid formatting remains in working"). */
  submitStepAnswer(stepId: string, answer: string | number | Record<string, string | number>): StepValidation {
    const session = this.currentSession
    if (!session) throw new Error('No active session')
    const step = session.exercise.steps.find((s) => s.id === stepId)
    if (!step) throw new Error(`Unknown step ${stepId}`)
    const response = session.steps.find((r) => r.stepId === stepId)!

    if (isEmptyAnswer(answer)) {
      this.notify()
      return { isCorrect: false, feedbackNl: 'Vul eerst je antwoord in.', misconceptionId: null, invalidFormat: true }
    }

    const validation = step.validate(answer)
    if (validation.invalidFormat) {
      // Unparseable notation: no attempt is recorded, no evidence is created.
      this.notify()
      return validation
    }

    if (response.firstAnswer === null) response.firstAnswer = answer
    response.attemptCount += 1
    if (response.attemptCount === 1) {
      response.outcome = validation.isCorrect ? 'correct' : 'incorrect'
    }
    session.attempts += 1
    this.notify()
    return validation
  }

  /**
   * Check a whole test-format block at once ("Klaar, nakijken"). Blank
   * answers count as wrong, as on a test. Unreadable notation records
   * nothing: the child fixes it and checks again.
   */
  submitBlock(answers: Record<string, ExerciseAnswer>): BlockCheck {
    const session = this.currentSession
    if (!session) throw new Error('No active session')
    const results: Record<string, StepValidation> = {}
    const invalid: string[] = []
    for (const step of session.exercise.steps) {
      const answer = answers[step.id] ?? ''
      if (isEmptyAnswer(answer)) {
        results[step.id] = { isCorrect: false, feedbackNl: 'Niet ingevuld.', misconceptionId: null }
        continue
      }
      const validation = step.validate(answer)
      if (validation.invalidFormat) invalid.push(step.id)
      results[step.id] = validation
    }
    if (invalid.length > 0) {
      this.notify()
      return { invalid, results }
    }
    for (const step of session.exercise.steps) {
      const response = session.steps.find((r) => r.stepId === step.id)!
      if (response.attemptCount > 0) continue
      response.firstAnswer = answers[step.id] ?? ''
      response.attemptCount = 1
      response.outcome = results[step.id]!.isCorrect ? 'correct' : 'incorrect'
      session.attempts += 1
    }
    session.phase = 'feedback'
    session.work.answers = session.exercise.steps.map((st) => answers[st.id] ?? '')
    session.work.solved = session.exercise.steps.map(() => true)
    this.notify()
    return { invalid, results }
  }

  /** Learner-requested help: expand one layer at a time (§2.5).
   *  Levels 1–3 use the exercise's archetype-specific hint ladder (padded
   *  with generic hints); level 4 reveals the solution and voids evidence. */
  requestHint(): string {
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

    session.hintLevel = Math.min(4, session.hintLevel + 1)
    if (session.hintLevel >= 4) {
      session.evidenceWeight = EVIDENCE_WEIGHTS.revealed
      this.notify()
      return 'Hier zie je het antwoord.'
    }
    if (session.hintLevel >= 1) {
      session.evidenceWeight = Math.min(session.evidenceWeight, EVIDENCE_WEIGHTS.scaffoldedPrediction)
    }
    this.notify()
    return ladder[session.hintLevel - 1]!
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
    const now = new Date()

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

    // Unanswered items are unassessed, not incorrect (§4.5): commit evidence
    // only when at least one primary step has a committed response.
    let applied: ReturnType<typeof applyObservationToSkill> | null = null
    if (primaryAnswered) {
      applied = applyObservationToSkill(primaryState, {
        skillId: ex.primarySkillId,
        exerciseId: ex.id,
        visitId: this.visitId,
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
        activeTimeMs: 60_000,
        now,
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
      const sub = applyObservationToSkill(supportingState, {
        skillId: step.skillTarget.skillId,
        exerciseId: ex.id,
        visitId: this.visitId,
        outcome: r.outcome,
        eligibility: {
          independent: false,
          firstCommittedResponse: true,
          attributable: true,
          answerRevealed: revealed,
          weight: EVIDENCE_WEIGHTS.attributableSubStep,
        },
        scaffold: session.currentScaffold,
        representation: ex.representation,
        difficultyBand: ex.difficultyBand,
        variationTags: ex.variationTags,
        isInverse: false,
        isTransfer: false,
        efficientStrategyObserved: r.outcome === 'correct',
        activeTimeMs: 30_000,
        now,
        withLearningTransition: false,
        wasDueReview: false,
      })
      this.snapshot.skills[step.skillTarget.skillId] = sub.state
      this.snapshot.observations.push(sub.observation)
    }

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
      if (this.proeftoetsResults.length === this.proeftoets.groups.length) this.applyMaatwerk()
    }
    this.snapshot.totalExercisesCompleted += 1

    this.sessionItemsDone += 1
    this.currentSession = null
    // A reveal is followed by one sibling item, but a revealed sibling is not,
    // so help can never trap her in a loop of the same skill.
    if (revealed && applied && !session.isSibling) {
      this.pendingSibling = { skillId: ex.primarySkillId, tier: session.currentScaffold }
    }

    // Freshness is derived state (docs §5.3.2): recompute after committing
    // evidence so the dashboard reflects this visit's practice immediately
    // instead of showing stale page-load labels.
    this.recomputeFreshness(now)

    // Checkpoint commit: journal the evidence, save, then compact.
    if (applied) this.profileStore.appendJournal(applied.observation)
    this.persist()
    this.profileStore.clearJournal()
    this.notify()
  }

  /**
   * After a practice test: every group that did not pass becomes maatwerk.
   * More than half wrong → back to the bridge (S1: model and written
   * layout side by side); otherwise practise on her own (S2). Focus skills
   * are favoured in every session until they pass a test block again.
   */
  private applyMaatwerk(): void {
    const failed = this.proeftoetsResults.filter((r) => !r.passed)
    for (const r of failed) {
      const state = this.skillState(r.skillId)
      state.scaffolding.currentTier = r.correct / r.total < 0.5 ? 'S1' : 'S2'
      state.scaffolding.qualifyingSuccessStreak = 0
      this.snapshot.skills[r.skillId] = state
    }
    this.snapshot.focusSkills = [...new Set([...(this.snapshot.focusSkills ?? []), ...failed.map((r) => r.skillId)])]
  }

  /** Stop without penalty: unfinished work is preserved, no negative update. */
  deferExercise(): void {
    if (!this.currentSession) return
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
    this.currentSession = null
    this.persist()
    this.notify()
  }

  /** Pause/stop the session: the open item is preserved (no penalty, no
   *  item consumed); "Ga verder" resumes it via nextExercise. */
  endSession(): void {
    if (!this.currentSession) return
    this.currentSession = null
    this.persist()
    this.notify()
  }
}

/** A blank answer (empty string, or a digit/QR map with no filled cells). */
function isEmptyAnswer(answer: string | number | Record<string, string | number>): boolean {
  if (typeof answer === 'number') return false
  if (typeof answer === 'string') return answer.trim() === ''
  return Object.values(answer).every((v) => String(v ?? '').trim() === '')
}

function defaultDriver(): StorageDriver {
  try {
    if (typeof localStorage !== 'undefined') return new LocalStorageDriver()
  } catch {
    // Accessing localStorage can throw (privacy mode).
  }
  return new MemoryDriver()
}
