import { describe, expect, it } from 'vitest'
import { MemoryDriver } from '../../storage/persistence'
import { LearnerStore, SESSION_TARGET_ITEMS } from '../learner-store'
import type { ExerciseSessionState, GeneratedExercise, GeneratedStep } from '../../domain/types'

/** Derive the correct answer for a step from the exercise itself. */
function solveAnswer(exercise: GeneratedExercise, step: GeneratedStep): string | number | Record<string, string | number> {
  switch (step.answerType.kind) {
    case 'digits': {
      const n = exercise.widget?.props.number as number
      const columns = (exercise.widget?.props.columns as string[]) ?? ['D', 'H', 'T', 'E']
      const padded = String(n).padStart(columns.length === 3 ? 3 : 4, '0')
      const out: Record<string, string> = {}
      columns.forEach((c, i) => {
        out[c] = padded[padded.length - columns.length + i]!
      })
      return out
    }
    case 'quotient-remainder': {
      const m = step.solutionNl.match(/= (\d+), rest (\d+)/)
      return { quotient: m![1]!, remainder: m![2]! }
    }
    case 'time':
      return step.solutionNl // "08:20" — parseTimeAnswer accepts this
    case 'money': {
      const m = step.solutionNl.match(/= €(\d+),(\d{2})$/)
      return `${m![1]},${m![2]}`
    }
    case 'integer': {
      const nums = step.solutionNl.match(/\d+/g)
      return Number(nums![nums!.length - 1])
    }
    default:
      return step.solutionNl
  }
}

function solveAll(store: LearnerStore, session: ExerciseSessionState): void {
  for (const step of session.exercise.steps) {
    const answer = solveAnswer(session.exercise, step)
    const validation = store.submitStepAnswer(step.id, answer)
    expect(validation.isCorrect).toBe(true)
  }
}

describe('LearnerStore end-to-end learning loop', () => {
  it('restores saved progress instead of resetting to novice defaults', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('noor', driver)
    store.snapshot.preferences.nickname = 'Noor'
    store.persist()

    const reloaded = new LearnerStore('noor', driver)
    expect(reloaded.snapshot.preferences.nickname).toBe('Noor')
    expect(reloaded.snapshot.revision).toBe(store.snapshot.revision)
  })

  it('runs a full session: select → answer → evidence → persistence', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('sam', driver)

    const session = store.startSession()
    expect(session).not.toBeNull()
    expect(session!.phase).toBe('working')
    const skillId = session!.exercise.primarySkillId

    solveAll(store, session!)

    const before = store.skillState(skillId)
    const opportunitiesBefore = before.exposureCount
    store.completeExercise()
    const after = store.skillState(skillId)
    expect(after.exposureCount).toBe(opportunitiesBefore + 1)
    expect(after.lastPracticedAt).not.toBeNull()
    expect(store.snapshot.observations.length).toBeGreaterThan(0)

    // Progress was persisted (journal cleared after checkpoint commit).
    const reloaded = new LearnerStore('sam', driver)
    expect(reloaded.skillState(skillId).exposureCount).toBe(after.exposureCount)
  })

  it('never generates a negative mastery update for skipping (deferred)', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('mila', driver)
    store.startSession()
    const skillId = store.currentSession!.exercise.primarySkillId
    const pBefore = store.skillState(skillId).masteryProbability
    store.deferExercise()
    const pAfter = store.skillState(skillId).masteryProbability
    expect(pAfter).toBe(pBefore)
    expect(store.currentSession).toBeNull()
  })

  it('serves up to the session target and then stops', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('piet', driver)
    let served = 0
    for (let i = 0; i < SESSION_TARGET_ITEMS + 3; i++) {
      const session = i === 0 ? store.startSession() : store.nextExercise()
      if (!session) break
      served += 1
      // Answer wrong on purpose — must still progress without blocking.
      for (const step of session.exercise.steps) {
        store.submitStepAnswer(step.id, -999)
      }
      store.completeExercise()
    }
    expect(served).toBe(SESSION_TARGET_ITEMS)
    expect(store.sessionItemsDone).toBe(SESSION_TARGET_ITEMS)
  })

  it('hint level ≥ 4 (reveal) removes evidence eligibility entirely', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('femke', driver)
    const session = store.startSession()!
    store.requestHint()
    store.requestHint()
    store.requestHint()
    store.requestHint()
    const skillId = session.exercise.primarySkillId
    const before = store.skillState(skillId)
    for (const step of session.exercise.steps) {
      store.submitStepAnswer(step.id, solveAnswer(session.exercise, step))
    }
    store.completeExercise()
    const after = store.skillState(skillId)
    // Revealed/copied answers never count as independent or scaffolded evidence.
    expect(after.independentOpportunityCount).toBe(before.independentOpportunityCount)
    expect(after.scaffoldedSuccessCount).toBe(before.scaffoldedSuccessCount)
  })

  it('export/import preserves achievements', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('export', driver)
    store.snapshot.skills['PV.DHTE.Decompose']!.highestDemonstratedLevel = 3
    store.persist()
    const json = store.exportJson()

    const other = new LearnerStore('import', new MemoryDriver())
    expect(other.importJson(json)).toBe(true)
    expect(other.skillState('PV.DHTE.Decompose').highestDemonstratedLevel).toBe(3)
  })

  it('review scheduling starts after the first qualifying INDEPENDENT success', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('review', driver)
    // Give every supported skill plausible prior competence (S2, p=.85).
    for (const id of Object.keys(store.snapshot.skills)) {
      const s = store.snapshot.skills[id]!
      s.scaffolding.currentTier = 'S2'
      s.masteryProbability = 0.85
      s.exposureCount = 5
      s.currentVerifiedLevel = 1
    }
    const session = store.startSession()!
    const skillId = session.exercise.primarySkillId
    expect(session.currentScaffold).toBe('S2')
    solveAll(store, session)
    store.completeExercise()
    expect(store.skillState(skillId).memory.reviewDueAt).not.toBeNull()
  })

  it('supported S0 work refreshes memory but does not start a review schedule', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('supported', driver)
    const session = store.startSession()!
    expect(session.currentScaffold).toBe('S0') // fresh profile
    const skillId = session.exercise.primarySkillId
    solveAll(store, session)
    store.completeExercise()
    const state = store.skillState(skillId)
    expect(state.memory.lastMemoryRefreshAt).not.toBeNull()
    expect(state.memory.reviewDueAt).toBeNull()
  })
})

describe('LearnerStore regression: adaptive engine health', () => {
  /** Play a number of sessions where every step is answered correctly. */
  function playAllCorrect(store: LearnerStore, sessions: number): Map<string, number> {
    const exposures = new Map<string, number>()
    for (let i = 0; i < sessions; i++) {
      let s = store.startSession()
      while (s) {
        exposures.set(s.exercise.primarySkillId, (exposures.get(s.exercise.primarySkillId) ?? 0) + 1)
        solveAll(store, s)
        store.completeExercise()
        s = store.nextExercise()
      }
    }
    return exposures
  }

  it('fades the support tier through scaffolded successes so independent evidence accrues', () => {
    const store = new LearnerStore('fade', new MemoryDriver())
    let reachedIndependent = false
    outer: for (let session = 0; session < 15 && !reachedIndependent; session++) {
      let s = store.startSession()
      while (s) {
        if (s.currentScaffold === 'S2' || s.currentScaffold === 'S3') {
          reachedIndependent = true
          break outer
        }
        solveAll(store, s)
        store.completeExercise()
        s = store.nextExercise()
      }
    }
    expect(reachedIndependent).toBe(true)
  })

  it('spreads practice across skills (no starvation, no monopoly)', () => {
    const store = new LearnerStore('spread', new MemoryDriver())
    const exposures = playAllCorrect(store, 12) // 96 items
    const max = Math.max(...exposures.values())
    expect(exposures.size).toBeGreaterThanOrEqual(15)
    expect(max / 96).toBeLessThan(0.35)
  })

  it('blank and unparseable input stays in working without becoming wrong-math evidence', () => {
    const store = new LearnerStore('format', new MemoryDriver())
    const session = store.startSession()!
    const step = session.exercise.steps[0]!
    const before = store.skillState(session.exercise.primarySkillId)

    const blank = store.submitStepAnswer(step.id, '')
    expect(blank.invalidFormat).toBe(true)
    const garbage = store.submitStepAnswer(step.id, 'helemaal geen getal')
    expect(garbage.invalidFormat).toBe(true)

    const response = session.steps.find((r) => r.stepId === step.id)!
    expect(response.attemptCount).toBe(0)
    expect(response.firstAnswer).toBeNull()
    expect(response.outcome).toBe('unknown')

    // An item with no committed responses is unassessed: no evidence.
    store.completeExercise()
    const after = store.skillState(session.exercise.primarySkillId)
    expect(after.exposureCount).toBe(before.exposureCount)
    expect(after.meaningfulOpportunityCount).toBe(before.meaningfulOpportunityCount)
  })

  it('deferring remembers the fingerprint so a skipped item is not immediately re-served', () => {
    const store = new LearnerStore('defer-fp', new MemoryDriver())
    const session = store.startSession()!
    const fp = session.exercise.fingerprint
    store.deferExercise()
    expect(store.snapshot.recentExerciseFingerprints).toContain(fp)
    const next = store.nextExercise()
    if (next) expect(next.exercise.fingerprint).not.toBe(fp)
  })

  it('counts completed exercises (defers excluded) for the home stat', () => {
    const store = new LearnerStore('counter', new MemoryDriver())
    expect(store.snapshot.totalExercisesCompleted).toBe(0)
    const session = store.startSession()!
    solveAll(store, session)
    store.completeExercise()
    store.nextExercise() // serve item 2
    store.deferExercise()
    expect(store.snapshot.totalExercisesCompleted).toBe(1)
  })

  it('recomputes freshness on load: due reviews are visible without new practice', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('fresh', driver)
    const s = store.snapshot.skills['PV.DHTE.Decompose']!
    s.currentVerifiedLevel = 1
    s.memory.reviewDueAt = new Date(Date.now() - 86_400_000).toISOString()
    store.persist()

    const reloaded = new LearnerStore('fresh', driver)
    expect(reloaded.skillState('PV.DHTE.Decompose').memory.freshness).toBe('due')
  })

  it('rejects imports whose checksum does not match the payload', () => {
    const driver = new MemoryDriver()
    const store = new LearnerStore('checksum', driver)
    store.snapshot.preferences.nickname = 'Origineel'
    store.persist()

    // Tamper with the stored snapshot body, keeping the old checksum.
    const raw = driver.get('rn:profile:checksum:snapshot:a') ?? driver.get('rn:profile:checksum:snapshot:b')!
    const tampered = JSON.parse(raw) as { data: { nickname: string } }
    tampered.data.nickname = 'Gemanipuleerd'
    expect(store.importJson(JSON.stringify(tampered))).toBe(false)
    expect(store.snapshot.preferences.nickname).toBe('Origineel')
  })

  it('a lapse (two independent failures in the latest three) lowers the verified level, never the high', () => {
    const store = new LearnerStore('lapse', new MemoryDriver())
    store.startSession()
    const session = store.currentSession!
    const skillId = session.exercise.primarySkillId
    const state = store.snapshot.skills[skillId]!
    state.currentVerifiedLevel = 2
    state.highestDemonstratedLevel = 2
    // Pre-seed the gate window so the new incorrect entry completes a lapse.
    state.independentGateWindow = [
      { exerciseId: 'e1', visitId: 'v1', at: new Date().toISOString(), correct: false, transfer: false, inverse: false, efficientStrategy: false, representation: 'symbolic', variationTags: [] },
      { exerciseId: 'e2', visitId: 'v1', at: new Date().toISOString(), correct: false, transfer: false, inverse: false, efficientStrategy: false, representation: 'symbolic', variationTags: [] },
    ]
    // Answer the primary step incorrectly on an independent tier.
    session.currentScaffold = 'S2'
    for (const step of session.exercise.steps) {
      if (step.skillTarget.role === 'primary') {
        store.submitStepAnswer(step.id, -999)
      }
    }
    store.completeExercise()
    const after = store.skillState(skillId)
    expect(after.currentVerifiedLevel).toBeLessThan(2)
    expect(after.highestDemonstratedLevel).toBe(2)
  })
})
