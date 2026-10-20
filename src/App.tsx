/**
 * Rekkie Nekkie app shell: home ("Vandaag"), practice session, session
 * summary, and progress dashboard. All client-side; progress persists in
 * localStorage via the LearnerStore.
 */
import { useEffect, useRef, useState } from 'react'
import { useLearnerStore } from './hooks/use-learner-store'
import { useViewportFit } from './hooks/use-viewport-fit'
import { ExerciseView } from './components/ExerciseView'
import { ProgressView } from './components/ProgressView'
import { PathView } from './components/PathView'
import { DEFAULT_TABLES, TABLES } from './generators/multiplication-facts'
import { DEFAULT_BLOK_ID } from './store/learner-store'
import type { PracticeMode } from './store/learner-store'
import type { LearnerStore } from './store/learner-store'
import { LEARNING_PATH, currentLesson, lessonById } from './domain/learning-path'
import { getSkill } from './domain/knowledge-graph'

type View = 'home' | 'exercise' | 'progress' | 'path' | 'settings'

export default function App() {
  const store = useLearnerStore()
  const [view, setView] = useState<View>('home')
  const preferredTables = store.snapshot.preferences.selectedTables
  const [tables, setTables] = useState<number[]>(preferredTables ?? DEFAULT_TABLES)
  useEffect(() => setTables(preferredTables ?? DEFAULT_TABLES), [preferredTables])
  // Keep the visible layout in sync with browser chrome and the OSK.
  useViewportFit()

  // The "minder beweging" preference is a setting, not just an OS hint: mirror
  // it onto the document so the stylesheet can switch off entrances and
  // transitions the same way `prefers-reduced-motion` does. Every animated
  // state stays readable without its animation (docs §4.3).
  const reducedMotion = store.snapshot.preferences.reducedMotion
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false'
  }, [reducedMotion])

  const start = (mode: PracticeMode = store.practiceMode, options: { lessonId?: string; proeftoetsId?: string } = {}) => {
    if (store.currentSession && !window.confirm('Je sessie is nog niet klaar. Wil je een nieuwe sessie beginnen?')) return
    if (store.proeftoetsPaused && !window.confirm('Je proeftoets is nog niet klaar. Wil je toch iets anders beginnen?')) return
    const selection = mode === 'tables' && tables.length === 0 ? store.selectedTables : tables
    const again = mode === 'lesson' ? { lessonId: options.lessonId ?? store.lessonId ?? undefined }
      : mode === 'proeftoets' ? { proeftoetsId: options.proeftoetsId ?? store.proeftoets?.id }
      : {}
    store.startSession(mode, selection, again)
    setView('exercise')
  }

  /** Back to the open item, or on with the next group of a stopped proeftoets. */
  const resume = () => {
    if (store.proeftoetsPaused) store.nextExercise()
    setView('exercise')
  }

  const startTest = (proeftoetsId: string) =>
    store.proeftoetsPaused && store.proeftoets?.id === proeftoetsId ? resume() : start('proeftoets', { proeftoetsId })

  const blokId = store.snapshot.preferences.currentBlokId ?? DEFAULT_BLOK_ID
  const nowLesson = currentLesson(blokId, store.snapshot.skills)

  const toggleTable = (table: number) => {
    const selected = tables.includes(table) ? tables.filter((n) => n !== table) : [...tables, table].sort((a, b) => a - b)
    setTables(selected)
    store.savePreferences({ selectedTables: selected })
  }

  const nickname = store.snapshot.preferences.nickname ?? ''

  return (
    <div className="app">
      {store.saveFailed && (
        <div className="save-banner" role="alert">
          ⚠️ Opslaan lukt even niet. Je voortgang wordt pas bewaard als het weer lukt.
        </div>
      )}

      <header className="app-header">
        <h1>
          <span className="logo" aria-hidden>
            🧮
          </span>
          Rekkie Nekkie
        </h1>
        <p className="tagline">Rekenen · groep 5/6</p>
        <nav className="app-nav">
          {/* A running session lives under Vandaag, so the tab stays marked
              instead of leaving no tab current for the whole session. */}
          <button
            type="button"
            className="nav-link"
            aria-current={view === 'home' || view === 'exercise' ? 'page' : undefined}
            onClick={() => setView('home')}
          >
            Vandaag
          </button>
          <button type="button" className="nav-link" aria-current={view === 'path' ? 'page' : undefined} onClick={() => setView('path')}>
            Leerpad
          </button>
          <button type="button" className="nav-link" aria-current={view === 'progress' ? 'page' : undefined} onClick={() => setView('progress')}>
            Voortgang
          </button>
          <button type="button" className="nav-link" aria-current={view === 'settings' ? 'page' : undefined} onClick={() => setView('settings')}>
            Instellingen
          </button>
        </nav>
      </header>

      <main>
        {view === 'home' && (
          <section className="home">
            <div className="hero">
              <p className="greeting">
                {nickname ? `Hoi ${nickname}!` : 'Hoi!'}{' '}
                <span className="muted">Wat gaan we vandaag oefenen?</span>
              </p>
              {store.proeftoetsPaused && store.proeftoets && (
                <div className="resume-practice">
                  <p>Je was bezig met {store.proeftoets.titleNl}: opdracht {store.sessionItemsDone + 1} van {store.proeftoets.groups.length} is de volgende.</p>
                  <button type="button" className="btn primary" onClick={resume}>
                    ▶ Ga verder met de proeftoets
                  </button>
                </div>
              )}
              {store.currentSession && (
                <div className="resume-practice">
                  <p>Je bent bezig met {store.practiceMode === 'tables' ? `de tafels van ${store.selectedTables.join(', ')}`
                    : store.practiceMode === 'lesson' && store.lessonId ? lessonById(store.lessonId)?.titleNl
                    : store.practiceMode === 'proeftoets' ? store.proeftoets?.titleNl : 'rekenen'}.</p>
                  <button type="button" className="btn primary" onClick={() => setView('exercise')}>
                    ▶ Ga verder met je sessie
                  </button>
                </div>
              )}
              <div className="practice-choices">
                <section className="practice-choice">
                  <span className="practice-icon" aria-hidden>🧮</span>
                  <h2>Rekenen</h2>
                  <p>
                    Volgt de lessen van je rekenboek{nowLesson ? <>: nu <strong>{nowLesson.titleNl}</strong></> : ''}.
                    Eerst samen, dan zelf, dan zoals op de toets.
                  </p>
                  <button type="button" className="btn primary big" onClick={() => start('curriculum')}>
                    {store.currentSession ? 'Nieuwe rekensessie' : 'Oefen rekenen'}
                  </button>
                  <p className="muted">8 opgaven · ongeveer 5 minuten</p>
                </section>
                <section className="practice-choice">
                  <span className="practice-icon" aria-hidden>✖️</span>
                  <h2>Tafels oefenen</h2>
                  <p>Kies je tafels. Oefen met groepjes en rijen, en steeds meer uit je hoofd.</p>
                  <fieldset className="table-picker">
                    <legend>{store.currentSession ? 'Tafels voor een nieuwe sessie' : 'Welke tafels wil je oefenen?'}</legend>
                    <div className="table-options">
                      {TABLES.map((table) => (
                        <label key={table} className={`table-option ${tables.includes(table) ? 'selected' : ''}`}>
                          <input type="checkbox" checked={tables.includes(table)} onChange={() => toggleTable(table)} />
                          <span>{table}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {store.currentSession && <p className="muted">Je keuze geldt voor een nieuwe sessie. Ga verder om je huidige sessie af te maken.</p>}
                  {tables.length === 0 && <p className="muted">Kies minstens één tafel.</p>}
                  <button type="button" className="btn primary big" disabled={tables.length === 0} onClick={() => start('tables')}>
                    {store.currentSession ? 'Nieuwe tafelsessie' : 'Oefen tafels'}
                  </button>
                  <p className="muted">8 opgaven · op jouw niveau</p>
                </section>
              </div>
            </div>
            <HomeStats store={store} />
          </section>
        )}

        {view === 'exercise' &&
          (store.currentSession ? (
            <ExerciseView key={store.currentSession.id} store={store} />
          ) : (
            <SessionSummary store={store} onStart={() => start()} onResume={resume} onProgress={() => setView('path')} onHome={() => setView('home')} />
          ))}

        {view === 'progress' && <ProgressView store={store} />}

        {view === 'path' && (
          <PathView
            store={store}
            onStartLesson={(lessonId) => start('lesson', { lessonId })}
            onStartTest={startTest}
          />
        )}

        {view === 'settings' && <SettingsView store={store} />}
      </main>

      <footer className="app-footer">
        <p className="muted">Alles blijft op dit apparaat. Geen account, geen internet nodig.</p>
      </footer>
    </div>
  )
}

function SessionSummary({
  store,
  onStart,
  onResume,
  onProgress,
  onHome,
}: {
  store: LearnerStore
  onStart: () => void
  onResume: () => void
  onProgress: () => void
  onHome: () => void
}) {
  const results = store.sessionResults
  const made = results.filter((r) => !r.skipped).length
  const correct = results.filter((r) => r.correct).length
  const skipped = results.filter((r) => r.skipped).length
  const firsts = results.filter((r) => r.firstTimeSuccess)

  if (store.practiceMode === 'proeftoets' && store.proeftoets) {
    const passed = store.proeftoetsResults.filter((r) => r.passed).length
    const paused = store.proeftoetsPaused
    return (
      <section className="session-summary">
        <h2>{store.proeftoets.titleNl}: {paused ? 'gepauzeerd ⏸' : 'klaar! 📝'}</h2>
        {paused ? (
          <p>
            Je hebt <strong>{store.proeftoetsResults.length}</strong> van de <strong>{store.proeftoets.groups.length}</strong> opdrachten gemaakt.
            Ga verder wanneer je wilt: je begint bij opdracht {store.sessionItemsDone + 1}.
          </p>
        ) : (
          <p>
            <strong>{passed}</strong> van de <strong>{store.proeftoetsResults.length}</strong> opdrachten gehaald (80% goed per opdracht).
          </p>
        )}
        {store.proeftoetsResults.length > 0 && <table className="proeftoets-results">
          <thead><tr><th>Opdracht</th><th>Goed</th><th></th></tr></thead>
          <tbody>
            {store.proeftoetsResults.map((r, i) => (
              <tr key={i} className={r.passed ? 'passed' : 'not-passed'}>
                <td>{i + 1}. {getSkill(r.skillId).titleNl}</td>
                <td>{r.correct} van {r.total}</td>
                <td>{r.passed ? '✓' : `Maatwerk${r.maatwerkNl ? ` (boek ${r.maatwerkNl})` : ''}`}</td>
              </tr>
            ))}
          </tbody>
        </table>}
        {passed < store.proeftoetsResults.length && (
          <p className="muted">
            De opdrachten met maatwerk komen vaker terug bij Rekenen, tot je ze in toetsvorm goed hebt.
            {paused ? '' : ' Daarna: maak de proeftoets nog een keer.'}
          </p>
        )}
        <div className="btn-row">
          {paused && <button type="button" className="btn primary" onClick={onResume}>▶ Ga verder met de proeftoets</button>}
          <button type="button" className={`btn ${paused ? '' : 'primary'}`} onClick={onProgress}>Naar het leerpad</button>
          <button type="button" className="btn ghost" onClick={onHome}>Terug naar Vandaag</button>
        </div>
      </section>
    )
  }

  return (
    <section className="session-summary">
      <h2>Klaar voor vandaag! 🎉</h2>
      {made > 0 ? (
        <p>
          Je hebt <strong>{made}</strong> opgave{made === 1 ? '' : 'n'} gemaakt, waarvan{' '}
          <strong>{correct}</strong> in één keer goed
          {skipped > 0 ? ` (en ${skipped} overgeslagen)` : ''}.
        </p>
      ) : (
        <p className="muted">Je hebt deze sessie geen opgaven gemaakt. Dat is oké!</p>
      )}
      {firsts.length > 0 && (
        <p className="accomplishment">
          🌟 Nieuw geleerd: {firsts.map((r) => r.skillTitleNl).join(' en ')}
        </p>
      )}
      <p className={store.saveFailed ? 'save-warn' : 'muted'}>
        {store.saveFailed
          ? '⚠️ Je voortgang kon niet worden opgeslagen. Probeer later opnieuw.'
          : 'Je voortgang is opgeslagen.'}
      </p>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={onStart}>
          Nog een sessie
        </button>
        <button type="button" className="btn" onClick={onProgress}>
          Bekijk het leerpad
        </button>
        <button type="button" className="btn ghost" onClick={onHome}>
          Terug naar Vandaag
        </button>
      </div>
    </section>
  )
}

function HomeStats({ store }: { store: LearnerStore }) {
  const total = store.snapshot.totalExercisesCompleted
  const atLevel = Object.values(store.snapshot.skills).filter((s) => s.currentVerifiedLevel >= 1).length
  const skillCount = Object.keys(store.snapshot.skills).length
  // 'refresh' freshness means "memory refreshed within the last day"
  // (recently practiced) — only 'due' skills are actually ready for review.
  const dueNow = Object.values(store.snapshot.skills).filter(
    (s) => s.memory.freshness === 'due',
  ).length

  const stats = [
    { label: 'Opgaven gemaakt', value: total, emoji: '✏️' },
    { label: 'Vaardigheden geoefend', value: `${atLevel}/${skillCount}`, emoji: '⭐' },
    { label: 'Klaar om op te frissen', value: dueNow, emoji: '🔁' },
  ]

  return (
    <div className="stats-row">
      {stats.map((s) => (
        <div key={s.label} className="stat-card">
          <span className="stat-emoji" aria-hidden>
            {s.emoji}
          </span>
          <span className="stat-value">{s.value}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

/** A note about something that just happened. `seq` re-mounts it on every
 *  report so repeating an action visibly repeats its confirmation, and the
 *  tone distinguishes "done" from "that did not work" by icon *and* colour. */
interface Note {
  tone: 'ok' | 'warn'
  text: string
  seq: number
}

function StatusNote({ note }: { note: Note | null }) {
  return (
    <div className="note-slot" role="status" aria-live="polite">
      {note && (
        <p key={note.seq} className={`note note-${note.tone}`}>
          <span aria-hidden>{note.tone === 'ok' ? '✓' : '⚠️'}</span> {note.text}
        </p>
      )}
    </div>
  )
}

function SettingsView({ store }: { store: LearnerStore }) {
  const [nickname, setNickname] = useState(store.snapshot.preferences.nickname ?? '')
  const [importText, setImportText] = useState('')
  const [nameNote, setNameNote] = useState<Note | null>(null)
  const [dataNote, setDataNote] = useState<Note | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const saved = store.snapshot.preferences.nickname ?? ''
  // Pressing Opslaan used to change nothing on screen. Now the field says
  // whether what is typed matches what is stored, before and after saving.
  const unsavedName = nickname.trim() !== saved

  const report = (set: (n: Note) => void, tone: Note['tone'], text: string) =>
    set({ tone, text, seq: Date.now() })

  const save = () => {
    store.savePreferences({ nickname: nickname.trim() ? nickname.trim() : null })
    if (store.saveFailed) {
      report(setNameNote, 'warn', 'Opslaan lukte niet. Probeer het zo nog eens.')
    } else {
      report(setNameNote, 'ok', nickname.trim() ? `Opgeslagen als ${nickname.trim()}.` : 'Naam gewist.')
    }
  }

  const exportAll = () => {
    try {
      const blob = new Blob([store.exportJson()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rekkie-nekkie-voortgang.json'
      a.click()
      URL.revokeObjectURL(url)
      report(setDataNote, 'ok', 'Bestand rekkie-nekkie-voortgang.json gedownload.')
    } catch {
      report(setDataNote, 'warn', 'Exporteren lukte niet op dit apparaat.')
    }
  }

  const importFromText = (text: string) => {
    const ok = store.importJson(text)
    if (ok) {
      report(setDataNote, 'ok', 'Voortgang geladen. Je ziet hem terug bij Voortgang.')
      setNickname(store.snapshot.preferences.nickname ?? '')
    } else {
      report(setDataNote, 'warn', 'Dat bestand bevat geen geldige voortgang.')
    }
  }

  return (
    <section className="settings">
      <h2>Instellingen</h2>

      <div className="settings-card">
        <h3>Je naam</h3>
        <div className="answer-area">
          <input
            className="answer-input"
            type="text"
            value={nickname}
            placeholder="bijv. Noor"
            onChange={(e) => {
              setNickname(e.target.value)
              // The note describes what was saved; editing makes it history.
              setNameNote(null)
            }}
            aria-label="Je naam"
          />
          <button type="button" className="btn primary" onClick={save}>
            Opslaan
          </button>
          {unsavedName && <span className="pending-hint">Nog niet opgeslagen</span>}
        </div>
        <StatusNote note={nameNote} />
      </div>

      <div className="settings-card">
        <h3>Voortgang</h3>
        <p className="muted">
          Je voortgang blijft op dit apparaat bewaard. Je kunt hem meegeven naar een ander apparaat.
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={exportAll}>
            ⬇ Exporteren (bestand)
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ Importeren (bestand)
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            importFromText(await file.text())
            e.target.value = ''
          }}
        />
        <StatusNote note={dataNote} />
        <details>
          <summary>Of plak een exportcode</summary>
          <textarea
            className="import-textarea"
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value)
              setDataNote(null)
            }}
            rows={4}
            placeholder="Plak hier de JSON van een export…"
          />
          <button type="button" className="btn" onClick={() => importFromText(importText)}>
            Laden
          </button>
        </details>
      </div>

      <div className="settings-card">
        <h3>Welk blok heeft de klas nu?</h3>
        <p className="muted">Rekenen volgt de lessen van dit blok. Eerdere blokken komen terug als herhaling.</p>
        <div className="btn-row">
          {LEARNING_PATH.map((blok) => (
            <label key={blok.id} className="checkbox-row">
              <input
                type="radio"
                name="current-blok"
                checked={(store.snapshot.preferences.currentBlokId ?? DEFAULT_BLOK_ID) === blok.id}
                onChange={() => store.savePreferences({ currentBlokId: blok.id })}
              />
              {blok.titleNl}
            </label>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3>Beweging</h3>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={store.snapshot.preferences.reducedMotion}
            onChange={(e) => store.savePreferences({ reducedMotion: e.target.checked })}
          />
          Minder beweging en animaties
        </label>
      </div>
    </section>
  )
}