/**
 * ExerciseView: renders one generated exercise and drives the didactic loop
 * (docs/adaptive-learning-design.md §4.1): present → work → feedback →
 * retry → complete. First-response evidence is captured by the store on the
 * first submit; retries never create new evidence. Blank/unparseable input
 * stays in `working` and never becomes wrong-math evidence.
 *
 * Feedback must be *perceptible*, not merely present (docs §4.3). Every
 * check therefore changes something the learner can see:
 *  - the banner is keyed on a check counter, so it re-mounts and replays its
 *    entrance even when the message text is byte-identical to the last one;
 *  - the answer field itself carries the outcome until the answer is edited;
 *  - a repeated attempt is numbered, so the change also survives reduced
 *    motion and screen readers, which ignore an unchanged live region;
 *  - a solved step says which step is next, because the form underneath it
 *    silently swapped to that step.
 */
import { useEffect, useRef, useState } from 'react'
import type { AnswerType, GeneratedExercise, GeneratedStep, StepValidation } from '../domain/types'
import type { LearnerStore } from '../store/learner-store'
import { SESSION_TARGET_ITEMS } from '../store/learner-store'
import { getSkill } from '../domain/knowledge-graph'
import { ExerciseWidget } from './widgets'

type Answer = string | number | Record<string, string | number>

/** How the last check landed; drives the answer field's own styling. */
type Outcome = 'correct' | 'incorrect' | 'invalid'

const TIER_LABELS: Record<string, string> = {
  S0: 'Samen oefenen',
  S1: 'Met een beetje hulp',
  S2: 'Zelf oefenen',
  S3: 'Uitdagend',
}

/** Hints 1–3 come from the ladder; the 4th press reveals the solution. */
const HINT_LADDER_LENGTH = 3

interface FeedbackState {
  validation: StepValidation
  /** Step the message is about; it retires when the learner edits elsewhere. */
  stepId: string
  /** Bumped on every check so the banner re-mounts and replays its entrance. */
  seq: number
  /** Parseable attempts on this step so far (unreadable input does not count). */
  attempt: number
  /** Step the form jumped to after a correct answer; null when none is left. */
  advancedTo: number | null
  /** Set once the learner edits again: the message describes an older answer. */
  stale: boolean
}

function outcomeOf(validation: StepValidation): Outcome {
  if (validation.isCorrect) return 'correct'
  return validation.invalidFormat ? 'invalid' : 'incorrect'
}

export function ExerciseView({ store }: { store: LearnerStore }) {
  const session = store.currentSession!
  const exercise = session.exercise
  const [stepIndex, setStepIndex] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [answers, setAnswers] = useState<Answer[]>(() => exercise.steps.map(() => ''))
  const [solved, setSolved] = useState<boolean[]>(() => exercise.steps.map(() => false))
  // NOTE: the app shell mounts <ExerciseView key={session.id}> so a new
  // exercise naturally starts with fresh local flow state.

  const answerAreaRef = useRef<HTMLDivElement>(null)
  const step = exercise.steps[stepIndex]!
  const allSolved = solved.every(Boolean)
  const answer = answers[stepIndex]!

  // The answer field only carries an outcome while the message still
  // describes what is currently typed in *this* step.
  const liveOutcome: Outcome | null =
    feedback && !feedback.stale && feedback.stepId === step.id ? outcomeOf(feedback.validation) : null

  const focusAnswer = () => {
    const input = answerAreaRef.current?.querySelector('input')
    if (input instanceof HTMLInputElement) input.focus()
  }

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
    // A message always describes an answer that was *checked*. The moment the
    // learner edits, retire it: a message about this step fades to history, a
    // message about another step disappears rather than sit there looking live.
    setFeedback((prev) => {
      if (!prev) return prev
      if (prev.stepId !== step.id) return null
      return prev.stale ? prev : { ...prev, stale: true }
    })
  }

  const submit = () => {
    // A blank answer is checked too: the store answers "Vul eerst je antwoord
    // in" (and records nothing), which beats a dead button that explains
    // nothing. Unreadable input likewise never becomes wrong-math evidence.
    const validation = store.submitStepAnswer(step.id, answer)
    const attempt = session.steps.find((r) => r.stepId === step.id)?.attemptCount ?? 0

    let advancedTo: number | null = null
    if (validation.isCorrect) {
      const nextSolved = solved.map((was, i) => (i === stepIndex ? true : was))
      const next = nextSolved.findIndex((s) => !s)
      advancedTo = next === -1 ? null : next
      setSolved(nextSolved)
      // A stale hint from the previous step would be confusing.
      setHint(null)
      if (advancedTo !== null) setStepIndex(advancedTo)
    }

    setFeedback((prev) => ({
      validation,
      stepId: step.id,
      seq: (prev?.seq ?? 0) + 1,
      attempt,
      advancedTo,
      stale: false,
    }))

    // Checking from the button moves focus off the input; put it back so a
    // retry is one keystroke away. A correct answer re-focuses via stepIndex.
    if (!validation.isCorrect) focusAnswer()
  }

  const goToStep = (i: number) => {
    setStepIndex(i)
    // Carrying another step's message across would read as feedback on this one.
    setFeedback((prev) => (prev && prev.stepId === exercise.steps[i]!.id ? prev : null))
  }

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
  const itemNumber = Math.min(store.sessionItemsDone + 1, SESSION_TARGET_ITEMS)
  const solutionVisible = hint !== null && session.hintLevel >= HINT_LADDER_LENGTH + 1
  const firstTryCount = session.steps.filter((r) => r.outcome === 'correct').length

  return (
    <div className="exercise-view">
      <header className="exercise-header">
        <div className="session-progress">
          Opgave {itemNumber} van {SESSION_TARGET_ITEMS}
          <span className="progress-dots" aria-hidden>
            {Array.from({ length: SESSION_TARGET_ITEMS }, (_, i) => (
              <span
                key={i}
                className={`dot ${
                  i < store.sessionItemsDone ? 'full' : i === store.sessionItemsDone ? 'current' : ''
                }`}
              />
            ))}
          </span>
        </div>
        <span className="tier-badge">{TIER_LABELS[session.currentScaffold] ?? session.currentScaffold}</span>
        {store.lastSelectionExplanation && (
          <button
            type="button"
            className="selection-note"
            aria-expanded={noteOpen}
            onClick={() => setNoteOpen((v) => !v)}
          >
            {store.lastSelectionExplanation}
          </button>
        )}
        <button type="button" className="btn ghost small stop-button" onClick={() => store.endSession()}>
          Stoppen
        </button>
        {noteOpen && store.lastSelectionExplanation && (
          <p className="selection-note-full">{store.lastSelectionExplanation}</p>
        )}
      </header>

      <section className="exercise-card">
        <div className="exercise-visual">
          <h2 className="exercise-title">{skill.titleNl}</h2>
          <p className="exercise-instruction">{exercise.instructionNl}</p>

          <ExerciseWidget widget={exercise.widget} />
        </div>

        <div className="exercise-work">
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
                          if (navigable) goToStep(i)
                        }}
                      >
                        <span className="step-num" aria-hidden>
                          {solved[i] ? '✓' : i + 1}
                        </span>
                        <span className="step-prompt">{s.promptNl}</span>
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
                  outcome={liveOutcome}
                  onChange={setAnswer}
                  onSubmit={submit}
                />
                <button type="button" className="btn primary check-button" onClick={submit}>
                  Controleer
                </button>
              </div>

              {/* A live region that always exists: inserting the banner into a
                  standing region announces reliably, creating one may not. */}
              <div className="feedback-slot" role="status" aria-live="polite">
                {feedback && (
                  <FeedbackBanner key={feedback.seq} feedback={feedback} stepCount={exercise.steps.length} />
                )}
              </div>

              <div className="help-row">
                <button
                  type="button"
                  className="btn ghost hint-button"
                  onClick={requestHint}
                  disabled={solutionVisible}
                >
                  {hintButtonLabel(session.hintLevel, solutionVisible)}
                </button>
                <div className="hint-slot" aria-live="polite">
                  {hint && (
                    <div className="hint-box" key={session.hintLevel}>
                      <span className="hint-level">
                        {session.hintLevel > HINT_LADDER_LENGTH
                          ? 'Oplossing'
                          : `Hint ${session.hintLevel} van ${HINT_LADDER_LENGTH}`}
                      </span>
                      {hint}
                      {session.hintLevel > HINT_LADDER_LENGTH && (
                        <div className="hint-solution">Oplossing: {step.solutionNl}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {allSolved && (
            <div className="explanation">
              <p className="solved-banner" role="status">
                <span aria-hidden>✅</span> Opgelost!
                {firstTryCount === session.steps.length && ' Alles in één keer goed. 🌟'}
              </p>
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
        </div>
      </section>
    </div>
  )
}

/** One check's result. Re-mounted per check, so its entrance always replays. */
function FeedbackBanner({ feedback, stepCount }: { feedback: FeedbackState; stepCount: number }) {
  const outcome = outcomeOf(feedback.validation)
  const icon = outcome === 'correct' ? '✅' : outcome === 'invalid' ? '✍️' : '💡'
  // Identical wording on a repeat check is indistinguishable without this:
  // the number changes even when the animation is switched off.
  const showAttempt = outcome === 'incorrect' && feedback.attempt >= 2

  return (
    <div className={`feedback ${outcome} ${feedback.stale ? 'stale' : ''}`}>
      <span className="feedback-icon" aria-hidden>
        {icon}
      </span>
      <span className="feedback-text">
        {feedback.validation.feedbackNl}
        {showAttempt && <span className="feedback-attempt"> · poging {feedback.attempt}</span>}
        {feedback.advancedTo !== null && (
          <span className="feedback-next">
            Nu stap {feedback.advancedTo + 1} van {stepCount}.
          </span>
        )}
      </span>
    </div>
  )
}

function hintButtonLabel(hintLevel: number, solutionVisible: boolean): string {
  if (solutionVisible) return '🔑 Antwoord staat hieronder'
  if (hintLevel >= HINT_LADDER_LENGTH) return '🔑 Laat het antwoord zien'
  if (hintLevel === 0) return '💡 Hint'
  return `💡 Nog een hint (${hintLevel} van ${HINT_LADDER_LENGTH})`
}

function describeAnswerType(step: GeneratedStep): string {
  switch (step.answerType.kind) {
    case 'integer':
      return step.answerType.unit ? `heel getal in ${step.answerType.unit}` : 'heel getal'
    case 'time':
      return 'digitale tijd (bijv. 08:20)'
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
  outcome,
  onChange,
  onSubmit,
}: {
  step: GeneratedStep
  exercise: GeneratedExercise
  value: Answer
  outcome: Outcome | null
  onChange: (v: Answer) => void
  onSubmit: () => void
}) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit()
    }
  }
  // Carried by the field itself so the last check stays visible right where
  // the learner is looking, not only in the banner below.
  const mark = outcome ? ` checked-${outcome}` : ''

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
                className={mark.trim()}
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
              className={mark.trim()}
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
              className={mark.trim()}
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
          className={`answer-input${mark}`}
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
      return '08:20'
    case 'money':
      return '4,50'
    case 'quotient-remainder':
      return ''
    default:
      return 'Jouw antwoord…'
  }
}
