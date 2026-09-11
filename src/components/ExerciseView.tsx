/**
 * ExerciseView: renders one generated exercise and drives the didactic loop
 * (docs/adaptive-learning-design.md §4.1): present → work → feedback →
 * retry → complete. First-response evidence is captured by the store on the
 * first submit; retries never create new evidence. Blank/unparseable input
 * stays in `working` and never becomes wrong-math evidence.
 */
import { useEffect, useRef, useState } from 'react'
import type { AnswerType, GeneratedExercise, GeneratedStep, StepValidation } from '../domain/types'
import type { LearnerStore } from '../store/learner-store'
import { SESSION_TARGET_ITEMS } from '../store/learner-store'
import { getSkill } from '../domain/knowledge-graph'
import { ExerciseWidget } from './widgets'

type Answer = string | number | Record<string, string | number>

const TIER_LABELS: Record<string, string> = {
  S0: 'Samen oefenen',
  S1: 'Met een beetje hulp',
  S2: 'Zelf oefenen',
  S3: 'Uitdagend',
}

function isEmptyAnswer(a: Answer): boolean {
  if (typeof a === 'number') return false
  if (typeof a === 'string') return a.trim() === ''
  return Object.values(a).every((v) => String(v ?? '').trim() === '')
}

export function ExerciseView({ store }: { store: LearnerStore }) {
  const session = store.currentSession!
  const exercise = session.exercise
  const [stepIndex, setStepIndex] = useState(0)
  const [feedback, setFeedback] = useState<StepValidation | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answer[]>(() => exercise.steps.map(() => ''))
  const [solved, setSolved] = useState<boolean[]>(() => exercise.steps.map(() => false))
  // NOTE: the app shell mounts <ExerciseView key={session.id}> so a new
  // exercise naturally starts with fresh local flow state.

  const answerAreaRef = useRef<HTMLDivElement>(null)
  const step = exercise.steps[stepIndex]!
  const allSolved = solved.every(Boolean)
  const answer = answers[stepIndex]!
  const canSubmit = !isEmptyAnswer(answer)

  // Focus the answer input of the active step (keyboard + child flow), and
  // keep it in view without jumping the page around.
  useEffect(() => {
    const input = answerAreaRef.current?.querySelector('input')
    if (input instanceof HTMLInputElement) {
      input.focus()
      input.scrollIntoView({ block: 'nearest' })
    }
  }, [stepIndex])

  const setAnswer = (value: Answer) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[stepIndex] = value
      return next
    })
  }

  const submit = () => {
    if (!canSubmit) return
    const validation = store.submitStepAnswer(step.id, answer)
    setFeedback(validation)
    if (validation.isCorrect) {
      setSolved((prev) => {
        const next = [...prev]
        next[stepIndex] = true
        return next
      })
      // A stale hint from the previous step would be confusing.
      setHint(null)
      // Advance to the first unsolved step.
      setStepIndex((current) => {
        for (let i = 0; i < exercise.steps.length; i++) {
          if (i !== current && !solvedOrSolving(i, current)) return i
        }
        return current
      })
    }
  }

  /** True when step i is solved (or is the one we just solved). */
  const solvedOrSolving = (i: number, current: number): boolean =>
    i === current || solved[i] === true

  const requestHint = () => {
    setHint(store.requestHint())
  }

  // Complete the item and present the next one; when the session target is
  // reached the store returns null and the app shell shows the summary.
  const finish = () => {
    store.completeExercise()
    store.nextExercise()
  }

  const skip = () => {
    store.deferExercise()
    store.nextExercise()
  }

  const skill = getSkill(exercise.primarySkillId)

  return (
    <div className="exercise-view">
      <header className="exercise-header">
        <div className="session-progress">
          Opgave {Math.min(store.sessionItemsDone + 1, SESSION_TARGET_ITEMS)} van {SESSION_TARGET_ITEMS}
          <span className="progress-dots" aria-hidden>
            {Array.from({ length: SESSION_TARGET_ITEMS }, (_, i) => (
              <span key={i} className={`dot ${i < store.sessionItemsDone ? 'full' : ''}`} />
            ))}
          </span>
        </div>
        <span className="tier-badge">{TIER_LABELS[session.currentScaffold] ?? session.currentScaffold}</span>
        {store.lastSelectionExplanation && (
          <span className="selection-note" title={store.lastSelectionExplanation}>
            {store.lastSelectionExplanation}
          </span>
        )}
        <button type="button" className="btn ghost small" onClick={() => store.endSession()}>
          Stoppen
        </button>
      </header>

      <section className="exercise-card">
        <h2 className="exercise-title">{skill.titleNl}</h2>
        <p className="exercise-instruction">{exercise.instructionNl}</p>

        <ExerciseWidget widget={exercise.widget} />

        {!allSolved && (
          <div className="step-area">
            <ol className="step-list">
              {exercise.steps.map((s, i) => {
                const navigable = solved[i] || i === stepIndex
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`step ${i === stepIndex ? 'active' : ''} ${solved[i] ? 'solved' : ''}`}
                      disabled={!navigable}
                      aria-current={i === stepIndex ? 'step' : undefined}
                      onClick={() => {
                        if (navigable) setStepIndex(i)
                      }}
                    >
                      {i + 1}. {s.promptNl}
                    </button>
                  </li>
                )
              })}
            </ol>

            <div className="answer-area" ref={answerAreaRef}>
              <StepInput
                step={step}
                exercise={exercise}
                value={answer}
                onChange={setAnswer}
                onSubmit={submit}
              />
              <button type="button" className="btn primary" onClick={submit} disabled={!canSubmit}>
                Controleer
              </button>
            </div>

            {feedback && (
              <div
                className={`feedback ${
                  feedback.isCorrect ? 'correct' : feedback.invalidFormat ? 'invalid' : 'incorrect'
                }`}
                role="status"
              >
                {feedback.isCorrect ? '✅ ' : feedback.invalidFormat ? '✍️ ' : '💡 '}
                {feedback.feedbackNl}
              </div>
            )}

            <div className="help-row">
              <button type="button" className="btn ghost" onClick={requestHint}>
                💡 Hint
              </button>
              {hint && (
                <div className="hint-box" aria-live="polite">
                  {hint}
                  {session.hintLevel >= 4 && <div className="hint-solution">Oplossing: {step.solutionNl}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {allSolved && (
          <div className="explanation">
            <h3>Uitleg</h3>
            <ul>
              {exercise.explanationNl.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <button type="button" className="btn primary big" onClick={finish}>
              {store.sessionItemsDone + 1 >= SESSION_TARGET_ITEMS ? 'Klaar! ✨' : 'Volgende opgave →'}
            </button>
          </div>
        )}

        {!allSolved && (
          <footer className="exercise-footer">
            <button type="button" className="btn ghost" onClick={skip}>
              Deze overslaan
            </button>
            <span className="answer-kind">Antwoord: {describeAnswerType(step)}</span>
          </footer>
        )}
      </section>
    </div>
  )
}

function describeAnswerType(step: GeneratedStep): string {
  switch (step.answerType.kind) {
    case 'integer':
      return step.answerType.unit ? `heel getal in ${step.answerType.unit}` : 'heel getal'
    case 'time':
      return 'digitale tijd (bijv. 8:20)'
    case 'money':
      return 'bedrag met komma (bijv. 4,50)'
    case 'quotient-remainder':
      return 'uitkomst en rest'
    case 'digits':
      return 'cijfers per plek'
    default:
      return 'korte tekst'
  }
}

// ---- Typed answer inputs ----

function StepInput({
  step,
  exercise,
  value,
  onChange,
  onSubmit,
}: {
  step: GeneratedStep
  exercise: GeneratedExercise
  value: Answer
  onChange: (v: Answer) => void
  onSubmit: () => void
}) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit()
    }
  }

  switch (step.answerType.kind) {
    case 'digits': {
      const columns = (exercise.widget?.props.columns as string[]) ?? ['D', 'H', 'T', 'E']
      const map = (value as Record<string, string | number>) ?? {}
      return (
        <div className="digit-inputs">
          {columns.map((c) => (
            <label key={c} className="digit-input">
              <span>{c}</span>
              <input
                inputMode="numeric"
                maxLength={1}
                value={String(map[c] ?? '')}
                onChange={(e) => onChange({ ...map, [c]: e.target.value })}
                onKeyDown={onKeyDown}
                aria-label={`Cijfer op plek ${c}`}
              />
            </label>
          ))}
        </div>
      )
    }
    case 'quotient-remainder': {
      const map = (value as Record<string, string | number>) ?? {}
      return (
        <div className="qr-inputs">
          <label>
            Uitkomst{' '}
            <input
              inputMode="numeric"
              value={String(map.quotient ?? '')}
              onChange={(e) => onChange({ ...map, quotient: e.target.value })}
              onKeyDown={onKeyDown}
              aria-label="Uitkomst"
            />
          </label>
          <label>
            rest{' '}
            <input
              inputMode="numeric"
              value={String(map.remainder ?? '')}
              onChange={(e) => onChange({ ...map, remainder: e.target.value })}
              onKeyDown={onKeyDown}
              aria-label="Rest"
            />
          </label>
        </div>
      )
    }
    default: {
      const kind: AnswerType['kind'] = step.answerType.kind
      return (
        <input
          className="answer-input"
          type="text"
          inputMode={kind === 'integer' ? 'numeric' : 'text'}
          placeholder={placeholderFor(step)}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Jouw antwoord"
        />
      )
    }
  }
}

function placeholderFor(step: GeneratedStep): string {
  switch (step.answerType.kind) {
    case 'time':
      return '8:20'
    case 'money':
      return '4,50'
    case 'quotient-remainder':
      return ''
    default:
      return 'Jouw antwoord…'
  }
}