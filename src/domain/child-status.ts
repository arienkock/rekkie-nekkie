/**
 * Child-facing practice-status text per skill (docs/adaptive-learning-design.md
 * §4.4: highest achievement plus a small freshness signal; "nog niet bekeken"
 * is distinct from "heeft hulp nodig" — no unexplained engine states).
 *
 * The engine's Freshness `'new'` means "no review schedule yet", NOT "never
 * practiced": scaffolded practice (S0/S1) leaves `reviewDueAt` null. Likewise
 * `'refresh'` means "memory was refreshed within the last day" (recently
 * practiced), not "needs refreshing". Deriving display text from
 * `exposureCount` *and* freshness keeps every row truthful and consistent:
 * unpracticed skills say so explicitly, practiced ones never do.
 */
import type { LearnerSkillState } from './types'

export function childStatusText(state: LearnerSkillState): string {
  if (state.exposureCount === 0) return 'nog niet geoefend'
  switch (state.memory.freshness) {
    case 'new':
      // Practiced, but nothing verified yet and no review schedule running.
      return 'aan het oefenen'
    case 'refresh':
      // deriveFreshness §2.3: refreshed within the last day — not due.
      return 'net geoefend'
    case 'fresh':
      return 'vers in je hoofd'
    case 'due':
      return 'even opfrissen?'
    default:
      return ''
  }
}