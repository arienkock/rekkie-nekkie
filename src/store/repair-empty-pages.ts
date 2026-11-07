/**
 * One-off repair: test pages handed in completely empty.
 *
 * Before November 2026 a practice test page could be checked with nothing
 * filled in ("Toch nakijken"). The usage export showed her doing that to get
 * past pages of tables she knows: 0 of 6, counted as a failed test, which
 * lowered the table's score and its level. Such a page was never an attempt,
 * so its observation is voided (`voidedReason`) and the skill state is put
 * back as if the page had been skipped.
 *
 * The repair is exact where the saved history allows it and conservative
 * where it does not:
 *  - Belief is replayed from just before the first empty page. Every later
 *    real observation keeps its own recorded effect (its odds ratio), so no
 *    memory or timing data is needed: removing a failure never changes memory
 *    refreshes, which only successes and due reviews make.
 *  - Counters, coverage and the scaffold's failure count drop the voided
 *    attempts; the gate window loses them and is refilled with the earlier
 *    real attempts they had pushed out.
 *  - The level is re-evaluated with the normal promotion rules.
 *  - A skill whose saved belief does not match its history is left alone.
 * Only empty pages are touched: a page with one answer filled in stays a
 * real (failed) test. Proeftoets pages and due reviews are never voided.
 */
import type { UsageData } from '../analytics/types'
import type { GateWindowEntry, LearnerSkillState, LearningTransitionEvent, SkillObservation } from '../domain/types'
import { P_MAX, P_MIN } from '../domain/types'
import { applyLearningTransition } from '../engine/bkt'
import { evaluatePromotion } from '../engine/mastery'

export const EMPTY_PAGE_VOID = 'empty-test-page'
const GATE_WINDOW_MAX = 12

/** Finished practice test pages on which every line was only ever submitted blank. */
export function emptyTestPageIds(usage: UsageData | undefined): Set<string> {
  const ids = new Set<string>()
  for (const e of usage?.exercises ?? []) {
    if (e.format !== 'block' || e.end !== 'completed' || e.mode === 'proeftoets' || e.steps.length === 0) continue
    if (e.steps.every((s) => s.submissions > 0 && s.blankSubmissions === s.submissions)) ids.add(e.exerciseId)
  }
  return ids
}

const clamp = (p: number) => Math.min(P_MAX, Math.max(P_MIN, p))
const odds = (p: number) => p / (1 - p)
const fromOdds = (o: number) => o / (1 + o)

const isEligible = (o: SkillObservation) => o.eligibility.weight > 0 && o.eligibility.attributable
const isIndependent = (o: SkillObservation) => isEligible(o) && o.eligibility.independent

function gateEntry(o: SkillObservation): GateWindowEntry {
  return {
    exerciseId: o.exerciseId,
    visitId: o.visitId,
    at: o.observedAt,
    correct: o.outcome === 'correct',
    transfer: o.isTransfer,
    inverse: o.isInverse,
    efficientStrategy: o.efficientStrategyObserved,
    representation: o.representation,
    variationTags: [...o.variationTags],
  }
}

/**
 * Belief after the history from `history[start]` on, skipping voided
 * observations. Each kept observation applies its own recorded effect.
 */
function replayBelief(
  history: SkillObservation[],
  start: number,
  voided: (o: SkillObservation) => boolean,
  transitions: LearningTransitionEvent[],
  pT: number,
): number {
  let belief = history[start]!.beliefBefore
  for (const o of history.slice(start)) {
    if (voided(o)) continue
    const t = transitions.find((x) => x.exerciseId === o.exerciseId && x.skillId === o.skillId)
    const recordedPost = t ? t.beliefBefore : o.beliefAfter
    let post: number
    if (recordedPost >= P_MAX - 1e-12) {
      // Clamped at the top: a higher starting belief ends there too.
      post = P_MAX
    } else {
      const ratio = odds(clamp(recordedPost)) / odds(clamp(o.beliefBefore))
      post = clamp(fromOdds(odds(clamp(belief)) * ratio))
    }
    belief = Math.min(t ? applyLearningTransition(post, pT) : post, P_MAX)
  }
  return belief
}

export interface RepairInput {
  skills: Record<string, LearnerSkillState>
  observations: SkillObservation[]
  learningTransitions: LearningTransitionEvent[]
  usage?: UsageData
}

/**
 * Void observations of empty test pages and repair their skills in place.
 * Returns the repaired skill ids (empty when there was nothing to do, so
 * running it again is a no-op).
 */
export function voidEmptyTestPages(
  data: RepairInput,
  criticalTags: (skillId: string) => string[],
  now: Date,
): string[] {
  const pageIds = emptyTestPageIds(data.usage)
  if (pageIds.size === 0) return []
  const candidates = data.observations.filter((o) =>
    pageIds.has(o.exerciseId) && o.voidedReason === null && o.outcome === 'incorrect'
      && !o.wasDueReview && isEligible(o))
  const bySkill = new Map<string, SkillObservation[]>()
  for (const o of candidates) bySkill.set(o.skillId, [...(bySkill.get(o.skillId) ?? []), o])

  const repaired: string[] = []
  for (const [skillId, newlyVoided] of bySkill) {
    const state = data.skills[skillId]
    if (!state) continue
    const history = data.observations.filter((o) => o.skillId === skillId)
    const last = history[history.length - 1]!
    // Only repair a state that is exactly what its saved history produced.
    if (Math.abs(last.beliefAfter - state.masteryProbability) > 1e-9) continue
    const voidSet = new Set(newlyVoided)
    const isVoided = (o: SkillObservation) => voidSet.has(o) || o.voidedReason !== null
    const start = history.findIndex((o) => voidSet.has(o))

    state.masteryProbability = replayBelief(history, start, isVoided, data.learningTransitions, state.bkt.pT)

    let independentVoided = 0
    for (const o of newlyVoided) {
      o.voidedReason = EMPTY_PAGE_VOID
      state.exposureCount = Math.max(0, state.exposureCount - 1)
      state.meaningfulOpportunityCount = Math.max(0, state.meaningfulOpportunityCount - 1)
      if (!isIndependent(o)) continue
      independentVoided += 1
      state.independentOpportunityCount = Math.max(0, state.independentOpportunityCount - 1)
      const keys = [...o.variationTags.map((t) => `variation:${t}`), `representation:${o.representation}`]
      for (const key of keys) {
        const c = state.coverage.find((x) => x.key === key)
        if (c) c.opportunities = Math.max(c.independentSuccesses, c.opportunities - 1)
      }
    }
    // A variation only an empty page "covered" was never covered.
    state.coverage = state.coverage.filter((c) => c.opportunities > 0)
    state.scaffolding.recentComparableFailures = Math.max(0, state.scaffolding.recentComparableFailures - independentVoided)

    // Gate window: drop the empty pages, refill with the real attempts
    // they had pushed out of the latest twelve.
    const voidedIds = new Set(newlyVoided.map((o) => o.exerciseId))
    const window = state.independentGateWindow.filter((e) => !voidedIds.has(e.exerciseId))
    const inWindow = new Set(window.map((e) => e.exerciseId))
    const firstAt = window[0]?.at ?? null
    const older = history.filter((o) => isIndependent(o) && !isVoided(o) && !inWindow.has(o.exerciseId)
      && (firstAt === null || o.observedAt <= firstAt))
    const refill = older.slice(Math.max(0, older.length - (GATE_WINDOW_MAX - window.length))).map(gateEntry)
    state.independentGateWindow = [...refill, ...window].slice(-GATE_WINDOW_MAX)

    // The level, with the normal promotion rules on the repaired evidence.
    const { newLevel } = evaluatePromotion(state, criticalTags(skillId), now)
    if (newLevel > state.currentVerifiedLevel) {
      state.currentVerifiedLevel = newLevel as LearnerSkillState['currentVerifiedLevel']
      state.highestDemonstratedLevel = Math.max(state.highestDemonstratedLevel, newLevel) as LearnerSkillState['highestDemonstratedLevel']
    }
    state.revision += 1
    state.lastUpdatedAt = now.toISOString()
    repaired.push(skillId)
  }
  return repaired
}
