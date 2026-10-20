/**
 * Leerpad: the bloks and lessons of the workbook, each skill with its stage
 * (met hulp → zelf → toetsvorm → na een week nog), a button to practise one
 * lesson, and the practice test per blok. Maatwerk from the last practice
 * test is listed on top, like the book's "> M:" references.
 */
import { useState } from 'react'
import type { LearnerStore } from '../store/learner-store'
import { DEFAULT_BLOK_ID } from '../store/learner-store'
import { getSkill } from '../domain/knowledge-graph'
import { LEARNING_PATH, PROEFTOETSEN, currentLesson, lessonComplete } from '../domain/learning-path'
import { pathStage } from '../domain/child-status'
import { StageBadge } from './ProgressView'

export function PathView({ store, onStartLesson, onStartTest }: {
  store: LearnerStore
  onStartLesson: (lessonId: string) => void
  onStartTest: (testId: string) => void
}) {
  const states = store.snapshot.skills
  const currentBlokId = store.snapshot.preferences.currentBlokId ?? DEFAULT_BLOK_ID
  const [open, setOpen] = useState<string>(currentBlokId)
  const focus = store.snapshot.focusSkills ?? []

  return (
    <div className="path-view">
      <h2>Leerpad</h2>
      <p className="muted">
        De lessen uit je rekenboek. Elke vaardigheid gaat van <strong>met hulp</strong> naar <strong>zelf</strong> naar{' '}
        <strong>toetsvorm</strong>: zo staat het ook op je toets.
      </p>

      {focus.length > 0 && (
        <section className="settings-card maatwerk">
          <h3>Maatwerk</h3>
          <p className="muted">Uit je laatste proeftoets. Deze komen vaker terug tot je ze in toetsvorm goed hebt.</p>
          <ul>{focus.map((id) => <li key={id}>{getSkill(id).titleNl} <StageBadge stage={pathStage(store.skillState(id))} /></li>)}</ul>
        </section>
      )}

      {LEARNING_PATH.map((blok) => {
        const test = PROEFTOETSEN.find((p) => p.blokId === blok.id)
        const done = blok.lessons.filter((l) => lessonComplete(l, states)).length
        const now = currentLesson(blok.id, states)
        return (
          <section key={blok.id} className={`island path-blok ${open === blok.id ? 'expanded' : ''}`}>
            <button type="button" className="island-header" aria-expanded={open === blok.id} onClick={() => setOpen(open === blok.id ? '' : blok.id)}>
              <span className="island-title">{blok.titleNl}{blok.id === currentBlokId ? ' · nu in de klas' : ''}</span>
              <span className="island-count">{done}/{blok.lessons.length}</span>
              <span className="island-chevron" aria-hidden>{open === blok.id ? '▾' : '▸'}</span>
            </button>
            {open === blok.id && (
              <div className="path-lessons">
                <p className="muted small">{blok.sourceNl}</p>
                {test && (
                  <div className="path-test">
                    <div>
                      <strong>{test.titleNl}</strong>
                      <p className="muted small">{test.sourceNl}</p>
                    </div>
                    <button type="button" className="btn" onClick={() => onStartTest(test.id)}>
                      {store.proeftoetsPaused && store.proeftoets?.id === test.id
                        ? `Ga verder (opdracht ${store.sessionItemsDone + 1} van ${test.groups.length})`
                        : 'Maak de proeftoets'}
                    </button>
                  </div>
                )}
                <ol className="lesson-list">
                  {blok.lessons.map((lesson) => {
                    const complete = lessonComplete(lesson, states)
                    return (
                      <li key={lesson.id} className={`lesson ${complete ? 'complete' : ''} ${now?.id === lesson.id ? 'current' : ''}`}>
                        <div className="lesson-head">
                          <div>
                            <span className="lesson-title">{complete ? '✓ ' : now?.id === lesson.id ? '▶ ' : ''}{lesson.titleNl}</span>
                            <span className="lesson-goal">Je leert: {lesson.goalNl}</span>
                          </div>
                          <button type="button" className="btn small" onClick={() => onStartLesson(lesson.id)}>Oefen deze les</button>
                        </div>
                        <ul className="lesson-skills">
                          {lesson.skills.filter((id) => !/^MUL\.FACT\.T/.test(id)).map((id) => (
                            <li key={id}><span>{getSkill(id).titleNl}</span> <StageBadge stage={pathStage(store.skillState(id))} /></li>
                          ))}
                          {lesson.skills.some((id) => /^MUL\.FACT\.T/.test(id)) && <li><span>Tafels 1 t/m 10</span> <span className="muted small">(zie Tafels oefenen)</span></li>}
                        </ul>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
