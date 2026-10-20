/**
 * Toetsvorm: a test page (docs/test-readiness-plan.md §A). All items are
 * visible at once under the book's instruction, there is no hint button,
 * and nothing is marked until "Klaar, nakijken". Then every line shows
 * whether it was right, the right answer where it was not, and whether the
 * block passed (80%, like a Test jezelf group).
 *
 * Tablet rules (the on-screen keyboard covers half the screen):
 *  - nothing above the field she is typing in changes size while she types:
 *    a red marker from the last check stays until the next check, it only
 *    fades once edited;
 *  - messages about the check appear right below the button she pressed,
 *    and are scrolled into view, because the keyboard may still be open;
 *  - empty or unreadable answers name the item and offer a button to go
 *    there, instead of leaving her to search a long page.
 */
import { useEffect, useRef, useState } from 'react'
import type { ExerciseAnswer } from '../domain/types'
import type { LearnerStore } from '../store/learner-store'
import { getSkill } from '../domain/knowledge-graph'
import { BLOCK_PASS_FRACTION, blockPassed } from '../generators/test-block'
import { ExerciseWidget } from './widgets'
import { StepInput } from './ExerciseView'

/** What the last press of "Klaar, nakijken" found, until the next press. */
interface CheckNotice {
  kind: 'invalid' | 'blank'
  stepIds: string[]
  /** What the check said per step. Never re-validated while she edits: that
   *  would tell her an answer is right before the page is checked. */
  messages: Record<string, string>
}

const FOCUSABLE = 'input, button.choice-option'

/** Answers short enough for two items side by side in landscape. A written
 *  split (4 × 1000 + 6 × 100 + …) or a row of choices needs the full width. */
const SHORT_ANSWERS = new Set(['integer', 'money', 'time', 'quotient-remainder'])

export function TestBlockView({ store }: { store: LearnerStore }) {
  const session = store.currentSession!
  const exercise = session.exercise
  const { answers } = session.work
  const checked = session.phase === 'feedback'
  const [notice, setNotice] = useState<CheckNotice | null>(null)
  const [edited, setEdited] = useState<string[]>([])
  const listRef = useRef<HTMLOListElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const target = store.sessionTargetItems
  const itemNumber = Math.min(store.sessionItemsDone + 1, target)

  // The result (or the warning) takes the place of the button she just
  // pressed: keep that spot on screen, also when the keyboard is still open.
  useEffect(() => {
    if (checked || notice) footerRef.current?.scrollIntoView({ block: 'nearest' })
  }, [checked, notice])

  const numberOf = (stepId: string) => exercise.steps.findIndex((s) => s.id === stepId) + 1

  const setAnswer = (index: number, value: ExerciseAnswer) => {
    const next = [...answers]
    next[index] = value
    store.setExerciseWork('answers', next)
    const id = exercise.steps[index]!.id
    if (notice?.stepIds.includes(id) && !edited.includes(id)) setEdited([...edited, id])
  }

  const check = (confirmBlank = false) => {
    const map = Object.fromEntries(exercise.steps.map((s, i) => [s.id, answers[i] ?? '']))
    const result = store.submitBlock(map, { confirmBlank })
    setEdited([])
    const messages = Object.fromEntries(Object.entries(result.results).map(([id, v]) => [id, v.feedbackNl]))
    setNotice(
      result.invalid.length > 0 ? { kind: 'invalid', stepIds: result.invalid, messages }
        : result.blank.length > 0 && !confirmBlank ? { kind: 'blank', stepIds: result.blank, messages }
          : null,
    )
    // Close the keyboard: the page is checked, or the notice needs reading.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  /** Put the cursor in item `index`, or close the keyboard after the last. */
  const focusItem = (index: number) => {
    const item = listRef.current?.children[index]
    const field = item?.querySelector(FOCUSABLE)
    if (field instanceof HTMLElement) {
      field.focus()
      item!.scrollIntoView({ block: 'nearest' })
      return
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    footerRef.current?.scrollIntoView({ block: 'nearest' })
  }

  const finish = () => {
    store.completeExercise()
    store.nextExercise()
  }

  const correct = session.steps.filter((r) => r.outcome === 'correct').length
  const total = exercise.steps.length
  const passed = blockPassed(correct, total)
  const isProeftoets = store.practiceMode === 'proeftoets'
  const twoColumns = exercise.steps.every((s) => !s.widget && SHORT_ANSWERS.has(s.answerType.kind))
  const flagged = (id: string) => !checked && notice?.stepIds.includes(id) === true
  const firstFlagged = notice ? numberOf(notice.stepIds[0]!) : 0

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
        <p className="muted block-note">Zoals op je toets: geen hints. Maak alles en kijk dan na. Werk op papier als je dat wilt.</p>
        <ExerciseWidget widget={exercise.widget} />

        <ol className={`block-items ${twoColumns ? 'two-columns' : ''}`} ref={listRef}>
          {exercise.steps.map((step, i) => {
            const response = session.steps.find((r) => r.stepId === step.id)
            const ok = response?.outcome === 'correct'
            const isFlagged = flagged(step.id)
            const fixed = edited.includes(step.id)
            const state = checked ? (ok ? 'right' : 'wrong') : isFlagged ? `flagged-${notice!.kind}${fixed ? ' fixed' : ''}` : ''
            return (
              <li key={step.id} className={`block-item ${state}`} data-reveal>
                {step.widget && <ExerciseWidget widget={step.widget} />}
                <div className="block-line">
                  <span className="step-num" aria-hidden>{i + 1}</span>
                  <span className="block-prompt">{step.promptNl}</span>
                  {checked ? (
                    <span className="block-answer">
                      <span className="given">{formatAnswer(answers[i])}</span>
                      <span aria-label={ok ? 'goed' : 'fout'}>{ok ? ' ✓' : ' ✗'}</span>
                    </span>
                  ) : (
                    <StepInput
                      step={step}
                      exercise={exercise}
                      value={answers[i] ?? ''}
                      outcome={isFlagged && notice!.kind === 'invalid' && !fixed ? 'invalid' : null}
                      onChange={(v) => setAnswer(i, v)}
                      onSubmit={() => focusItem(i + 1)}
                    />
                  )}
                </div>
                {checked && !ok && <div className="block-solution">Goed antwoord: {step.solutionNl}</div>}
                {isFlagged && notice!.kind === 'invalid' && (
                  <div className="block-solution">{notice!.messages[step.id]}</div>
                )}
              </li>
            )
          })}
        </ol>

        <div className="block-footer" ref={footerRef}>
          {!checked ? (
            <>
              <div className="btn-row">
                <button type="button" className="btn primary big" onClick={() => check()}>Klaar, nakijken</button>
              </div>
              {notice && (
                <div className={`block-notice ${notice.kind}`} role="status">
                  <p>
                    {notice.kind === 'invalid'
                      ? `${itemList(notice.stepIds.map(numberOf))}: dat kan ik niet lezen. Schrijf ${notice.stepIds.length > 1 ? 'ze' : 'het'} nog even goed op.`
                      : `${itemList(notice.stepIds.map(numberOf))} ${notice.stepIds.length > 1 ? 'zijn' : 'is'} nog leeg.`}
                  </p>
                  <div className="btn-row">
                    <button type="button" className="btn" onClick={() => focusItem(firstFlagged - 1)}>
                      Naar opgave {firstFlagged}
                    </button>
                    {notice.kind === 'blank' && (
                      <button type="button" className="btn ghost" onClick={() => check(true)}>Toch nakijken</button>
                    )}
                  </div>
                </div>
              )}
            </>
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
        </div>
      </section>
    </div>
  )
}

/** "Opgave 3", "Opgave 3 en 5", "Opgave 1, 3 en 5". */
function itemList(numbers: number[]): string {
  if (numbers.length === 1) return `Opgave ${numbers[0]}`
  return `Opgave ${numbers.slice(0, -1).join(', ')} en ${numbers[numbers.length - 1]}`
}

function formatAnswer(answer: ExerciseAnswer | undefined): string {
  if (answer === undefined || answer === '') return '—'
  if (typeof answer === 'object') {
    const parts = Object.entries(answer).filter(([, v]) => String(v).trim() !== '')
    return parts.length ? parts.map(([k, v]) => `${v} × ${k}`).join(', ') : '—'
  }
  return String(answer)
}
