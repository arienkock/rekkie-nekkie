/**
 * BKT evidence engine with separate memory availability
 * (docs/adaptive-learning-design.md §2.2).
 *
 * Key invariants:
 *  - Stored p(L) is conceptual knowledge; availability r = p × R is derived,
 *    never persisted back as p.
 *  - Forgetting-aware likelihoods avoid double-counting memory decay.
 *  - Learning transitions apply p(T) at most once per KC/item episode and only
 *    after meaningful instruction with an active learner action.
 *  - Probabilities are clamped to [0.01, 0.99] in likelihood calculations.
 */
import type { DifficultyBand, ScaffoldTier } from '../domain/types'
import { P_MAX, P_MIN } from '../domain/types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const logit = (p: number) => Math.log(p / (1 - p))
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

/** Item difficulty bounded logit offsets (§2.2). */
export const DIFFICULTY_OFFSET: Record<DifficultyBand, number> = {
  easier: -0.6,
  standard: 0,
  harder: 0.6,
}

/** Initial (g, s) pairs per support tier S0..S3 (§2.2). */
export const TIER_GUESS_SLIP: Record<ScaffoldTier, { g: number; s: number }> = {
  S0: { g: 0.55, s: 0.03 },
  S1: { g: 0.30, s: 0.06 },
  S2: { g: 0.10, s: 0.10 },
  S3: { g: 0.06, s: 0.15 },
}

export function effectiveGuessSlip(
  tier: ScaffoldTier,
  band: DifficultyBand,
): { g: number; s: number } {
  const base = TIER_GUESS_SLIP[tier]
  const b = DIFFICULTY_OFFSET[band]
  const g = sigmoid(logit(clamp(base.g, P_MIN, P_MAX)) - b)
  const s = 1 - sigmoid(logit(clamp(1 - base.s, P_MIN, P_MAX)) - b)
  return { g, s }
}

/** Memory availability R = 2^(−Δ/S); R = 1 before the first exposure. */
export function memoryAvailability(lastMemoryRefreshAt: Date | null, stabilityDays: number, now: Date): number {
  if (!lastMemoryRefreshAt || stabilityDays <= 0) return 1
  const deltaDays = Math.max(0, (now.getTime() - lastMemoryRefreshAt.getTime()) / 86_400_000)
  return Math.pow(2, -deltaDays / stabilityDays)
}

/** Predicted first-attempt correctness of an isolated KC item (§2.2). */
export function predictCorrect(
  pL: number,
  availability: number,
  tier: ScaffoldTier,
  band: DifficultyBand,
): number {
  const { g, s } = effectiveGuessSlip(tier, band)
  const r = pL * availability
  return r * (1 - s) + (1 - r) * g
}

export interface ObservationUpdate {
  /** Posterior p(L) after the tempered Bayesian update. */
  posterior: number
  /** Prediction of correctness before the update (explanatory). */
  predictedCorrect: number
  /** The forgetting-aware likelihood components used. */
  likelihood: { g: number; s: number; r: number; a: number }
}

/**
 * Forgetting-aware BKT posterior for one observation (§2.2).
 *
 * a = R(1 − s) + (1 − R)g   (success likelihood given conceptual knowledge)
 * correct:   ℓL = a,  ℓU = g
 * incorrect: ℓL = 1−a, ℓU = 1−g
 * posterior = p·ℓL^w / (p·ℓL^w + (1−p)·ℓU^w)
 */
export function updateBelief(
  pL: number,
  availability: number,
  tier: ScaffoldTier,
  band: DifficultyBand,
  correct: boolean,
  weight: number,
): ObservationUpdate {
  const { g, s } = effectiveGuessSlip(tier, band)
  const r = pL * availability
  const predicted = r * (1 - s) + (1 - r) * g
  const a = availability * (1 - s) + (1 - availability) * g

  const p = clamp(pL, P_MIN, P_MAX)
  if (weight <= 0) return { posterior: pL, predictedCorrect: predicted, likelihood: { g, s, r, a } }

  const lL = Math.pow(clamp(correct ? a : 1 - a, P_MIN, 1), weight)
  const lU = Math.pow(clamp(correct ? g : 1 - g, P_MIN, P_MAX), weight)
  const posterior = clamp((p * lL) / (p * lL + (1 - p) * lU), P_MIN, P_MAX)
  return { posterior, predictedCorrect: predicted, likelihood: { g, s, r, a } }
}

/**
 * Meaningful learning transition (at most once per KC/item episode):
 * p(next) = posterior + (1 − posterior) × p(T).
 */
export function applyLearningTransition(posterior: number, pT: number): number {
  return clamp(posterior + (1 - posterior) * pT, P_MIN, P_MAX)
}