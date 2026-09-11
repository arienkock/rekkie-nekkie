/**
 * Rekkie Nekkie app shell: home ("Vandaag"), practice session, session
 * summary, and progress dashboard. All client-side; progress persists in
 * localStorage via the LearnerStore.
 */
import { useRef, useState } from 'react'
import { useLearnerStore } from './hooks/use-learner-store'
import { ExerciseView } from './components/ExerciseView'
import { ProgressView } from './components/ProgressView'
import type { LearnerStore } from './store/learner-store'

type View = 'home' | 'exercise' | 'progress' | 'settings'

export default function App() {
  const store = useLearnerStore()
  const [view, setView] = useState<View>('home')

  const start = () => {
    store.startSession()
    setView('exercise')
  }

  const restart = () => {
    if (
      store.currentSession &&
      !window.confirm('Je sessie is nog niet klaar. Weet je zeker dat je opnieuw wilt beginnen?')
    ) {
      return
    }
    start()
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
          <button type="button" className="nav-link" aria-current={view === 'home' ? 'page' : undefined} onClick={() => setView('home')}>
            Vandaag
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
              {store.currentSession ? (
                <div className="btn-row">
                  <button type="button" className="btn primary big" onClick={() => setView('exercise')}>
                    ▶ Ga verder met je sessie
                  </button>
                  <button type="button" className="btn ghost" onClick={restart}>
                    Opnieuw beginnen
                  </button>
                </div>
              ) : (
                <button type="button" className="btn primary big" onClick={start}>
                  Start oefensessie
                </button>
              )}
              <p className="muted">
                Iets vertrouwds, iets nieuws en een puzzel — ongeveer 5 minuten.
              </p>
            </div>
            <HomeStats store={store} />
          </section>
        )}

        {view === 'exercise' &&
          (store.currentSession ? (
            <ExerciseView key={store.currentSession.id} store={store} />
          ) : (
            <SessionSummary store={store} onStart={start} onProgress={() => setView('progress')} onHome={() => setView('home')} />
          ))}

        {view === 'progress' && <ProgressView store={store} />}

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
  onProgress,
  onHome,
}: {
  store: LearnerStore
  onStart: () => void
  onProgress: () => void
  onHome: () => void
}) {
  const results = store.sessionResults
  const made = results.filter((r) => !r.skipped).length
  const correct = results.filter((r) => r.correct).length
  const skipped = results.filter((r) => r.skipped).length
  const firsts = results.filter((r) => r.firstTimeSuccess)

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
          Bekijk je voortgang
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
  const dueNow = Object.values(store.snapshot.skills).filter(
    (s) => s.memory.freshness === 'due' || s.memory.freshness === 'refresh',
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

function SettingsView({ store }: { store: LearnerStore }) {
  const [nickname, setNickname] = useState(store.snapshot.preferences.nickname ?? '')
  const [importText, setImportText] = useState('')
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const save = () => {
    store.savePreferences({ nickname: nickname.trim() ? nickname.trim() : null })
  }

  const exportAll = () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rekkie-nekkie-voortgang.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFromText = (text: string) => {
    const ok = store.importJson(text)
    setImportStatus(ok ? 'Voortgang geladen ✓' : 'Dat bestand bevat geen geldige voortgang.')
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
            onChange={(e) => setNickname(e.target.value)}
            aria-label="Je naam"
          />
          <button type="button" className="btn primary" onClick={save}>
            Opslaan
          </button>
        </div>
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
        {importStatus && <p className="import-status">{importStatus}</p>}
        <details>
          <summary>Of plak een exportcode</summary>
          <textarea
            className="import-textarea"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={4}
            placeholder="Plak hier de JSON van een export…"
          />
          <button type="button" className="btn" onClick={() => importFromText(importText)}>
            Laden
          </button>
        </details>
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