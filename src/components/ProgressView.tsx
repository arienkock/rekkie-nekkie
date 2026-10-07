/**
 * ProgressView: the child-facing dashboard (docs/adaptive-learning-design.md
 * §4.4). Four theme islands; supported KCs expand per theme. Shows the highest
 * demonstrated achievement as stars, next-gate evidence progress, and a small
 * freshness signal — a due skill never becomes an empty star. No BKT percentages
 * on the child view.
 */
import { useMemo, useState } from 'react'
import type { LearnerStore } from '../store/learner-store'
import { TABLES, isTableSkill } from '../generators/multiplication-facts'
import { SUPPORTED_SKILLS } from '../generators'
import { KNOWLEDGE_GRAPH, THEME_META } from '../domain/knowledge-graph'
import { childStatusText, masteryProgress } from '../domain/child-status'
import type { SkillId, ThemeId } from '../domain/types'

export function ProgressView({ store }: { store: LearnerStore }) {
  const byTheme = useMemo(() => {
    // A shared KC (e.g. place value) belongs to several themes; it gets one
    // canonical island and a "bridge" row in the others (docs §4.4), so it
    // never appears as confusing duplicate rows everywhere.
    const grouped: Record<ThemeId, { primary: typeof KNOWLEDGE_GRAPH; bridges: Array<{ node: (typeof KNOWLEDGE_GRAPH)[number]; canonical: ThemeId }> }> = {
      'optellen-aftrekken': { primary: [], bridges: [] },
      meten: { primary: [], bridges: [] },
      'vermenigvuldigen-delen': { primary: [], bridges: [] },
      'tijd-geld': { primary: [], bridges: [] },
    }
    for (const node of KNOWLEDGE_GRAPH) {
      if (!SUPPORTED_SKILLS.includes(node.id) || isTableSkill(node.id)) continue
      const canonical = node.themes[0]!
      grouped[canonical].primary.push(node)
      for (const theme of node.themes.slice(1)) {
        grouped[theme].bridges.push({ node, canonical })
      }
    }
    return grouped
  }, [])

  const [expanded, setExpanded] = useState<ThemeId | null>('optellen-aftrekken')

  return (
    <div className="progress-view">
      <h2>Voortgang</h2>
      <p className="muted">
        Eiland per thema. Tik op een eiland om de vaardigheden te zien. Balkjes tonen één oefendoel voor de volgende ster;
        een ster vraagt ook om goede antwoorden, variatie en soms oefenen op andere dagen.
      </p>
      <div className="islands">
        {(Object.keys(THEME_META) as ThemeId[]).map((theme) => {
          const { primary, bridges } = byTheme[theme]
          const earned = primary.filter((n) => store.skillState(n.id).currentVerifiedLevel >= 1).length
          return (
            <section key={theme} className={`island ${expanded === theme ? 'expanded' : ''}`}>
              <button
                type="button"
                className="island-header"
                onClick={() => setExpanded(expanded === theme ? null : theme)}
                aria-expanded={expanded === theme}
              >
                <span className="island-emoji">{THEME_META[theme].emoji}</span>
                <span className="island-title">{THEME_META[theme].titleNl}</span>
                <span className="island-count">
                  {earned}/{primary.length}
                </span>
                {/* Open/closed was only in aria-expanded: nothing on screen
                    said whether tapping would open or close the island. */}
                <span className="island-chevron" aria-hidden>
                  {expanded === theme ? '▾' : '▸'}
                </span>
              </button>
              {expanded === theme && (
                <ul className="constellation">
                  {primary.map((node) => (
                    <SkillRow key={node.id} store={store} skillId={node.id} title={node.titleNl} can={node.learnerCanNl} />
                  ))}
                  {bridges.map(({ node, canonical }) => (
                    <li key={`bridge-${node.id}`} className="bridge-row">
                      <button type="button" onClick={() => setExpanded(canonical)}>
                        🔗 {node.titleNl} — zie bij {THEME_META[canonical].titleNl}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      <section className="settings-card">
        <h3>Tafels oefenen</h3>
        <p className="muted">Je tafels hebben hun eigen voortgang. Bij elke tafel oefenen we alle sommen van 1 tot en met 10.</p>
        <ul className="constellation">
          {TABLES.map((n) => <SkillRow key={n} store={store} skillId={`MUL.FACT.T${n}`}
            title={`Tafel van ${n}`} can={`Ik ken de tafel van ${n}, ook als een factor ontbreekt.`} />)}
        </ul>
      </section>
    </div>
  )
}

function SkillRow({
  store,
  skillId,
  title,
  can,
}: {
  store: LearnerStore
  skillId: SkillId
  title: string
  can: string
}) {
  const state = store.skillState(skillId)
  const level = state.currentVerifiedLevel
  const highest = state.highestDemonstratedLevel
  // Truthful per-row status: 'nog niet geoefend' only when never practiced,
  // and recently-practiced ('refresh') is never shown as due.
  const status = childStatusText(state)
  const isDue = state.memory.freshness === 'due'
  const progress = masteryProgress(state)

  return (
    <li className={`kc-row ${isDue ? 'due' : ''}`}>
      <div className="kc-main">
        <span className="kc-title">{title}</span>
        <span className="kc-stars" aria-label={`Niveau ${level} van 4`}>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`star ${n <= level ? 'full' : n <= highest ? 'half' : ''}`}>
              {n <= level ? '★' : n <= highest ? '☆' : '·'}
            </span>
          ))}
        </span>
        {status && <span className="kc-fresh">{status}</span>}
      </div>
      {progress && (
        <div
          className="kc-mastery-progress"
          role="progressbar"
          aria-label={progress.label}
          aria-valuemin={0}
          aria-valuemax={progress.target}
          aria-valuenow={progress.value}
          aria-valuetext={progress.valueText}
        >
          <span className="kc-mastery-progress-label" aria-hidden="true">{progress.label}</span>
          <span className="kc-mastery-progress-count" aria-hidden="true">{progress.valueText}</span>
          <span
            className="kc-mastery-progress-track"
            style={{ gridTemplateColumns: `repeat(${progress.target}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {Array.from({ length: progress.target }, (_, i) => (
              <span key={i} className={`kc-mastery-progress-step ${i < progress.value ? 'filled' : ''}`} />
            ))}
          </span>
        </div>
      )}
      <div className="kc-can">{can}</div>
    </li>
  )
}
