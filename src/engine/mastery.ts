/**
 * Mastery level gates (docs/adaptive-learning-design.md §1.4).
 * A promotion evaluates the latest evidence; a demotion (lapse confirmation)
 * only lowers the *current verified* level and never the historical high.
 */
import type { LearnerSkillState } from '../domain/types'
import { delayedSeriesQualifies, hoursBetween } from './memory'

export interface GateResult {
  level: number
  met: boolean
  missing: string[]
}

function visitsSeparatedByHours(state: LearnerSkillState, hours: number): boolean {
  const ids = state.distinctVisitIds
  if (ids.length < 2) return false
  const window = state.independentGateWindow
  const perVisit = new Map<string, string[]>()
  for (const e of window) {
    const list = perVisit.get(e.visitId) ?? []
    list.push(e.at)
    perVisit.set(e.visitId, list)
  }
  const times = [...perVisit.values()].map((ats) => ats.map((a) => new Date(a)).sort((a, b) => a.getTime() - b.getTime()))
  for (let i = 0; i < times.length; i++) {
    for (let j = i + 1; j < times.length; j++) {
      const a = times[i]![times[i]!.length - 1]!
      const b = times[j]![0]!
      if (hoursBetween(a, b) >= hours) return true
      if (hoursBetween(b, a) >= hours) return true
    }
  }
  return false
}

function latestCorrectCount(window: LearnerSkillState['independentGateWindow'], n: number): number {
  const latest = window.slice(-n)
  return latest.filter((e) => e.correct).length
}

/**
 * Level 1 — Scaffolded Understanding.
 * ≥3 meaningful opportunities across ≥2 distinct items, ≥2 successful
 * learner-generated steps, one prediction before a reveal, p(L) ≥ .60.
 * Here meaningful opportunities are tracked as eligible opportunities and
 * distinct items via the exposure window; predictions count as the
 * scaffolded-success evidence class.
 */
function gateLevel1(state: LearnerSkillState): GateResult {
  const missing: string[] = []
  const window = state.independentGateWindow
  // Scaffolded successes + independent opportunities together represent
  // "meaningful opportunities across distinct items". Distinct items include
  // scaffolded ones (streakExerciseIds) so the gate is reachable through
  // supported work alone.
  const distinctItems = new Set([
    ...window.slice(-12).map((e) => e.exerciseId),
    ...state.scaffolding.streakExerciseIds,
  ])
  if (state.meaningfulOpportunityCount < 3) missing.push('opportunities')
  if (distinctItems.size < 2) missing.push('distinct-items')
  if (state.scaffoldedSuccessCount < 2 && state.independentSuccessCount < 2) missing.push('learner-generated-steps')
  if (state.masteryProbability < 0.6) missing.push('probability')
  return { level: 1, met: missing.length === 0, missing }
}

/**
 * Level 2 — Independent Competency.
 * p ≥ .85; ≥5 qualifying independent opportunities over ≥2 visits separated
 * by ≥12h; ≥4 of latest 5 correct; ≥2 representations (one symbolic where
 * appropriate); no unresolved repeated misconception.
 */
function gateLevel2(state: LearnerSkillState): GateResult {
  const missing: string[] = []
  const window = state.independentGateWindow
  if (state.masteryProbability < 0.85) missing.push('probability')
  if (state.independentOpportunityCount < 5) missing.push('opportunities')
  if (state.distinctVisitIds.length < 2 || !visitsSeparatedByHours(state, 12)) missing.push('visits-12h')
  if (window.length >= 5 && latestCorrectCount(window, 5) < 4) missing.push('recent-4-of-5')
  const representations = new Set(window.slice(-12).map((e) => e.representation))
  if (representations.size < 2) missing.push('representations')
  if (state.hasUnresolvedMisconception) missing.push('misconception')
  return { level: 2, met: missing.length === 0, missing }
}

/**
 * Level 3 — Mastered & Fluent.
 * p ≥ .93; ≥9 of latest 10 correct across ≥3 visits; ≥2 unassisted transfer
 * successes incl. one inverse; critical variation covered.
 */
function gateLevel3(state: LearnerSkillState): GateResult {
  const missing: string[] = []
  const window = state.independentGateWindow
  if (state.masteryProbability < 0.93) missing.push('probability')
  if (window.length < 10 || latestCorrectCount(window, 10) < 9) missing.push('9-of-10')
  if (state.distinctVisitIds.length < 3) missing.push('visits-3')
  if (state.transferSuccessCount < 2) missing.push('transfer')
  if (state.inverseSuccessCount < 1) missing.push('inverse')
  return { level: 3, met: missing.length === 0, missing }
}

/** Coverage of the KC's critical variation tags via the coverage counters. */
export function criticalVariationCovered(
  state: LearnerSkillState,
  requiredTags: string[],
): boolean {
  const succeeded = new Set(
    state.coverage.filter((c) => c.key.startsWith('variation:') && c.independentSuccesses > 0)
      .map((c) => c.key.slice('variation:'.length)),
  )
  return requiredTags.every((t) => succeeded.has(t))
}

/**
 * Level 4 — Retained. Requires established Level 3 plus a delayed series of
 * successful due independent reviews spanning ≥21 days with unrefreshed gaps
 * of ≥1, ≥7, ≥14 days.
 */
function gateLevel4(state: LearnerSkillState, now: Date): GateResult {
  const missing: string[] = []
  if (state.highestDemonstratedLevel < 3) missing.push('level-3')
  const first = state.memory.delayedSuccessSeriesStartedAt
    ? new Date(state.memory.delayedSuccessSeriesStartedAt)
    : null
  if (
    !first ||
    !delayedSeriesQualifies(state.memory.delayedSuccessGapsDays ?? [], first, now)
  ) {
    missing.push('delayed-series')
  }
  if (state.masteryProbability < 0.93) missing.push('probability')
  return { level: 4, met: missing.length === 0, missing }
}

/**
 * Evaluate promotion for the next level above the current verified level.
 * The highest fully satisfied gate wins (an established learner may skip L1).
 */
export function evaluatePromotion(
  state: LearnerSkillState,
  criticalTags: string[],
  now: Date,
): { newLevel: number; gate: GateResult | null } {
  const candidates: Array<(state: LearnerSkillState) => GateResult> = [gateLevel1, gateLevel2, gateLevel3]
  let best: GateResult | null = null
  for (const gate of candidates) {
    const result = gate(state)
    if (result.level > state.currentVerifiedLevel && result.met) {
      if (result.level === 3 && !criticalVariationCovered(state, criticalTags)) continue
      best = result
    }
  }
  // Level 4 needs a real spaced delayed series; grant it only when the
  // recorded gaps qualify (≥1, ≥7, ≥14 days spanning ≥21 days).
  if (best && best.level === 3) {
    const l4 = gateLevel4(state, now)
    if (l4.met) best = l4
  }
  const newLevel = best ? best.level : state.currentVerifiedLevel
  return { newLevel, gate: best }
}

/**
 * Reassessment: two independent failures among the latest three comparable
 * checks may lower the current verified level (confirmation handled by the
 * diagnostic layer). Elapsed time alone never decrements a level.
 */
export function confirmedLapse(state: LearnerSkillState): boolean {
  const latest3 = state.independentGateWindow.slice(-3)
  if (latest3.length < 3) return false
  const incorrect = latest3.filter((e) => !e.correct).length
  return incorrect >= 2 && state.currentVerifiedLevel > 0
}