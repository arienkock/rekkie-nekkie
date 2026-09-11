import { describe, expect, it } from 'vitest'
import {
  applyLearningTransition,
  effectiveGuessSlip,
  memoryAvailability,
  predictCorrect,
  updateBelief,
} from '../bkt'

describe('BKT with forgetting-aware likelihoods (§2.2)', () => {
  it('reproduces the worked example from the design doc', () => {
    // p = .70, fresh memory, standard independent g = .10 / s = .10.
    const correct = updateBelief(0.7, 1, 'S2', 'standard', true, 1.0)
    expect(correct.posterior).toBeCloseTo(0.955, 3)
    const incorrect = updateBelief(0.7, 1, 'S2', 'standard', false, 1.0)
    expect(incorrect.posterior).toBeCloseTo(0.206, 3)
    // A meaningful intervention afterwards: .206 + .794 × .08 = .269.
    const after = applyLearningTransition(0.206, 0.08)
    expect(after).toBeCloseTo(0.2695, 3)
  })

  it('matches the reference prediction p=.95, R=.85 → P(correct) ≈ .746', () => {
    const p = 0.95 * 0.85 // r = p × R
    const { g, s } = effectiveGuessSlip('S2', 'standard')
    expect(g).toBeCloseTo(0.1, 4)
    expect(s).toBeCloseTo(0.1, 4)
    expect(p * (1 - s) + (1 - p) * g).toBeCloseTo(0.746, 3)
    expect(predictCorrect(0.95, 0.85, 'S2', 'standard')).toBeCloseTo(0.746, 3)
  })

  it('support tiers model task difficulty (S0 high guess, S3 higher slip)', () => {
    const s0 = effectiveGuessSlip('S0', 'standard')
    const s3 = effectiveGuessSlip('S3', 'standard')
    expect(s0.g).toBeCloseTo(0.55, 4)
    expect(s0.s).toBeCloseTo(0.03, 4)
    expect(s3.g).toBeCloseTo(0.06, 4)
    expect(s3.s).toBeCloseTo(0.15, 4)
  })

  it('difficulty bands shift g and s in the documented direction', () => {
    const easier = effectiveGuessSlip('S2', 'easier')
    const harder = effectiveGuessSlip('S2', 'harder')
    expect(easier.g).toBeGreaterThan(harder.g)
    expect(easier.s).toBeLessThan(harder.s)
  })

  it('zero-weight (revealed) responses leave the belief untouched', () => {
    const revealed = updateBelief(0.7, 1, 'S2', 'standard', true, 0)
    expect(revealed.posterior).toBe(0.7)
  })

  it('tempering (w < 1) softens the update', () => {
    const full = updateBelief(0.5, 1, 'S2', 'standard', true, 1.0)
    const tempered = updateBelief(0.5, 1, 'S2', 'standard', true, 0.35)
    expect(tempered.posterior).toBeGreaterThan(0.5)
    expect(tempered.posterior).toBeLessThan(full.posterior)
  })

  it('a long absence makes a failure less decisive about knowledge', () => {
    const fresh = updateBelief(0.9, 1, 'S2', 'standard', false, 1.0)
    const stale = updateBelief(0.9, 0.1, 'S2', 'standard', false, 1.0)
    // Forgetting-aware likelihood: low R → failure is more likely a refresh need.
    expect(stale.posterior).toBeGreaterThan(fresh.posterior)
  })

  it('memory availability decays as R = 2^(−Δ/S) and is 1 before exposure', () => {
    expect(memoryAvailability(null, 4.27, new Date())).toBe(1)
    const now = new Date('2024-09-01T12:00:00Z')
    const weekAgo = new Date('2024-08-25T12:00:00Z')
    const R = memoryAvailability(weekAgo, 4.265, now)
    expect(R).toBeGreaterThan(0)
    expect(R).toBeLessThan(0.35)
    expect(R).toBeCloseTo(0.322, 2)
  })
})
