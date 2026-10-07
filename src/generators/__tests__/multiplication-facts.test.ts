import { describe, expect, it } from 'vitest'
import { generateExercise } from '../index'
import { TABLES } from '../multiplication-facts'

describe('multiplication tables', () => {
  it('covers every multiplier and validates product and missing-factor answers for all tables', () => {
    for (const table of TABLES) {
      const multipliers = new Set<number>()
      const forms = new Set<string>()
      for (let i = 0; i < 150; i++) {
        const ex = generateExercise({ seed: `fact:${i}`, primarySkillId: `MUL.FACT.T${table}`, tier: 'S2', band: 'standard', purpose: 'growth' })
        const [, m, t, form] = ex.fingerprint.match(/^mul:(\d+)x(\d+):(.*)$/)!
        const multiplier = Number(m)
        expect(Number(t)).toBe(table)
        expect(multiplier).toBeGreaterThanOrEqual(1)
        expect(multiplier).toBeLessThanOrEqual(10)
        multipliers.add(multiplier)
        forms.add(form!)
        const target = form === 'missing' ? multiplier : multiplier * table
        expect(ex.steps[0]!.validate(target).isCorrect).toBe(true)
        expect(ex.steps[0]!.validate(target + 1).isCorrect).toBe(false)
        expect(ex.steps[0]!.validate('nope').invalidFormat).toBe(true)
        expect(ex.variationTags).toContain(`T${table}:m${multiplier}`)
        expect(ex.variationTags).not.toContain(`T${table}:all-multipliers`)
        if (form === 'missing') expect(ex.widget).toBeNull()
      }
      expect(multipliers.size).toBe(10)
      expect(forms).toEqual(new Set(['product', 'missing', 'story']))
    }
  })

  it('connects supported products to arrays and five-row splits without printing the total', () => {
    for (let i = 0; i < 30; i++) {
      const ex = generateExercise({ seed: `array:${i}`, primarySkillId: 'MUL.FACT.T7', tier: 'S0', band: 'easier', purpose: 'growth' })
      expect(ex.widget?.type).toBe('multiplication-array')
      expect(ex.widget?.props.mode).toBe('array')
      const partial = generateExercise({ seed: `array:${i}`, primarySkillId: 'MUL.FACT.T7', tier: 'S1', band: 'easier', purpose: 'growth' })
      expect(partial.widget?.props.mode).toBe('strategy')
      expect(partial.representation).toBe('symbolic')
      const { rows, columns, split } = ex.widget!.props
      expect(columns).toBe(7)
      expect(split).toBe(Math.min(5, rows as number))
      expect(ex.representation).toBe('pictorial')
      expect(ex.variationTags).not.toContain('missing-factor')
    }
  })

  it('offers both symbolic recall and word problems before S3', () => {
    const representations = new Set<string>()
    for (let i = 0; i < 80; i++) {
      const ex = generateExercise({ seed: `representations:${i}`, primarySkillId: 'MUL.FACT.T7', tier: 'S2', band: 'standard', purpose: 'growth' })
      representations.add(ex.representation)
      if (ex.representation === 'story') {
        expect(ex.steps[0]!.promptNl).not.toContain('×')
        expect(ex.steps[0]!.promptNl).toContain('potloden')
      }
    }
    expect(representations).toEqual(new Set(['symbolic', 'story']))
  })

})
