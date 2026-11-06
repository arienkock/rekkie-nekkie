/**
 * Changes made after reading the first usage export (November 2026): skip
 * reasons, paced hints, honest first-try counts, no credit for steps copied
 * after a reveal, a fast path for items she already knows, and no test page
 * as the first item of a session.
 */
import { describe, expect, it } from 'vitest'
import { FLUENT_MS_PER_STEP, HINT_PAUSE_MS, LearnerStore } from '../learner-store'
import { MemoryDriver } from '../../storage/persistence'
import type { UsageClock } from '../../analytics/usage'
import type { GeneratedExercise, ScaffoldTier } from '../../domain/types'
import { generateExercise } from '../../generators'

class TestClock implements UsageClock {
  wall = Date.UTC(2026, 10, 6, 15)
  elapsed = 0
  now = () => this.wall
  monotonic = () => this.elapsed
  advance(ms: number) { this.wall += ms; this.elapsed += ms }
}

function setup(tables = [7]) {
  const clock = new TestClock()
  const driver = new MemoryDriver()
  const store = new LearnerStore('fixes', driver, clock)
  store.startSession('tables', tables)
  return { clock, driver, store }
}

/** Replace the current item with a specific generated exercise. */
function serve(store: LearnerStore, exercise: GeneratedExercise, tier: ScaffoldTier) {
  return (store as unknown as { present(e: GeneratedExercise, t: ScaffoldTier, sibling: boolean): unknown }).present(exercise, tier, false)
}

function scaleTwoSupported(): GeneratedExercise {
  return generateExercise({ seed: 'fixes:scale-two', primarySkillId: 'MUL.SCALE.TwoFactors', tier: 'S0', band: 'easier', purpose: 'growth' })
}

describe('hints are paced', () => {
  it('a quick second press shows the same hint; after the pause the next one comes', () => {
    const { store, clock } = setup()
    const first = store.requestHint()
    expect(store.currentSession!.hintLevel).toBe(1)
    expect(store.hintWaitMs()).toBe(HINT_PAUSE_MS)
    expect(store.requestHint()).toBe(first)
    expect(store.currentSession!.hintLevel).toBe(1)
    clock.advance(HINT_PAUSE_MS)
    expect(store.hintWaitMs()).toBe(0)
    store.requestHint()
    expect(store.currentSession!.hintLevel).toBe(2)
    expect(store.usage.activeExercise!.hints).toBe(2)
  })
})

describe('skip reasons', () => {
  it('records why she skipped, counts it, and survives a reload', () => {
    const { store, driver, clock } = setup()
    store.deferExercise('too-hard')
    store.nextExercise()
    store.deferExercise('too-easy')
    store.nextExercise()
    store.deferExercise()
    const [a, b, c] = store.usage.exercises
    expect(a!.skipReason).toBe('too-hard')
    expect(a!.events.at(-1)).toMatchObject({ action: 'skipped', reason: 'too-hard' })
    expect(b!.skipReason).toBe('too-easy')
    expect(c!.skipReason).toBeNull()
    expect(store.usage.lifetime.skipped).toBe(3)
    expect(store.usage.lifetime).toMatchObject({ skipsTooHard: 1, skipsTooEasy: 1 })
    expect(store.usage.lifetime.skipsUnclear).toBeUndefined()
    // Rollback safety: earlier app versions reject any totals field that is
    // not a plain number (they would lock saving), so keep totals flat.
    for (const totals of [store.usage.lifetime, ...store.usage.daily.map((d) => d.totals), ...store.usage.bySkill.map((d) => d.totals)]) {
      for (const [key, value] of Object.entries(totals)) {
        if (key === 'activeTimeBuckets') continue
        expect(typeof value === 'number' || (key === 'timedActiveMs' && value === null), key).toBe(true)
      }
    }
    const reloaded = new LearnerStore('fixes', driver, clock)
    expect(reloaded.storageIssue).toBeNull()
    expect(reloaded.usage.lifetime).toMatchObject({ skipsTooHard: 1, skipsTooEasy: 1 })
  })
})

describe('first-try counts and revealed answers', () => {
  it('a wrong first answer on any step means not right the first time', () => {
    const { store } = setup()
    const exercise = scaleTwoSupported()
    serve(store, exercise, 'S0')
    const [fact, one, answer] = exercise.steps
    store.submitStepAnswer(fact!.id, (fact!.expected as number) + 1)
    store.submitStepAnswer(fact!.id, fact!.expected)
    store.submitStepAnswer(one!.id, one!.expected)
    store.submitStepAnswer(answer!.id, answer!.expected)
    store.completeExercise()
    const trace = store.usage.exercises.at(-1)!
    expect(trace.firstAttemptCorrect).toBe(false)
    // The primary skill's own step was right: its evidence is unchanged.
    expect(store.snapshot.observations.find((o) => o.skillId === 'MUL.SCALE.TwoFactors')!.outcome).toBe('correct')
  })

  it('steps answered after the answer was shown carry no evidence; earlier ones keep theirs', () => {
    const { store, clock } = setup()
    const exercise = scaleTwoSupported()
    serve(store, exercise, 'S0')
    const [fact, one, answer] = exercise.steps
    store.submitStepAnswer(fact!.id, (fact!.expected as number) + 1)
    clock.advance(1_000)
    for (let i = 0; i < 4; i++) { store.requestHint(); clock.advance(HINT_PAUSE_MS) }
    store.submitStepAnswer(fact!.id, fact!.expected)
    store.submitStepAnswer(one!.id, one!.expected)
    store.submitStepAnswer(answer!.id, answer!.expected)
    store.completeExercise()
    const bySkill = (id: string) => store.snapshot.observations.find((o) => o.skillId === id)!
    expect(bySkill(fact!.skillTarget.skillId).eligibility.weight).toBe(0.6)
    expect(bySkill(fact!.skillTarget.skillId).outcome).toBe('incorrect')
    expect(bySkill('MUL.SCALE.OneFactor').eligibility).toMatchObject({ weight: 0, answerRevealed: true })
    expect(store.usage.exercises.at(-1)!.firstAttemptCorrect).toBe(false)
  })
})

describe('fast path for what she already knows', () => {
  it('a quick, first-try, hint-free guided success goes straight to Zelf (S2)', () => {
    const { store, clock } = setup()
    const session = store.currentSession!
    expect(session.currentScaffold).toBe('S0')
    clock.advance(3_000)
    for (const step of session.exercise.steps) store.submitStepAnswer(step.id, step.expected)
    store.completeExercise()
    expect(store.skillState('MUL.FACT.T7').scaffolding.currentTier).toBe('S2')
  })

  it('a slow guided success follows the normal ladder', () => {
    const { store, clock } = setup()
    const session = store.currentSession!
    for (let t = 0; t < FLUENT_MS_PER_STEP + 10_000; t += 5_000) { clock.advance(5_000); store.activity() }
    for (const step of session.exercise.steps) store.submitStepAnswer(step.id, step.expected)
    store.completeExercise()
    expect(store.skillState('MUL.FACT.T7').scaffolding.currentTier).not.toBe('S2')
  })

  it('a guided success after a hint is not the fast path', () => {
    const { store } = setup()
    const session = store.currentSession!
    store.requestHint()
    for (const step of session.exercise.steps) store.submitStepAnswer(step.id, step.expected)
    store.completeExercise()
    expect(store.skillState('MUL.FACT.T7').scaffolding.currentTier).not.toBe('S2')
  })
})

describe('no test page first', () => {
  it('opens with one Zelf item even when the skill is at toetsvorm; the test page comes after', () => {
    const clock = new TestClock()
    const store = new LearnerStore('first-item', new MemoryDriver(), clock)
    const state = store.skillState('MUL.FACT.T7')
    state.scaffolding.currentTier = 'S3'
    state.exposureCount = 6
    state.masteryProbability = 0.9
    store.snapshot.skills['MUL.FACT.T7'] = state
    const first = store.startSession('tables', [7])!
    expect(first.currentScaffold).toBe('S2')
    expect(first.exercise.format).not.toBe('block')
    for (const step of first.exercise.steps) store.submitStepAnswer(step.id, step.expected)
    store.completeExercise()
    const second = store.nextExercise()!
    expect(second.currentScaffold).toBe('S3')
    expect(second.exercise.format).toBe('block')
  })
})

describe('estimating with help', () => {
  it('shows where the friendly number goes, without giving it away', () => {
    for (let i = 0; i < 20; i++) {
      const ex = generateExercise({ seed: `bridge:${i}`, primarySkillId: 'MUL.ESTIMATE.Friendly', tier: 'S1', band: 'easier', purpose: 'growth' })
      if (ex.archetypeId !== 'mul-estimate') continue
      const friendly = ex.steps.find((s) => s.id === 'friendly')!
      const estimate = ex.steps.find((s) => s.id === 'estimate')!
      expect(estimate.promptNl).toMatch(/≈ … × \d+ =$/)
      expect(estimate.promptNl).not.toContain(` ${friendly.expected} ×`)
    }
  })
})
