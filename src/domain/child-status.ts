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

export interface MasteryProgress {
  /** Short label for the next evidence milestone, not an overall mastery score. */
  label: string
  value: number
  target: number
  valueText: string
}

/**
 * One visible evidence count toward the next verified level. Other gate
 * conditions still apply; these counts are deliberately not called a mastery
 * percentage.
 */
export function masteryProgress(state: LearnerSkillState): MasteryProgress | null {
  switch (state.currentVerifiedLevel) {
    case 0: {
      const target = 3
      const value = Math.min(state.meaningfulOpportunityCount, target)
      return { label: 'Eerste ster · oefenmomenten', value, target, valueText: `${value} van ${target} oefenmomenten (goed of fout)` }
    }
    case 1: {
      const target = 5
      const value = Math.min(state.independentOpportunityCount, target)
      return { label: 'Zelfstandig · oefenmomenten', value, target, valueText: `${value} van ${target} zelfstandige oefenmomenten (goed of fout)` }
    }
    case 2: {
      const target = 10
      const latest = state.independentGateWindow.slice(-target)
      const value = latest.length
      const correct = latest.filter((e) => e.correct).length
      const valueText = value < target
        ? `${value} van ${target} oefenkansen; daarna minstens 9 goed`
        : `${value} van ${target} oefenkansen; ${correct} goed, minstens 9 nodig`
      return { label: 'Vlot · oefenkansen', value, target, valueText }
    }
    case 3: {
      const target = 3
      const value = Math.min(state.memory.delayedSuccessCount, target)
      return { label: 'Onthouden · opfrisbeurten', value, target, valueText: `${value} van ${target} gespreide opfrisbeurten` }
    }
    default:
      return null
  }
}

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

export type PathStage = 'nieuw' | 'met-hulp' | 'zelf' | 'toetsvorm' | 'onthouden'

export const STAGE_LABELS: Record<PathStage, string> = {
  nieuw: 'nog niet geoefend',
  'met-hulp': 'met hulp',
  zelf: 'zelf',
  toetsvorm: 'toetsvorm',
  onthouden: 'na een week nog',
}

/**
 * Where a skill stands on the way to the test (docs/test-readiness-plan.md
 * §G): practised with help, on her own, in test format, and still in test
 * format after at least a week.
 */
export function pathStage(state: LearnerSkillState): PathStage {
  if (state.exposureCount === 0) return 'nieuw'
  const toetsvorm = state.coverage.some((c) => c.key === 'variation:toetsvorm' && c.independentSuccesses > 0)
  if (toetsvorm && (state.memory.delayedSuccessGapsDays ?? []).some((g) => g >= 7)) return 'onthouden'
  if (toetsvorm) return 'toetsvorm'
  if (state.independentSuccessCount > 0) return 'zelf'
  return 'met-hulp'
}
