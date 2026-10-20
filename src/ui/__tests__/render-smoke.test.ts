/**
 * Render smoke test: every skill, at every tier, as a single item and as a
 * test-format block, renders through the real React components without
 * throwing — plus the Leerpad, Voortgang and the proeftoets summary path.
 * Server-side rendering, so no DOM is needed.
 */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryDriver } from '../../storage/persistence'
import { LearnerStore } from '../../store/learner-store'
import { ExerciseView } from '../../components/ExerciseView'
import { PathView } from '../../components/PathView'
import { ProgressView } from '../../components/ProgressView'
import { generateExercise, generateTestBlockFor, SUPPORTED_SKILLS } from '../../generators'
import type { GeneratedExercise, ScaffoldTier } from '../../domain/types'

/** Put a generated exercise into a store session, as the session runner would. */
function storeWith(exercise: GeneratedExercise, tier: ScaffoldTier): LearnerStore {
  const store = new LearnerStore('render', new MemoryDriver())
  store.currentSession = {
    id: 'sess', visitId: store.visitId, exercise,
    work: { stepIndex: 0, feedback: null, hint: null, noteOpen: false, answers: exercise.steps.map(() => ''), solved: exercise.steps.map(() => false) },
    currentScaffold: tier, highestAssistanceUsed: tier, hintLevel: 0,
    steps: exercise.steps.map((s) => ({ stepId: s.id, firstAnswer: null, outcome: 'unknown', attemptCount: 0 })),
    phase: 'working', attempts: 0, startedAt: new Date().toISOString(), evidenceWeight: 1, lastSavedAt: null,
  }
  return store
}

describe('screens render for every skill', () => {
  for (const skillId of SUPPORTED_SKILLS) {
    it(`${skillId}`, () => {
      for (const tier of ['S0', 'S1', 'S2'] as const) {
        const ex = generateExercise({ seed: `render:${skillId}:${tier}`, tier, band: 'standard', purpose: 'growth', primarySkillId: skillId })
        const html = renderToString(createElement(ExerciseView, { store: storeWith(ex, tier) }))
        expect(html).toContain(ex.steps[0]!.promptNl.slice(0, 12).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;'))
      }
      const block = generateTestBlockFor({ seed: `render-block:${skillId}`, tier: 'S3', band: 'standard', purpose: 'growth', primarySkillId: skillId })
      const store = storeWith(block, 'S3')
      let html = renderToString(createElement(ExerciseView, { store }))
      expect(html).toContain('Klaar, nakijken')
      expect(html).not.toContain('Hint')
      // After checking: every line marked, right answers shown for wrong ones.
      store.submitBlock({}, { confirmBlank: true })
      html = renderToString(createElement(ExerciseView, { store }))
      expect(html).toContain('Goed antwoord')
    })
  }

  it('Leerpad and Voortgang render', () => {
    const store = new LearnerStore('render-path', new MemoryDriver())
    const path = renderToString(createElement(PathView, { store, onStartLesson: () => undefined, onStartTest: () => undefined }))
    expect(path).toContain('Les 3 Vermenigvuldigen – oefenen')
    expect(path).toContain('Proeftoets blok 2')
    expect(renderToString(createElement(ProgressView, { store }))).toContain('Grafieken')
  })
})
