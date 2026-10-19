/**
 * Dynamic problem selector (docs/adaptive-learning-design.md §2.4).
 *
 * Session composition across a rolling window of ten fresh item starts:
 * ~5 growth, 3 review, 2 transfer/mixed. Growth targets .70–.80 predicted
 * success. Ranked by an interpretable score with seeded tie-breaks, and the
 * winning reason is stored for local explainability.
 */
import { getSkill } from '../domain/knowledge-graph'
import type { LearnerSkillState, PracticePurpose, SkillId } from '../domain/types'
import { memoryAvailability, predictCorrect } from './bkt'
import { reviewEligibility } from './memory'

export interface SelectorSkills {
  /** Skills that may be served in this session. */
  supported: SkillId[]
  states: Record<SkillId, LearnerSkillState>
  /** Skills that can be practised at all (have a generator). Prerequisites
   *  outside this set can never be demonstrated, so readiness looks through
   *  them to their practisable ancestors. Omitted: every skill counts. */
  practisable?: SkillId[]
}

/** A skill with this many independent successes in the last
 *  SATURATION_WINDOW_HOURS rests until a later visit: more of the same
 *  cannot satisfy the spacing gates, and it starves everything else. */
export const SATURATION_SUCCESSES = 4
export const SATURATION_WINDOW_HOURS = 12

export interface Candidate {
  skillId: SkillId
  purpose: PracticePurpose
  predictedCorrect: number
  ready: boolean
  overdueDays: number
  score: number
  scoreTerms: Record<string, number>
  reason: string
  explanationNl: string
}

/** Current availability r = p × R for selection/readiness. */
export function availableKnowledge(state: LearnerSkillState | undefined, now: Date): number {
  if (!state) return 0
  const R = memoryAvailability(
    state.memory.lastMemoryRefreshAt ? new Date(state.memory.lastMemoryRefreshAt) : null,
    state.memory.stabilityHalfLifeDays,
    now,
  )
  return state.masteryProbability * R
}

/**
 * Prerequisites as the learner can actually demonstrate them: a parent
 * without a generator is replaced by its own (recursively resolved)
 * prerequisites, so an unpractisable node never blocks its children forever.
 */
export function effectivePrerequisites(skillId: SkillId, practisable?: ReadonlySet<SkillId>): SkillId[] {
  if (!practisable) return getSkill(skillId).prerequisites
  const out = new Set<SkillId>()
  const visit = (id: SkillId) => {
    for (const p of getSkill(id).prerequisites) {
      if (practisable.has(p)) out.add(p)
      else visit(p)
    }
  }
  visit(skillId)
  return [...out]
}

/** Readiness: every effective parent at Level ≥ 1 with availability ≥ 0.55. */
export function isReady(
  skillId: SkillId,
  states: Record<SkillId, LearnerSkillState>,
  now: Date,
  practisable?: ReadonlySet<SkillId>,
): boolean {
  return effectivePrerequisites(skillId, practisable).every((p) => {
    const ps = states[p]
    if (!ps) return false
    return ps.currentVerifiedLevel >= 1 && availableKnowledge(ps, now) >= 0.55
  })
}

/** True when the skill has had enough independent success recently. */
export function isSaturated(state: LearnerSkillState | undefined, now: Date): boolean {
  if (!state) return false
  const since = now.getTime() - SATURATION_WINDOW_HOURS * 3_600_000
  const recent = state.independentGateWindow.filter((e) => e.correct && new Date(e.at).getTime() >= since)
  return recent.length >= SATURATION_SUCCESSES
}

export interface SelectionContext {
  skills: SelectorSkills
  /** Rolling window of the last 10 item purposes, oldest first. */
  recentPurposes: PracticePurpose[]
  /** Primary skills of the last few served items: soft anti-repetition
   *  window (docs §2.4 anti-starvation) — a climbing skill must not crowd
   *  out the rest of the session while it sits in the ZPD band. */
  recentSkillIds: SkillId[]
  now: Date
  intentSkill: SkillId | null
  /** Maatwerk after a practice test: favoured like a chosen skill. */
  focusSkills?: SkillId[]
}

export interface SelectionResult {
  skillId: SkillId
  purpose: PracticePurpose
  predictedCorrect: number
  reason: string
  explanationNl: string
  candidatesConsidered: number
}

export function selectNextSkill(ctx: SelectionContext, rand: () => number): SelectionResult | null {
  const { skills, recentPurposes, now } = ctx
  const eligible = skills.supported
  const practisable = skills.practisable ? new Set(skills.practisable) : undefined

  // --- Review pool: due reviews among supported skills ---
  const reviewCandidates: Candidate[] = []
  const growthCandidates: Candidate[] = []
  const transferCandidates: Candidate[] = []
  const teachFirstCandidates: Candidate[] = []
  /** Rested skills: used only when nothing else could be served at all
   *  (e.g. a session on one chosen table). */
  const restedCandidates: Candidate[] = []

  for (const id of eligible) {
    const state = skills.states[id]
    const tier = state ? state.scaffolding.currentTier : 'S0'
    const band = 'standard' as const
    const p = state ? state.masteryProbability : 0.2
    const R = state
      ? memoryAvailability(
          state.memory.lastMemoryRefreshAt ? new Date(state.memory.lastMemoryRefreshAt) : null,
          state.memory.stabilityHalfLifeDays,
          now,
        )
      : 1
    const predicted = predictCorrect(p, R, tier, band)
    const ready = isReady(id, skills.states, now, practisable)
    const saturated = isSaturated(state, now)
    // A refresh since the due date starts a cooldown (reviewNotBeforeAt): a
    // review inside it could never qualify, so it is not due for selection.
    const eligibility = state ? reviewEligibility(state.memory, now) : null
    const due = eligibility !== null && eligibility.due && eligibility.notBeforeArrived
    const gapSinceRefreshDays = eligibility?.gapSinceRefreshDays ?? 0
    const overdueDays = due ? Math.max(0, gapSinceRefreshDays - state!.memory.intervalDays) : 0

    if (state && due && state.currentVerifiedLevel >= 1) {
      reviewCandidates.push({
        skillId: id, purpose: 'review', predictedCorrect: predicted, ready, overdueDays,
        score: 0, scoreTerms: {}, reason: 'review-due',
        explanationNl: 'Je hebt dit een tijdje niet gebruikt. Even opfrissen!',
      })
    }
    // A saturated skill still gets due reviews, but no growth/teach-first slots.
    if (saturated) {
      if (state) {
        restedCandidates.push({
          skillId: id, purpose: 'growth', predictedCorrect: predicted, ready, overdueDays,
          score: 0, scoreTerms: {}, reason: 'zpd-growth', explanationNl: 'Nog een keer, omdat je dit gekozen hebt.',
        })
      }
      continue
    }
    // Readiness gates the *introduction* of a skill. Once introduced, it keeps
    // its growth slot even if a parent has not yet been verified: school
    // teaches it regardless, and without practice its support never fades.
    const introduced = state !== undefined && state.exposureCount > 0
    if ((ready || introduced) && state && state.currentVerifiedLevel < 3) {
      growthCandidates.push({
        skillId: id, purpose: 'growth', predictedCorrect: predicted, ready, overdueDays,
        score: 0, scoreTerms: {}, reason: 'zpd-growth',
        explanationNl: 'Hier kun je verder komen.',
      })
    }
    if (state && state.currentVerifiedLevel >= 2 && state.currentVerifiedLevel < 4) {
      transferCandidates.push({
        skillId: id, purpose: 'transfer', predictedCorrect: predicted, ready, overdueDays,
        score: 0, scoreTerms: {}, reason: 'transfer-gap',
        explanationNl: 'Kun je dit ook in een nieuw verhaal?',
      })
    }
    if (!ready || !state) {
      teachFirstCandidates.push({
        skillId: id, purpose: 'growth', predictedCorrect: predicted, ready, overdueDays,
        score: 0, scoreTerms: {}, reason: 'teach-first',
        explanationNl: 'Nieuw onderdeel: we bekijken het samen.',
      })
    }
  }

  // --- Session composition (soft quotas + anti-starvation) ---
  const last10 = recentPurposes.slice(-10)
  const reviewsDue = reviewCandidates.length > 0
  const reviewsInLast3 = last10.slice(-3).filter((x) => x === 'review').length
  const reviewRatio = last10.filter((x) => x === 'review').length

  let chosenPool = growthCandidates
  let purpose: PracticePurpose = 'growth'
  if (reviewsDue && reviewsInLast3 === 0 && reviewRatio < 4) {
    chosenPool = reviewCandidates
    purpose = 'review'
  } else {
    const growthCount = last10.filter((x) => x === 'growth' || x === 'diagnostic').length
    if (growthCount >= 5 && transferCandidates.length > 0 && last10.filter((x) => x === 'transfer').length < 2) {
      chosenPool = transferCandidates
      purpose = 'transfer'
    }
  }
  if (chosenPool.length === 0) {
    // Fallback with explicit pool priority (review > growth > transfer).
    chosenPool = [...reviewCandidates, ...growthCandidates, ...transferCandidates, ...teachFirstCandidates]
    if (chosenPool.length === 0) chosenPool = restedCandidates
    purpose =
      reviewCandidates.length > 0
        ? 'review'
        : growthCandidates.length > 0
          ? 'growth'
          : transferCandidates.length > 0
            ? 'transfer'
            : 'growth'
  }

  // --- Hard anti-starvation window: recently served skills are excluded
  // from the candidate pool entirely while alternatives exist — even in a
  // different pool — so a climbing (or sole-ready) skill can never monopolize
  // the session. Only when every candidate everywhere was just served do we
  // re-serve from the preferred pool.
  const allPools = [...reviewCandidates, ...growthCandidates, ...transferCandidates, ...teachFirstCandidates]
  const notRecent = chosenPool.filter((c) => !ctx.recentSkillIds.includes(c.skillId))
  let pool = notRecent
  if (pool.length === 0) {
    const anyFresh = allPools.filter((c) => !ctx.recentSkillIds.includes(c.skillId))
    pool = anyFresh.length > 0 ? anyFresh : chosenPool
  }
  // New skills always compete for growth slots; without them the skills
  // already introduced would cycle through the recency window forever.
  if (purpose === 'growth') {
    const inPool = new Set(pool.map((c) => c.skillId))
    pool = [...pool, ...teachFirstCandidates.filter((c) =>
      !inPool.has(c.skillId) && !ctx.recentSkillIds.includes(c.skillId))]
  }

  // --- ZPD scoring ---
  const zpdFit = (pred: number, purpose: PracticePurpose): number => {
    const target = purpose === 'review' ? 0.82 : purpose === 'transfer' ? 0.72 : 0.75
    const width = purpose === 'review' ? 0.125 : 0.125
    return Math.max(0, 1 - Math.abs(pred - target) / (width * 2))
  }

  const scored: Candidate[] = pool.map((c) => {
    const state = skills.states[c.skillId]
    // Evidence need decays with every item served (scaffolded, independent or
    // revealed): a skill the learner has practiced a lot needs less evidence
    // than a fresh one, so strong skills stop dominating selection. Counting
    // only meaningful opportunities let skills whose answers were revealed
    // look permanently fresh, and they were served again and again.
    const evidenceNeed = state ? 1 - Math.min(1, state.exposureCount / 8) : 1
    const learnerIntent = ctx.intentSkill === c.skillId ? 1 : 0.2
    // Maatwerk after a practice test outranks ordinary growth.
    const maatwerk = ctx.focusSkills?.includes(c.skillId) ? 1 : 0
    const reviewUrgency = Math.min(1, c.overdueDays / 7)
    const zpd = zpdFit(c.predictedCorrect, c.purpose)
    const terms = {
      zpd,
      reviewUrgency,
      evidenceNeed,
      learnerIntent,
      bundleContinuity: 0.5,
      maatwerk,
    }
    const score =
      0.3 * terms.zpd +
      0.25 * terms.reviewUrgency +
      0.2 * terms.evidenceNeed +
      0.15 * terms.learnerIntent +
      0.1 * terms.bundleContinuity +
      0.35 * terms.maatwerk
    return { ...c, score: score + rand() * 0.01, scoreTerms: terms }
  })

  if (scored.length === 0) return null

  // Growth band filter: if no growth candidate reaches .65, pick teach-first/S0.
  if (purpose === 'growth') {
    // Maatwerk is chosen because she just failed it: it never predicts "in band".
    const inBand = scored.filter((c) => (c.predictedCorrect >= 0.65 && c.predictedCorrect <= 0.85) || c.scoreTerms.maatwerk === 1)
    const bandPool = inBand.length > 0 ? inBand : scored
    bandPool.sort((a, b) => b.score - a.score)
    const best = bandPool[0]!
    if (best.predictedCorrect < 0.65) {
      return {
        skillId: best.skillId,
        purpose: 'growth',
        predictedCorrect: best.predictedCorrect,
        reason: 'teach-first',
        explanationNl: 'Nieuw of lastig: we doen het samen, stap voor stap.',
        candidatesConsidered: scored.length,
      }
    }
    return {
      skillId: best.skillId,
      purpose: best.purpose,
      predictedCorrect: best.predictedCorrect,
      reason: best.reason,
      explanationNl: best.explanationNl,
      candidatesConsidered: scored.length,
    }
  }

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]!
  return {
    skillId: best.skillId,
    purpose: best.purpose,
    predictedCorrect: best.predictedCorrect,
    reason: best.reason,
    explanationNl: best.explanationNl,
    candidatesConsidered: scored.length,
  }
}