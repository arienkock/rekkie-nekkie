/**
 * Selector regression tests (docs/adaptive-learning-design.md §2.4).
 * Session composition must spread practice instead of starving skills.
 */
import { describe, expect, it } from 'vitest'
import { selectNextSkill } from '../selector'
import { newSkillState } from '../evidence'
import { SUPPORTED_SKILLS } from '../../generators'
import type { LearnerSkillState, SkillId } from '../../domain/types'

function freshStates(): Record<SkillId, LearnerSkillState> {
  const states: Record<SkillId, LearnerSkillState> = {}
  for (const id of SUPPORTED_SKILLS) states[id] = newSkillState(id)
  return states
}

function ctx(states: Record<SkillId, LearnerSkillState>) {
  return {
    skills: { supported: [...SUPPORTED_SKILLS], states },
    recentPurposes: [] as never[],
    recentSkillIds: [] as string[],
    now: new Date(),
    intentSkill: null,
  }
}

describe('problem selector', () => {
  it('spreads practice across skills instead of repeating one', () => {
    const states = freshStates()
    const picks: string[] = []
    for (let i = 0; i < 40; i++) {
      const result = selectNextSkill(ctx(states), () => 0.5)
      expect(result).not.toBeNull()
      picks.push(result!.skillId)
      // Model the real loop: serving an item records a meaningful opportunity
      // for the skill, which is exactly what spreads later picks.
      const served = states[result!.skillId]!
      served.meaningfulOpportunityCount += 1
      served.exposureCount += 1
    }
    const counts = new Map<string, number>()
    for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1)
    const maxShare = Math.max(...counts.values()) / picks.length
    expect(counts.size).toBeGreaterThan(3)
    expect(maxShare).toBeLessThan(0.5)
  })

  it('does not concentrate on a well-practiced, high-belief skill (evidence need decays)', () => {
    const states = freshStates()
    // A mastered-in-practice skill: high belief AND many meaningful
    // opportunities — it should no longer crowd out fresh skills.
    const strong = states['MEAS.LENGTH.Convert']!
    strong.masteryProbability = 0.99
    strong.meaningfulOpportunityCount = 20
    strong.exposureCount = 20
    strong.scaffolding.currentTier = 'S2'

    const picks: string[] = []
    for (let i = 0; i < 30; i++) {
      const result = selectNextSkill(ctx(states), () => 0.5)
      picks.push(result!.skillId)
    }
    const strongPicks = picks.filter((p) => p === 'MEAS.LENGTH.Convert').length
    expect(strongPicks / picks.length).toBeLessThan(0.5)
  })

  it('never starves the learner pool: always returns a candidate', () => {
    const states = freshStates()
    // Prerequisites unmet for everyone (fresh profile): teach-first must
    // still serve items.
    for (let i = 0; i < 10; i++) {
      expect(selectNextSkill(ctx(states), () => 0.1)).not.toBeNull()
    }
  })
})