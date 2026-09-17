/**
 * LearnerStore: the runtime tying graph, evidence engine, selector,
 * generators and persistence together. Owns the active practice session and
 * implements the core learning loop state machine (docs §4.1) in a pragmatic
 * form: presenting → working → (submitting/diagnosing) → feedback →
 * retrying → completing (evidence commit) → next.
 */
import { KNOWLEDGE_GRAPH, getSkill } from '../domain/knowledge-graph'
import type {
  ExerciseSessionState,
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
import { generateExercise, SUPPORTED_SKILLS } from '../generators'
import {
  canonicalStringify,
  checksumOf,
  LocalStorageDriver,
  MemoryDriver,
  ProfileStore,
  type StorageDriver,
} from '../storage/persistence'

export const SESSION_TARGET_ITEMS = 8

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
  sessionItemPurposes: string[] = []
  sessionItemsDone = 0
  sessionResults: SessionResult[] = []
  /** Primary skills of the last few served items (selector anti-repetition). */
  sessionRecentSkills: SkillId[] = []
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
    for (const state of Object.values(this.snapshot.skills)) {
      state.memory.delayedSuccessGapsDays ??= []
    }
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

  startSession(): ExerciseSessionState | null {
    this.sessionItemPurposes = []
    this.sessionItemsDone = 0
    this.sessionResults = []
    this.sessionRecentSkills = []
    return this.nextExercise()
  }

  /** Select and present the next exercise, or null when the session is done. */
  nextExercise(): ExerciseSessionState | null {
    if (this.sessionItemsDone >= SESSION_TARGET_ITEMS) {
      this.currentSession = null
      this.notify()
      return null
    }
    const selection = selectNextSkill(
      {
        skills: { supported: SUPPORTED_SKILLS, states: this.snapshot.skills },
        recentPurposes: this.sessionItemPurposes as never[],
        recentSkillIds: this.sessionRecentSkills,
        now: new Date(),
        // Skill-directed practice ("vrij oefenen") is a future feature;
        // chosenTheme is a ThemeId, not a SkillId, and must not leak in here.
        intentSkill: null,
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
    const tier: ScaffoldTier =
      state.exposureCount === 0
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
        const candidate = generateExercise({
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

    this.currentSession = {
      id: `sess-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      visitId: this.visitId,
      exercise,
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
    }
    this.sessionItemPurposes.push(exercise.purpose)
    this.sessionRecentSkills = [...this.sessionRecentSkills, exercise.primarySkillId].slice(-3)
    this.notify()
    return this.currentSession
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

  /** Learner-requested help: expand one layer at a time (§2.5).
   *  Levels 1–3 use the exercise's archetype-specific hint ladder (padded
   *  with generic hints); level 4 reveals the solution and voids evidence. */
  requestHint(): string {
    const session = this.currentSession
    if (!session) throw new Error('No active session')
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
      return 'Hier is de oplossing:'
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
    const primaryFirstOutcomes = session.steps
      .filter((r) => ex.steps.find((s) => s.id === r.stepId)?.skillTarget.role === 'primary')
      .map((r) => r.outcome)
    const primaryCorrect = primaryFirstOutcomes.length > 0 && primaryFirstOutcomes.every((o) => o === 'correct')

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
        isTransfer: ex.purpose === 'transfer' || ex.representation === 'story',
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
      if (!step || step.skillTarget.role !== 'supporting' || r.outcome === 'unknown') continue
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
      if (primaryCorrect && eligibility.weight > 0) {
        const fade = decideFade(applied.state)
        if (fade.fade) sc.currentTier = fade.nextTier
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
    this.snapshot.totalExercisesCompleted += 1

    this.sessionItemsDone += 1
    this.currentSession = null

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