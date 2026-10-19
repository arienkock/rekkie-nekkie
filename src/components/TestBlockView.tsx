/**
 * Toetsvorm: a test page (docs/test-readiness-plan.md §A). All items are
 * visible at once under the book's instruction, there is no hint button,
 * and nothing is marked until "Klaar, nakijken". Then every line shows
 * whether it was right, the right answer where it was not, and whether the
 * block passed (80%, like a Test jezelf group).
 */
import { useState } from 'react'
import type { ExerciseAnswer } from '../domain/types'
import type { LearnerStore } from '../store/learner-store'
import { getSkill } from '../domain/knowledge-graph'
import { BLOCK_PASS_FRACTION, blockPassed } from '../generators/test-block'
import { ExerciseWidget } from './widgets'
import { StepInput } from './ExerciseView'

export function TestBlockView({ store }: { store: LearnerStore }) {
  const session = store.currentSession!
  const exercise = session.exercise
  const { answers } = session.work
  const checked = session.phase === 'feedback'
  const [invalid, setInvalid] = useState<string[]>([])
  const target = store.sessionTargetItems
  const itemNumber = Math.min(store.sessionItemsDone + 1, target)

  const setAnswer = (index: number, value: ExerciseAnswer) => {
    const next = [...answers]
    next[index] = value
    store.setExerciseWork('answers', next)
    if (invalid.length > 0) setInvalid([])
  }

  const check = () => {
    const map = Object.fromEntries(exercise.steps.map((s, i) => [s.id, answers[i] ?? '']))
    const result = store.submitBlock(map)
    setInvalid(result.invalid)
  }

  const finish = () => {
    store.completeExercise()
    store.nextExercise()
  }

  const correct = session.steps.filter((r) => r.outcome === 'correct').length
  const total = exercise.steps.length
  const passed = blockPassed(correct, total)
  const isProeftoets = store.practiceMode === 'proeftoets'

  return (
    <div className="exercise-view test-block">
      <header className="exercise-header">
        <div className="session-progress">
          {isProeftoets ? `${store.proeftoets?.titleNl ?? 'Proeftoets'} · opdracht` : 'Opgave'} {itemNumber} van {target}
        </div>
        <span className="tier-badge toetsvorm">Toetsvorm</span>
        <button type="button" className="btn ghost small stop-button" onClick={() => store.endSession()}>
          Stoppen
        </button>
      </header>

      <section className="exercise-card block-card">
        <h2 className="exercise-title">{getSkill(exercise.primarySkillId).titleNl}</h2>
        <p className="exercise-instruction book-instruction">{exercise.instructionNl}</p>
        {!checked && <p className="muted block-note">Zoals op je toets: geen hints. Maak alles en kijk dan na. Werk op papier als je dat wilt.</p>}
        <ExerciseWidget widget={exercise.widget} />

        <ol className="block-items">
          {exercise.steps.map((step, i) => {
            const response = session.steps.find((r) => r.stepId === step.id)
            const ok = response?.outcome === 'correct'
            const bad = invalid.includes(step.id)
            return (
              <li key={step.id} className={`block-item ${checked ? (ok ? 'right' : 'wrong') : ''} ${bad ? 'invalid' : ''}`}>
                {step.widget && <ExerciseWidget widget={step.widget} />}
                <div className="block-line">
                  <span className="block-prompt">{step.promptNl}</span>
                  {checked ? (
                    <span className="block-answer">
                      <span className="given">{formatAnswer(answers[i])}</span>
                      <span aria-label={ok ? 'goed' : 'fout'}>{ok ? ' ✓' : ' ✗'}</span>
                    </span>
                  ) : (
                    <StepInput step={step} exercise={exercise} value={answers[i] ?? ''} outcome={bad ? 'invalid' : null} onChange={(v) => setAnswer(i, v)} onSubmit={() => undefined} />
                  )}
                </div>
                {checked && !ok && <div className="block-solution">Goed antwoord: {step.solutionNl}</div>}
                {bad && <div className="block-solution">{step.validate(answers[i] ?? '').feedbackNl}</div>}
              </li>
            )
          })}
        </ol>

        {!checked ? (
          <div className="btn-row">
            <button type="button" className="btn primary big" onClick={check}>Klaar, nakijken</button>
            {invalid.length > 0 && <span className="pending-hint" role="status">Schrijf de rode antwoorden nog even goed op.</span>}
          </div>
        ) : (
          <div className="explanation" role="status">
            <p className={`block-score ${passed ? 'passed' : 'not-passed'}`}>
              {correct} van {total} goed.{' '}
              {passed
                ? 'Geslaagd: dit kun je ook zoals op de toets! 🌟'
                : `Nog niet genoeg (je hebt ${Math.ceil(total * BLOCK_PASS_FRACTION)} goed nodig). We oefenen dit nog even${isProeftoets ? ' bij maatwerk' : ''}.`}
            </p>
            {exercise.explanationNl.length > 0 && (
              <>
                <h3>Uitleg</h3>
                <ul>{exercise.explanationNl.slice(0, 6).map((line, i) => <li key={i}>{line}</li>)}</ul>
              </>
            )}
            <button type="button" className="btn primary big" onClick={finish}>
              {store.sessionItemsDone + 1 >= target ? 'Klaar! ✨' : 'Volgende →'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function formatAnswer(answer: ExerciseAnswer | undefined): string {
  if (answer === undefined || answer === '') return '—'
  if (typeof answer === 'object') {
    const parts = Object.entries(answer).filter(([, v]) => String(v).trim() !== '')
    return parts.length ? parts.map(([k, v]) => `${v} × ${k}`).join(', ') : '—'
  }
  return String(answer)
}
