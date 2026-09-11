import { describe, expect, it } from 'vitest'
import type { LearnerSkillState } from '../../domain/types'
import { EVIDENCE_WEIGHTS } from '../../domain/types'
import { applyObservationToSkill, newSkillState } from '../evidence'
import { confirmedLapse, evaluatePromotion } from '../mastery'

function independentCorrect(visitId: string, exerciseId: string, at: Date, extra: Partial<Parameters<typeof applyObservationToSkill>[1]> = {}) {
  return (state: LearnerSkillState) =>
    applyObservationToSkill(state, {
      skillId: state.skillId,
      exerciseId,
      visitId,
      outcome: 'correct',
      eligibility: {
        independent: true,
        firstCommittedResponse: true,
        attributable: true,
        answerRevealed: false,
        weight: EVIDENCE_WEIGHTS.independent,
      },
      scaffold: 'S2',
      representation: 'symbolic',
      difficultyBand: 'standard',
      variationTags: ['ten-bridge'],
      isInverse: false,
      isTransfer: false,
      efficientStrategyObserved: true,
      activeTimeMs: 30_000,
      now: at,
      withLearningTransition: false,
      wasDueReview: false,
      ...extra,
    }).state
}

describe('evidence reducer', () => {
  it('repeating one revealed item never establishes competency', () => {
    let state = newSkillState('ADD.COLUMN.Carry')
    const at = new Date('2024-09-01T10:00:00Z')
    for (let i = 0; i < 100; i++) {
      state = applyObservationToSkill(state, {
        skillId: state.skillId,
        exerciseId: 'same-item',
        visitId: 'v1',
        outcome: 'correct',
        eligibility: {
          independent: false,
          firstCommittedResponse: true,
          attributable: true,
          answerRevealed: true,
          weight: EVIDENCE_WEIGHTS.revealed,
        },
        scaffold: 'S0',
        representation: 'pictorial',
        difficultyBand: 'standard',
        variationTags: [],
        isInverse: false,
        isTransfer: false,
        efficientStrategyObserved: false,
        activeTimeMs: 10_000,
        now: at,
        withLearningTransition: false,
        wasDueReview: false,
      }).state
    }
    expect(state.independentOpportunityCount).toBe(0)
    expect(state.masteryProbability).toBeCloseTo(0.2, 5)
    const { newLevel } = evaluatePromotion(state, [], at)
    expect(newLevel).toBe(0)
  })

  it('scaffolded predictions contribute low-weight evidence only', () => {
    let state = newSkillState('PV.DHTE.Decompose')
    state = applyObservationToSkill(state, {
      skillId: state.skillId,
      exerciseId: 'e1',
      visitId: 'v1',
      outcome: 'correct',
      eligibility: {
        independent: false,
        firstCommittedResponse: true,
        attributable: true,
        answerRevealed: false,
        weight: EVIDENCE_WEIGHTS.scaffoldedPrediction,
      },
      scaffold: 'S0',
      representation: 'pictorial',
      difficultyBand: 'standard',
      variationTags: ['zero-position'],
      isInverse: false,
      isTransfer: false,
      efficientStrategyObserved: false,
      activeTimeMs: 30_000,
      now: new Date('2024-09-01T10:00:00Z'),
      withLearningTransition: true,
      wasDueReview: false,
    }).state
    // p rises from .20 via tempered posterior + p(T), but not to mastery.
    expect(state.masteryProbability).toBeGreaterThan(0.2)
    expect(state.masteryProbability).toBeLessThan(0.5)
    expect(state.meaningfulOpportunityCount).toBe(1)
    expect(state.scaffoldedSuccessCount).toBe(1)
  })

  it('one item contributes one observation update per KC', () => {
    let state = newSkillState('TIME.READ.DutchHalfNextHour')
    const before = state.independentOpportunityCount
    state = independentCorrect('v1', 'e1', new Date('2024-09-01T10:00:00Z'))(state)
    state = independentCorrect('v1', 'e1', new Date('2024-09-01T10:05:00Z'))(state)
    // The reducer is called once per KC/item by contract; a second identical
    // call still counts. The STORE enforces the one-per-KC rule.
    expect(state.independentOpportunityCount).toBe(before + 2)
  })

  it('gate window stays bounded at 12 entries', () => {
    let state = newSkillState('MEAS.RULER.Offset')
    for (let i = 0; i < 20; i++) {
      state = independentCorrect('v1', `e${i}`, new Date('2024-09-01T10:00:00Z'))(state)
    }
    expect(state.independentGateWindow.length).toBeLessThanOrEqual(12)
  })

  it('Level 2 promotion requires visits separated by 12h', () => {
    let state = newSkillState('MEAS.RULER.Offset')
    // 6 independent successes in a single visit: p rises but gate blocks L2.
    for (let i = 0; i < 6; i++) {
      state = independentCorrect('v1', `e${i}`, new Date('2024-09-01T10:00:00Z'))(state)
    }
    const sameDay = evaluatePromotion(state, [], new Date('2024-09-01T20:00:00Z'))
    expect(sameDay.newLevel).toBeLessThan(2)

    // Two more visits on later days unlock the gate.
    state = independentCorrect('v2', 'e10', new Date('2024-09-02T10:00:00Z'))(state)
    state = independentCorrect('v3', 'e11', new Date('2024-09-03T10:00:00Z'))(state)
    state = independentCorrect('v3', 'e12', new Date('2024-09-03T11:00:00Z'), {
      representation: 'pictorial',
    })(state)
    const promoted = evaluatePromotion(state, [], new Date('2024-09-03T12:00:00Z'))
    expect(promoted.newLevel).toBe(2)
  })

  it('a single mistake does not erase a level', () => {
    let state = newSkillState('MEAS.RULER.Offset')
    for (let i = 0; i < 6; i++) {
      state = independentCorrect(`v${i}`, `e${i}`, new Date(`2024-09-0${i + 1}T10:00:00Z`))(state)
    }
    state = applyObservationToSkill(state, {
      skillId: state.skillId,
      exerciseId: 'e-wrong',
      visitId: 'v9',
      outcome: 'incorrect',
      eligibility: {
        independent: true,
        firstCommittedResponse: true,
        attributable: true,
        answerRevealed: false,
        weight: EVIDENCE_WEIGHTS.independent,
      },
      scaffold: 'S2',
      representation: 'symbolic',
      difficultyBand: 'standard',
      variationTags: [],
      isInverse: false,
      isTransfer: false,
      efficientStrategyObserved: false,
      activeTimeMs: 30_000,
      now: new Date('2024-09-20T10:00:00Z'),
      withLearningTransition: false,
      wasDueReview: false,
    }).state
    // Confirmed lapse needs 2 failures in the latest 3 comparable checks.
    expect(confirmedLapse(state)).toBe(false)
  })
})
