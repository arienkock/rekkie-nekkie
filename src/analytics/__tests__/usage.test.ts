import { describe, expect, it } from 'vitest'
import { HINT_PAUSE_MS, LearnerStore, SESSION_TARGET_ITEMS } from '../../store/learner-store'
import { MemoryDriver, ProfileStore, canonicalStringify, type StorageDriver } from '../../storage/persistence'
import type { LearnerSnapshot } from '../../domain/types'
import { DETAIL_LIMIT, EVENT_LIMIT, PROFILE_BUDGET_BYTES, SNAPSHOT_TARGET_BYTES, pruneUsage } from '../usage'
import type { UsageClock } from '../usage'

class TestClock implements UsageClock {
  wall = Date.UTC(2026, 10, 2, 10)
  elapsed = 0
  now = () => this.wall
  monotonic = () => this.elapsed
  advance(ms: number) { this.wall += ms; this.elapsed += ms }
}

function setup(driver: StorageDriver = new MemoryDriver()) {
  const clock = new TestClock()
  const store = new LearnerStore('usage', driver, clock)
  const session = store.startSession('tables', [7])!
  return { clock, store, driver, session, step: session.exercise.steps[0]! }
}

function solve(store: LearnerStore) {
  const session = store.currentSession!
  if (session.exercise.format === 'block') {
    store.submitBlock(Object.fromEntries(session.exercise.steps.map((s) => [s.id, s.expected])))
  } else {
    for (const step of session.exercise.steps) store.submitStepAnswer(step.id, step.expected)
  }
  store.completeExercise()
}

describe('local usage measurements', () => {
  it('partitions time into visible activity, inactivity, background and other app screens', () => {
    const { clock, store, step } = setup()
    clock.advance(10_000)
    store.editAnswer(0, '4')
    clock.advance(70_000)
    store.setVisible(false)
    clock.advance(20_000)
    store.setVisible(true)
    clock.advance(30_000)
    store.setScreen('progress')
    clock.advance(40_000)
    store.setScreen('exercise')
    clock.advance(2_000)
    store.submitStepAnswer(step.id, step.expected)
    store.completeExercise()
    const trace = store.usage.exercises[0]!
    expect(trace.activeMs).toBe(102_000)
    expect(trace.idleMs).toBe(10_000)
    expect(trace.hiddenMs).toBe(20_000)
    expect(trace.otherScreenMs).toBe(40_000)
    expect(trace.unobservedMs).toBe(0)
    expect(trace.firstActionMs).toBe(10_000)
    expect(trace.actionCounts.hidden).toBe(1)
    expect(trace.actionCounts.visible).toBe(1)
    expect(store.snapshot.observations[0]!.activeTimeMs).toBe(102_000)
  })

  it('uses monotonic time when the calendar clock changes', () => {
    const { clock, store } = setup()
    clock.wall += 86_400_000
    clock.elapsed += 2_000
    solve(store)
    expect(store.usage.exercises[0]!.activeMs).toBe(2_000)
    expect(store.usage.lifetime.timedActiveMs).toBe(2_000)
    expect(store.usage.lifetime.timingSamples).toBe(1)
  })

  it('conserves time across frequent input events with fractional-millisecond clock readings', () => {
    const { clock, store } = setup()
    for (let i = 0; i < 100; i++) { clock.advance(0.25); store.activity() }
    solve(store)
    expect(store.usage.exercises[0]!.activeMs).toBe(25)
  })

  it('counts edit episodes and interface failures without making them math failures', () => {
    const { clock, store, session, step } = setup()
    store.editAnswer(0, '1')
    clock.advance(250)
    store.editAnswer(0, '12')
    clock.advance(2_000)
    store.editAnswer(0, '123')
    store.submitStepAnswer(step.id, '')
    store.submitStepAnswer(step.id, 'geen getal')
    expect(session.attempts).toBe(0)
    store.submitStepAnswer(step.id, -1)
    store.submitStepAnswer(step.id, -1)
    store.requestHint()
    clock.advance(5_000)
    store.submitStepAnswer(step.id, step.expected)
    store.completeExercise()
    const trace = store.usage.exercises[0]!
    const recorded = trace.steps[0]!
    expect(recorded.editEpisodes).toBe(2)
    expect(recorded.submissions).toBe(5)
    expect(recorded.invalidSubmissions).toBe(1)
    expect(recorded.blankSubmissions).toBe(1)
    expect(recorded.repeatedSubmissions).toBe(1)
    expect(recorded.firstAnswer).toBe('')
    expect(recorded.lastAnswer).toBe(step.expected)
    expect(recorded.firstOutcome).toBe('incorrect')
    expect(recorded.lastOutcome).toBe('correct')
    expect(recorded.correctedAfterError).toBe(true)
    expect(recorded.succeededAfterHint).toBe(true)
    expect(trace.firstAttemptCorrect).toBe(false)
    expect(store.usage.lifetime.stepsCorrected).toBe(1)
    expect(store.snapshot.observations[0]!.outcome).toBe('incorrect')
    // No intermediate keystroke contents in semantic events.
    expect(trace.events.filter((e) => e.action === 'edit').every((e) => e.answer === undefined)).toBe(true)
  })

  it('keeps submission details bounded while preserving full answers for the learner', () => {
    const { store, step } = setup()
    const long = 'a'.repeat(10_000)
    store.editAnswer(0, long)
    store.submitStepAnswer(step.id, long)
    expect(store.currentSession!.work.answers[0]).toBe(long)
    expect(String(store.usage.activeExercise!.steps[0]!.lastAnswer).length).toBeLessThan(200)
    expect(String(store.usage.activeExercise!.events.at(-1)!.answer)).toContain('[truncated]')
  })

  it('bounds timelines while retaining exact counters and both the beginning and end', () => {
    const { store, step } = setup()
    for (let i = 0; i < EVENT_LIMIT + 15; i++) store.submitStepAnswer(step.id, -1)
    const trace = store.usage.activeExercise!
    expect(trace.events).toHaveLength(EVENT_LIMIT)
    expect(trace.droppedEvents).toBe(15)
    expect(trace.steps[0]!.submissions).toBe(EVENT_LIMIT + 15)
    expect(trace.actionCounts.submit).toBe(EVENT_LIMIT + 15)
  })

  it('links answer reveals to a fresh follow-up and distinguishes them from successful help', () => {
    const { store, clock } = setup()
    const firstId = store.usage.activeExercise!.id
    for (let i = 0; i < 4; i++) { store.requestHint(); clock.advance(HINT_PAUSE_MS) }
    solve(store)
    const trace = store.usage.exercises[0]!
    expect(trace.revealed).toBe(true)
    expect(trace.firstAttemptCorrect).toBe(false)
    expect(trace.steps[0]!.succeededAfterHint).toBe(false)
    store.nextExercise()
    expect(store.usage.activeExercise!.siblingOf).toBe(firstId)
    expect(store.snapshot.observations[0]!.eligibility.answerRevealed).toBe(true)
  })

  it('records block warnings, item scores, and the distinction between a check and committed evidence', () => {
    const clock = new TestClock()
    const store = new LearnerStore('block', new MemoryDriver(), clock)
    const session = store.startSession('proeftoets', [7], { proeftoetsId: 'proeftoets-blok-2' })!
    const answers = Object.fromEntries(session.exercise.steps.map((s) => [s.id, s.expected]))
    const first = session.exercise.steps[0]!
    answers[first.id] = 'geen getal'
    expect(store.submitBlock(answers).invalid.length).toBeGreaterThan(0)
    expect(session.steps.every((s) => s.attemptCount === 0)).toBe(true)
    expect(store.usage.activeExercise!.steps.every((s) => s.firstOutcome === null)).toBe(true)
    answers[first.id] = ''
    expect(store.submitBlock(answers).blank).toContain(first.id)
    store.submitBlock(answers, { confirmBlank: true })
    store.completeExercise()
    const trace = store.usage.exercises[0]!
    expect(trace.actionCounts.check_block).toBe(3)
    expect(trace.steps.find((s) => s.stepId === first.id)!.firstOutcome).toBe('incorrect')
    expect(trace.steps.filter((s) => s.firstOutcome === 'correct')).toHaveLength(session.steps.length - 1)
    expect(trace.format).toBe('block')
  })

  it('does not move step timing to the last line as a side effect of checking a block', () => {
    const clock = new TestClock()
    const store = new LearnerStore('block-focus', new MemoryDriver(), clock)
    const session = store.startSession('proeftoets', [7], { proeftoetsId: 'proeftoets-blok-2' })!
    clock.advance(10_000)
    store.submitBlock({})
    clock.advance(5_000)
    store.persist()
    expect(store.usage.activeExercise!.steps[0]!.activeMs).toBe(15_000)
    expect(store.usage.activeExercise!.steps.at(-1)!.activeMs).toBe(0)
    expect(session.phase).toBe('working')
  })
})

describe('resuming and exporting practice', () => {
  it('restores the exact exercise, answers, hints and first attempt without inventing active time', () => {
    const { clock, store, driver, step, session } = setup()
    clock.advance(8_000)
    store.editAnswer(0, '123')
    store.submitStepAnswer(step.id, -1)
    store.setExerciseWork('hint', store.requestHint())
    store.setExerciseWork('feedback', { validation: step.validate(-1), stepId: step.id, seq: 1, attempt: 1, advancedTo: null, stale: false })
    store.persist()
    clock.advance(120_000)
    const restored = new LearnerStore('usage', driver, clock)
    expect(restored.currentSession!.exercise.fingerprint).toBe(session.exercise.fingerprint)
    expect(restored.currentSession!.id).toBe(session.id)
    expect(restored.currentSession!.visitId).toBe(session.visitId)
    expect(restored.currentSession!.work.answers).toEqual(['123'])
    expect(restored.currentSession!.work.hint).toBe(session.work.hint)
    expect(restored.currentSession!.work.feedback).toEqual(session.work.feedback)
    expect(restored.currentSession!.steps[0]!.firstAnswer).toBe(-1)
    expect(restored.usage.activeExercise!.activeMs).toBe(8_000)
    expect(restored.usage.activeExercise!.unobservedMs).toBe(120_000)
    expect(restored.usage.activeExercise!.timingReliable).toBe(false)
    solve(restored)
    expect(restored.snapshot.observations).toHaveLength(1)
    expect(restored.snapshot.observations[0]!.outcome).toBe('incorrect')
    expect(restored.usage.lifetime.exercises).toBe(1)
    expect(restored.usage.lifetime.timingSamples).toBe(0)
    expect(restored.usage.lifetime.reloads).toBe(1)
  })

  it('restores checked practice-test blocks including their original root seed and variant', () => {
    const driver = new MemoryDriver()
    const clock = new TestClock()
    const store = new LearnerStore('test', driver, clock)
    const first = store.startSession('proeftoets', [7], { proeftoetsId: 'proeftoets-blok-2' })!
    store.submitBlock(Object.fromEntries(first.exercise.steps.map((s) => [s.id, s.expected])))
    const restored = new LearnerStore('test', driver, clock)
    expect(restored.currentSession!.phase).toBe('feedback')
    expect(restored.currentSession!.exercise.fingerprint).toBe(first.exercise.fingerprint)
    expect(restored.currentSession!.exercise.steps.map((s) => s.expected)).toEqual(first.exercise.steps.map((s) => s.expected))
    restored.endSession()
    const paused = new LearnerStore('test', driver, clock)
    expect(paused.proeftoetsPaused).toBe(true)
    expect(paused.sessionItemsDone).toBe(1)
    expect(paused.nextExercise()!.exercise.primarySkillId).toBe('NUM.ROUND.Ten')
  })

  it('preserves progress if an update prevents regeneration, recording an interruption without a failure', () => {
    const { clock, store } = setup()
    const data = JSON.parse(store.exportJson()) as LearnerSnapshot
    data.practice!.exercise!.signature = 'different-generator-version'
    const restored = new LearnerStore('other', new MemoryDriver(), clock)
    expect(restored.importJson(JSON.stringify(data))).toBe(true)
    expect(restored.currentSession).toBeNull()
    expect(restored.snapshot.observations).toHaveLength(0)
    expect(restored.usage.lifetime.interrupted).toBe(1)
    expect(restored.usage.exercises[0]!.interruptionReason).toBe('exercise-could-not-be-restored')
  })

  it('continues unchanged-answer counts across reloads and identifies a hint as the first action', () => {
    const { store, clock, driver, step } = setup()
    clock.advance(5_000)
    store.requestHint()
    expect(store.usage.activeExercise!.steps[0]!.firstActionMs).toBe(5_000)
    store.submitStepAnswer(step.id, -1)
    const restored = new LearnerStore('usage', driver, clock)
    restored.submitStepAnswer(step.id, -1)
    expect(restored.usage.activeExercise!.steps[0]!.repeatedSubmissions).toBe(1)
  })

  it('keeps the original retrieval date when a saved correct response is completed on a later day', () => {
    const { store, clock, driver, step } = setup()
    store.submitStepAnswer(step.id, step.expected)
    const answeredAt = new Date(clock.now()).toISOString()
    clock.advance(2 * 86_400_000)
    const restored = new LearnerStore('usage', driver, clock)
    restored.completeExercise()
    expect(restored.snapshot.observations[0]!.observedAt).toBe(answeredAt)
    expect(restored.usage.exercises[0]!.endedAt).toBe(new Date(clock.now()).toISOString())
    expect(restored.usage.lifetime.completed).toBe(1)
  })

  it('never rolls up twice when exporting repeatedly, importing or reloading', () => {
    const { store, clock, driver } = setup()
    solve(store)
    store.completeExercise()
    const first = store.exportJson()
    store.exportJson()
    const restored = new LearnerStore('usage', driver, clock)
    expect(restored.usage.lifetime.exercises).toBe(1)
    expect(restored.importJson(first)).toBe(true)
    expect(restored.usage.lifetime.exercises).toBe(1)
    expect(restored.practicePaused).toBe(true)
    expect(restored.nextExercise()).not.toBeNull()
    solve(restored)
    expect(restored.usage.lifetime.exercises).toBe(2)
    expect(JSON.parse(restored.exportJson()).exportedAt).toBeTruthy()
  })

  it('distinguishes skips, early stops, replacements and finished practice sessions', () => {
    const { store } = setup()
    store.deferExercise()
    store.nextExercise()
    store.endSession()
    store.startSession('tables', [7])
    store.startSession('tables', [8])
    for (let i = 0; i < SESSION_TARGET_ITEMS; i++) { solve(store); store.nextExercise() }
    expect(store.usage.lifetime.skipped).toBe(1)
    expect(store.usage.lifetime.stopped).toBe(1)
    expect(store.usage.lifetime.replaced).toBe(1)
    expect(store.usage.lifetime.completed).toBe(SESSION_TARGET_ITEMS)
    expect(store.usage.sessionCounts).toEqual({ completed: 1, stopped: 1, replaced: 1, interrupted: 0 })
    expect(store.usage.sessions.at(-1)!.target).toBe(SESSION_TARGET_ITEMS)
  })

  it('migrates legacy placeholder times to unknown without resetting achievements', () => {
    const { store } = setup()
    solve(store)
    const data = JSON.parse(store.exportJson()) as LearnerSnapshot
    delete data.usage
    delete data.practice
    delete data.observations[0]!.timingMeasured
    data.observations[0]!.activeTimeMs = 60_000
    data.skills['MUL.FACT.T7']!.highestDemonstratedLevel = 3
    expect(store.importJson(JSON.stringify(data))).toBe(true)
    expect(store.snapshot.observations[0]!.activeTimeMs).toBeNull()
    expect(store.skillState('MUL.FACT.T7').highestDemonstratedLevel).toBe(3)
    expect(store.usage.lifetime.exercises).toBe(0)
  })

  it('does not overwrite the current profile on malformed analytics imports', () => {
    const { store } = setup()
    store.savePreferences({ nickname: 'Keep me' })
    const bad = JSON.parse(store.exportJson())
    bad.usage.exercises = null
    expect(store.importJson(JSON.stringify(bad))).toBe(false)
    expect(store.snapshot.preferences.nickname).toBe('Keep me')
    expect(store.currentSession).not.toBeNull()
  })
})

describe('bounded local retention', () => {
  it('prunes details by age and count, while retaining lifetime and date roll-ups exactly once', () => {
    const { store, clock } = setup()
    for (let i = 0; i < DETAIL_LIMIT + 4; i++) {
      store.deferExercise()
      store.startSession('tables', [7])
    }
    expect(store.usage.exercises.length).toBeLessThanOrEqual(DETAIL_LIMIT)
    const total = store.usage.lifetime.exercises
    const daily = store.usage.daily[0]!.totals.exercises
    expect(daily).toBe(total)
    clock.advance(31 * 86_400_000)
    store.persist()
    expect(store.usage.exercises).toHaveLength(0)
    expect(store.usage.sessions).toHaveLength(0)
    expect(store.usage.lifetime.exercises).toBe(total)
    expect(store.usage.monthly[0]!.totals.exercises).toBe(total)
    expect(store.currentSession).not.toBeNull()
    expect(store.usage.activeExercise).not.toBeNull()
    clock.advance(800 * 86_400_000)
    pruneUsage(store.usage, clock.now())
    expect(store.usage.daily).toHaveLength(0)
    expect(store.usage.monthly).toHaveLength(0)
    expect(store.usage.lifetime.exercises).toBe(total)
  })

  it('fits mature detailed history into the byte budget without losing learning proof or current work', () => {
    const { store, driver } = setup()
    solve(store)
    const sample = store.usage.exercises[0]!
    store.usage.exercises = Array.from({ length: 100 }, (_, i) => ({
      ...structuredClone(sample), id: `synthetic-${i}`,
      events: Array.from({ length: EVENT_LIMIT }, () => ({ action: 'submit' as const, offsetMs: 1, answer: 'x'.repeat(160) })),
    }))
    store.startSession('tables', [7])
    store.editAnswer(0, '123')
    const before = structuredClone(store.skillState('MUL.FACT.T7'))
    store.persist()
    expect(store.saveFailed).toBe(false)
    expect(JSON.stringify(store.snapshot).length * 2).toBeLessThanOrEqual(SNAPSHOT_TARGET_BYTES)
    const persistence = new ProfileStore<LearnerSnapshot>('usage', driver)
    expect(persistence.estimateSaveBytes({ revision: store.snapshot.revision, savedAt: store.snapshot.savedAt, data: store.snapshot })).toBeLessThanOrEqual(PROFILE_BUDGET_BYTES)
    expect(store.skillState('MUL.FACT.T7')).toEqual(before)
    expect(store.snapshot.practice!.exercise!.session.work.answers).toEqual(['123'])
    expect(store.usage.lifetime.exercises).toBe(1)
    expect(store.usage.exercises.some((e) => e.droppedEvents > 0)).toBe(true)
  })

  it('recovers from a quota failure and keeps progress when optional history must be dropped', () => {
    class QuotaDriver extends MemoryDriver {
      rejectNext = false
      override set(key: string, value: string) {
        if (this.rejectNext && key.includes(':snapshot:')) {
          this.rejectNext = false
          throw new Error('QuotaExceededError')
        }
        super.set(key, value)
      }
    }
    const driver = new QuotaDriver()
    const { store, clock } = setup(driver)
    solve(store)
    driver.rejectNext = true
    store.startSession('tables', [7])
    expect(store.saveFailed).toBe(false)
    expect(store.usage.exercises).toHaveLength(0)
    const restored = new LearnerStore('usage', driver, clock)
    expect(restored.snapshot.totalExercisesCompleted).toBe(1)
    expect(restored.usage.lifetime.completed).toBe(1)
    expect(restored.currentSession).not.toBeNull()
  })

  it('preserves all twelve proof entries for all 102 skills even when essential state exceeds the soft snapshot target', () => {
    const { store, driver, clock } = setup()
    for (const state of Object.values(store.snapshot.skills)) {
      state.independentGateWindow = Array.from({ length: 12 }, (_, i) => ({
        exerciseId: `ex-${state.skillId}-${i}`, visitId: `visit-${i}`, at: new Date(clock.now()).toISOString(),
        correct: true, transfer: true, inverse: false, efficientStrategy: true,
        representation: 'symbolic', variationTags: ['toetsvorm', 'standard', 'inverse-verification'],
      }))
    }
    store.editAnswer(0, '123')
    store.persist()
    store.persist()
    expect(store.saveFailed).toBe(false)
    const restored = new LearnerStore('usage', driver, clock)
    expect(Object.values(restored.snapshot.skills).every((s) => s.independentGateWindow.length === 12)).toBe(true)
    expect(restored.currentSession!.work.answers).toEqual(['123'])
  })

  it('retains in-memory work and the last committed snapshot after persistent write failure', () => {
    class FailingDriver extends MemoryDriver {
      fail = false
      override set(key: string, value: string) {
        if (this.fail) throw new Error('Storage unavailable')
        super.set(key, value)
      }
    }
    const driver = new FailingDriver()
    const { store, clock, step } = setup(driver)
    const previous = new ProfileStore<LearnerSnapshot>('usage', driver).load(canonicalStringify)!
    driver.fail = true
    store.editAnswer(0, '123')
    store.submitStepAnswer(step.id, step.expected)
    store.completeExercise()
    expect(store.saveFailed).toBe(true)
    expect(store.snapshot.totalExercisesCompleted).toBe(1)
    expect(store.usage.lifetime.completed).toBe(1)
    expect(new ProfileStore<LearnerSnapshot>('usage', driver).load(canonicalStringify)!.revision).toBe(previous.revision)
    // Manual export still contains the unsaved progress.
    expect(JSON.parse(store.exportJson()).totalExercisesCompleted).toBe(1)
    driver.fail = false
    store.persist()
    expect(store.saveFailed).toBe(false)
    expect(new LearnerStore('usage', driver, clock).snapshot.totalExercisesCompleted).toBe(1)
  })
})
