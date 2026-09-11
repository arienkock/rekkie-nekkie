/**
 * ProgressView: the child-facing dashboard (docs/adaptive-learning-design.md
 * §4.4). Four theme islands; supported KCs expand per theme. Shows the highest
 * demonstrated achievement as stars plus a small freshness ring — a due skill
 * never becomes an empty star. No BKT percentages on the child view.
 */
import { useMemo, useState } from 'react'
import type { LearnerStore } from '../store/learner-store'
import { SUPPORTED_SKILLS } from '../generators'
import { KNOWLEDGE_GRAPH, THEME_META } from '../domain/knowledge-graph'
import { childStatusText } from '../domain/child-status'
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
      if (!SUPPORTED_SKILLS.includes(node.id)) continue
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
      <p className="muted">Eiland per thema. Tik op een eiland om de vaardigheden te zien.</p>
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
      <div className="kc-can">{can}</div>
    </li>
  )
}
