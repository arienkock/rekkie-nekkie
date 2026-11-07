/**
 * Changes made after the second usage export (November 2026): an empty test
 * page is a skip, not a failed test, and past empty pages are repaired; a
 * table she knows gets one test page per session and the next table is
 * suggested.
 */
import { describe, expect, it } from 'vitest'
import { LearnerStore } from '../learner-store'
import { MemoryDriver } from '../../storage/persistence'
import type { UsageClock } from '../../analytics/usage'
import type { UsageData } from '../../analytics/types'
import type { GeneratedExercise, LearnerSkillState, ScaffoldTier, SkillObservation } from '../../domain/types'
import { generateTestBlockFor } from '../../generators'
import { applyObservationToSkill, newSkillState } from '../../engine/evidence'
import { EMPTY_PAGE_VOID, voidEmptyTestPages } from '../repair-empty-pages'
import { suggestNextTable } from '../../generators/multiplication-facts'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { TableNudge } from '../../components/TableNudge'

class TestClock implements UsageClock {
  wall = Date.UTC(2026, 10, 7, 14)
  elapsed = 0
  now = () => this.wall
  monotonic = () => this.elapsed
  advance(ms: number) { this.wall += ms; this.elapsed += ms }
}

function serve(store: LearnerStore, exercise: GeneratedExercise, tier: ScaffoldTier) {
  return (store as unknown as { present(e: GeneratedExercise, t: ScaffoldTier, sibling: boolean): unknown }).present(exercise, tier, false)
}

function tablePage(seed: string, table = 1): GeneratedExercise {
  return generateTestBlockFor({ seed, tier: 'S3', band: 'harder', purpose: 'growth', primarySkillId: `MUL.FACT.T${table}` })
}

const allRight = (ex: GeneratedExercise) => Object.fromEntries(ex.steps.map((s) => [s.id, s.expected]))

/** What the app before this change allowed: "Toch nakijken" on an empty page. */
function oldStyleEmptyPage(store: LearnerStore, ex: GeneratedExercise) {
  serve(store, ex, 'S3')
  const mode = store.practiceMode
  store.practiceMode = 'proeftoets' // the only place an empty page can still be checked
  store.submitBlock({}, { confirmBlank: true })
  store.practiceMode = mode
  store.completeExercise()
}

describe('an empty test page is a skip, not a failed test', () => {
  it('cannot be checked: nothing is recorded and she can skip it', () => {
    const store = new LearnerStore('empty', new MemoryDriver(), new TestClock())
    store.startSession('tables', [1])
    const ex = tablePage('empty-page')
    serve(store, ex, 'S3')
    const before = structuredClone(store.skillState('MUL.FACT.T1'))
    const check = store.submitBlock({}, { confirmBlank: true })
    expect(check.blank).toHaveLength(ex.steps.length)
    expect(store.currentSession!.phase).toBe('working')
    expect(store.currentSession!.steps.every((r) => r.attemptCount === 0)).toBe(true)
    store.deferExercise('too-easy')
    expect(store.skillState('MUL.FACT.T1').masteryProbability).toBe(before.masteryProbability)
    expect(store.skillState('MUL.FACT.T1').exposureCount).toBe(before.exposureCount)
    const trace = store.usage.exercises.at(-1)!
    expect(trace).toMatchObject({ format: 'block', end: 'skipped', skipReason: 'too-easy' })
  })

  it('one answer filled in is still a real test: the empty lines count as wrong', () => {
    const store = new LearnerStore('one-answer', new MemoryDriver(), new TestClock())
    store.startSession('tables', [1])
    const ex = tablePage('one-answer')
    serve(store, ex, 'S3')
    const first = ex.steps[0]!
    store.submitBlock({ [first.id]: first.expected }, { confirmBlank: true })
    expect(store.currentSession!.phase).toBe('feedback')
    expect(store.currentSession!.steps.filter((r) => r.outcome === 'incorrect')).toHaveLength(ex.steps.length - 1)
  })

  it('a proeftoets page is still checked when empty, like a test', () => {
    const store = new LearnerStore('proef-empty', new MemoryDriver(), new TestClock())
    const s = store.startSession('proeftoets', [1], { proeftoetsId: 'proeftoets-blok-2' })!
    store.submitBlock({}, { confirmBlank: true })
    expect(s.phase).toBe('feedback')
  })
})

describe('past empty pages are repaired on load', () => {
  it('voids them, restores the score and level, and changes nothing the second time', () => {
    const clock = new TestClock()
    const driver = new MemoryDriver()
    let store!: LearnerStore
    // Three days, each a fresh visit with two pages all right.
    for (let day = 0; day < 3; day++) {
      store = new LearnerStore('repair', driver, clock)
      store.startSession('tables', [1])
      for (let i = 0; i < 2; i++) {
        const ex = tablePage(`real-${day}-${i}`)
        serve(store, ex, 'S3')
        store.submitBlock(allRight(ex))
        store.completeExercise()
        clock.advance(60_000)
      }
      store.persist()
      clock.advance(86_400_000)
    }
    const good = structuredClone(store.skillState('MUL.FACT.T1'))
    expect(good.currentVerifiedLevel).toBeGreaterThanOrEqual(2)
    for (let i = 0; i < 3; i++) { oldStyleEmptyPage(store, tablePage(`empty-${i}`)); clock.advance(10_000) }
    const hurt = store.skillState('MUL.FACT.T1')
    expect(hurt.masteryProbability).toBeLessThan(good.masteryProbability)
    expect(hurt.currentVerifiedLevel).toBeLessThan(good.currentVerifiedLevel)
    store.persist()

    const reloaded = new LearnerStore('repair', driver, clock)
    const fixed = reloaded.skillState('MUL.FACT.T1')
    expect(reloaded.snapshot.observations.filter((o) => o.voidedReason === EMPTY_PAGE_VOID)).toHaveLength(3)
    expect(fixed.masteryProbability).toBeCloseTo(good.masteryProbability, 9)
    expect(fixed.currentVerifiedLevel).toBe(good.currentVerifiedLevel)
    expect(fixed.exposureCount).toBe(good.exposureCount)
    expect(fixed.independentOpportunityCount).toBe(good.independentOpportunityCount)
    expect(fixed.independentGateWindow).toEqual(good.independentGateWindow)
    expect(fixed.coverage).toEqual(good.coverage)

    reloaded.persist()
    const again = new LearnerStore('repair', driver, clock)
    expect(again.skillState('MUL.FACT.T1')).toEqual(reloaded.skillState('MUL.FACT.T1'))
  })

  it('replays belief exactly, with forgetting between days and real mistakes kept', () => {
    // The same history with and without empty pages, two days apart each.
    const pattern = ['c', 'x', 'c', 'E', 'c', 'x', 'E', 'c', 'c', 'c', 'x', 'c', 'c', 'E', 'c', 'c', 'c'] as const
    const start = Date.UTC(2026, 9, 1)
    const run = (withEmpty: boolean) => {
      let state: LearnerSkillState = newSkillState('MUL.FACT.T3')
      const observations: SkillObservation[] = []
      pattern.forEach((kind, i) => {
        if (kind === 'E' && !withEmpty) return
        const applied = applyObservationToSkill(state, {
          skillId: 'MUL.FACT.T3', exerciseId: kind === 'E' ? `empty-${i}` : `ex-${i}`, visitId: `visit-${i}`,
          outcome: kind === 'c' ? 'correct' : 'incorrect',
          eligibility: { independent: true, firstCommittedResponse: true, attributable: true, answerRevealed: false, weight: 1 },
          scaffold: i % 2 ? 'S3' : 'S2', representation: i % 3 ? 'symbolic' : 'story', difficultyBand: 'standard',
          variationTags: [`T3:m${(i % 10) + 1}`, 'product'], isInverse: false, isTransfer: i % 3 === 0,
          efficientStrategyObserved: kind === 'c', activeTimeMs: 1000, now: new Date(start + i * 2 * 86_400_000),
          withLearningTransition: false, wasDueReview: false,
        })
        state = applied.state
        observations.push(applied.observation)
      })
      return { state, observations }
    }
    const expected = run(false).state
    const actual = run(true)
    const empties = pattern.flatMap((k, i) => (k === 'E' ? [`empty-${i}`] : []))
    const usage = {
      exercises: empties.map((exerciseId) => ({
        exerciseId, format: 'block', end: 'completed', mode: 'tables',
        steps: [{ submissions: 2, blankSubmissions: 2 }, { submissions: 2, blankSubmissions: 2 }],
      })),
    } as unknown as UsageData
    const skills = { 'MUL.FACT.T3': actual.state }
    expect(voidEmptyTestPages({ skills, observations: actual.observations, learningTransitions: [], usage }, () => [], new Date(start))).toEqual(['MUL.FACT.T3'])
    const fixed = skills['MUL.FACT.T3']
    expect(fixed.masteryProbability).toBeCloseTo(expected.masteryProbability, 12)
    expect(fixed.exposureCount).toBe(expected.exposureCount)
    const byKey = (c: LearnerSkillState['coverage']) => [...c].sort((a, b) => a.key.localeCompare(b.key))
    expect(byKey(fixed.coverage)).toEqual(byKey(expected.coverage))
    expect(fixed.independentGateWindow).toEqual(expected.independentGateWindow)
    // Running it again finds nothing new.
    expect(voidEmptyTestPages({ skills, observations: actual.observations, learningTransitions: [], usage }, () => [], new Date(start))).toEqual([])
  })
})

describe('tables she knows', () => {
  it('suggests the next table only when every chosen table is known', () => {
    const levels: Record<number, number> = { 1: 2, 10: 2, 2: 1 }
    const levelOf = (t: number) => levels[t]
    // 10 is known already, so after 1 comes 2.
    expect(suggestNextTable([1], levelOf)).toEqual({ known: [1], next: 2 })
    expect(suggestNextTable([1], () => 0).next).toBeNull()
    expect(suggestNextTable([1], (t) => (t === 1 ? 2 : 0)).next).toBe(10)
    expect(suggestNextTable([1, 10], levelOf)).toEqual({ known: [1, 10], next: 2 })
    expect(suggestNextTable([1, 2], levelOf).next).toBeNull()
    expect(suggestNextTable([], levelOf).next).toBeNull()
    const all = (t: number) => (t > 0 ? 3 : 0)
    expect(suggestNextTable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], all).next).toBeNull()
  })

  it('names the known tables and the next one', () => {
    const html = renderToString(createElement(TableNudge, { selected: [1, 10], levelOf: (t) => (t === 1 || t === 10 ? 2 : 0), action: 'start', onChoose: () => undefined }))
    expect(html.replace(/<!-- -->/g, '')).toContain('De tafels van 1 en 10 ken je al!')
    expect(html).toContain('Oefen de tafel van 2')
    const none = renderToString(createElement(TableNudge, { selected: [7], levelOf: () => 0, action: 'add', onChoose: () => undefined }))
    expect(none).toBe('')
  })

  it('serves a known table one test page per session, not one every other item', () => {
    const store = new LearnerStore('known', new MemoryDriver(), new TestClock())
    const known = store.skillState('MUL.FACT.T1')
    Object.assign(known, { currentVerifiedLevel: 2, highestDemonstratedLevel: 2, masteryProbability: 0.99, exposureCount: 20 })
    known.scaffolding.currentTier = 'S3'
    store.snapshot.skills['MUL.FACT.T1'] = known
    let s = store.startSession('tables', [1])
    let pages = 0
    while (s) {
      if (s.exercise.format === 'block') {
        pages++
        store.submitBlock(allRight(s.exercise))
      } else {
        for (const step of s.exercise.steps) store.submitStepAnswer(step.id, step.expected)
      }
      store.completeExercise()
      store.skillState('MUL.FACT.T1').scaffolding.currentTier = 'S3'
      s = store.nextExercise()
    }
    expect(pages).toBe(1)
  })
})

describe('test pages keep question kinds apart', () => {
  it('"□ × 10 = 30" lines come after the "4 × 10 =" lines, under their own instruction', () => {
    let mixed = 0
    for (let i = 0; i < 60; i++) {
      const page = tablePage(`kinds-${i}`, 10)
      const kinds = page.steps.map((s) => (s.promptNl.includes('□') ? 'missing' : 'other'))
      const firstMissing = kinds.indexOf('missing')
      if (firstMissing < 0 || firstMissing === 0 && kinds.every((k) => k === 'missing')) continue
      mixed++
      // Once the missing-number lines start, no other kind follows.
      expect(kinds.slice(firstMissing).every((k) => k === 'missing'), page.steps.map((s) => s.promptNl).join(' | ')).toBe(true)
      for (const step of page.steps) {
        if (step.promptNl.includes('□')) expect(step.promptNl).toMatch(/^Vul de ontbrekende getallen in\. □ × 10 = \d+$/)
        else expect(step.promptNl).not.toMatch(/ontbrekende/)
      }
    }
    expect(mixed).toBeGreaterThan(10)
  })
})
