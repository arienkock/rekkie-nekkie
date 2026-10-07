import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LearnerStore } from '../../store/learner-store'
import { MemoryDriver } from '../../storage/persistence'
import { ExerciseView, visibleExerciseWidget } from '../../components/ExerciseView'
import { generateExercise } from '../../generators'

const render = (store: LearnerStore) => renderToString(createElement(ExerciseView, { store }))

function setup(tier: 'S0' | 'S1' | 'S2' = 'S0') {
  const store = new LearnerStore('resume', new MemoryDriver())
  const session = store.startSession('tables', [7])!
  session.exercise = generateExercise({ primarySkillId: 'MUL.FACT.T7', seed: 'array:0', tier, band: 'standard', purpose: 'growth' })
  session.currentScaffold = tier
  return { store, session }
}

describe('exercise work survives component remounts', () => {
  it('restores unfinished input and shown hints without recording an attempt', () => {
    const { store, session } = setup()
    store.setExerciseWork('answers', ['123'])
    store.setExerciseWork('hint', store.requestHint())
    const before = render(store)
    const after = render(store)
    expect(after).toBe(before)
    expect(after).toContain('value="123"')
    expect(after).toContain(session.work.hint!)
    expect(session.attempts).toBe(0)
    expect(store.snapshot.observations).toHaveLength(0)
  })

  it('restores the solved screen after a corrected answer while keeping the first response evidence', () => {
    const { store, session } = setup()
    const step = session.exercise.steps[0]!
    store.submitStepAnswer(step.id, -1)
    const solution = Number(step.solutionNl.split(' = ')[1])
    expect(store.submitStepAnswer(step.id, solution).isCorrect).toBe(true)
    store.setExerciseWork('answers', [solution])
    store.setExerciseWork('solved', [true])
    const before = render(store)
    const after = render(store)
    expect(after).toBe(before)
    expect(after).toContain('Opgelost!')
    expect(after).toContain('Volgende opgave')
    expect(after).not.toContain('Jouw antwoord')
    expect(session.steps[0]!.outcome).toBe('incorrect')
    expect(session.attempts).toBe(2)
    store.completeExercise()
    expect(store.snapshot.observations.at(-1)!.outcome).toBe('incorrect')
    const next = store.nextExercise()!
    expect(next.work.answers).toEqual([''])
    expect(next.work.solved).toEqual([false])
    expect(next.work.hint).toBeNull()
  })

  it('restores the active step of a partially completed exercise', () => {
    const { store, session } = setup()
    session.exercise = generateExercise({ primarySkillId: 'ADD.JUMP.NoBridge', seed: 'resume-steps', tier: 'S0', band: 'standard', purpose: 'growth' })
    store.setExerciseWork('answers', ['123', '456', ''])
    store.setExerciseWork('solved', [true, false, false])
    store.setExerciseWork('stepIndex', 1)
    const html = render(store)
    expect(html).toContain('value="456"')
    expect(html).toContain('aria-current="step"')
    expect(session.work.stepIndex).toBe(1)
  })
})

describe('multiplication support fades visibly', () => {
  it('shows arrays at S0, a strategy at S1, and no model at S2; hints restore the array', () => {
    for (const tier of ['S0', 'S1', 'S2'] as const) {
      const { store, session } = setup(tier)
      // Choose a product item because missing-factor questions deliberately have no array.
      for (let seed = 0; seed < 20; seed++) {
        const exercise = generateExercise({ primarySkillId: 'MUL.FACT.T7', seed: `support:${seed}`, tier, band: 'standard', purpose: 'growth' })
        if (exercise.widget) { session.exercise = exercise; break }
      }
      expect(session.exercise.widget?.type).toBe('multiplication-array')
      const initial = render(store)
      if (tier === 'S0') expect(initial).toContain('<svg')
      if (tier === 'S1') {
        expect(initial).toContain('multiplication-strategy')
        expect(initial).not.toContain('<svg')
      }
      if (tier === 'S2') expect(visibleExerciseWidget(session, false)).toBeNull()
      store.setExerciseWork('hint', store.requestHint())
      expect(render(store)).toContain('<svg')
      expect(visibleExerciseWidget(session, true)?.props.mode).toBe('array')
    }
  })
})

it('changing the next-session tables does not change the active session', () => {
  const { store } = setup()
  store.savePreferences({ selectedTables: [8, 9] })
  expect(store.selectedTables).toEqual([7])
  expect(store.currentSession!.exercise.primarySkillId).toBe('MUL.FACT.T7')
  store.startSession('tables', store.snapshot.preferences.selectedTables)
  expect(store.selectedTables).toEqual([8, 9])
})
