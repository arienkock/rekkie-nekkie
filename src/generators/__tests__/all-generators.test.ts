/**
 * Every skill in the knowledge graph can be practised, at every support tier
 * and band, and every item can be solved by its own canonical answer — the
 * "no gaps" guarantee of the learning path (docs/test-readiness-plan.md).
 */
import { describe, expect, it } from 'vitest'
import { KNOWLEDGE_GRAPH } from '../../domain/knowledge-graph'
import { BOOK_INSTRUCTIONS } from '../../domain/book-wording'
import type { ExerciseAnswer, GeneratedExercise, GeneratedStep } from '../../domain/types'
import { generateExercise, generateTestBlockFor, hasGenerator, SUPPORTED_SKILLS } from '../index'
import type { GeneratorContext } from '../types'

const TIERS = ['S0', 'S1', 'S2', 'S3'] as const
const BANDS = ['easier', 'standard', 'harder'] as const
const SEEDS = 12

function ctx(primarySkillId: string, tier: GeneratorContext['tier'], band: GeneratorContext['band'], seed: string): GeneratorContext {
  return { primarySkillId, tier, band, seed, purpose: 'growth' }
}

/** Like the session runner: a constraint failure retries with a fresh seed. */
function generate(c: GeneratorContext): GeneratedExercise {
  let last: unknown
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return generateExercise({ ...c, seed: `${c.seed}:${attempt}` })
    } catch (e) {
      last = e
    }
  }
  throw last
}

/** A plausible wrong answer of the same shape as the expected one. */
function wrongAnswer(step: GeneratedStep): ExerciseAnswer | null {
  const e = step.expected
  switch (step.answerType.kind) {
    case 'choice':
      return step.answerType.options.find((o) => o !== e) ?? null
    case 'integer':
      return Number(e) + 1
    case 'money': {
      const [eu, ce] = String(e).split(',')
      return `${Number(eu) + 1},${ce}`
    }
    case 'time': {
      const [h, m] = String(e).split(':').map(Number)
      return `${String(h).padStart(2, '0')}:${String((m! + 5) % 60).padStart(2, '0')}`
    }
    case 'quotient-remainder': {
      const map = e as Record<string, string>
      return { ...map, quotient: String(Number(map.quotient) + 1) }
    }
    case 'digits':
    case 'counts': {
      const map = e as Record<string, string>
      const key = Object.keys(map)[0]!
      return { ...map, [key]: String((Number(map[key]) + 1) % 10) }
    }
    default:
      return typeof e === 'number' ? e + 1 : null
  }
}

/** S3 instructions that are not a sentence from the book but name the situation. */
const SITUATION_INSTRUCTIONS = [
  'Welke maat past erbij?',
  'Welke schatting hoort bij welke som?',
  'Bekijk de dienstregeling.',
  'Wat moet ik doen?',
  'Tel de groepjes.',
  'Hoeveel stippen zijn er?',
  'Het potlood',
  'Lees af hoe lang',
  'Het is ',
  'Welk getal rond je af op',
]

describe('every skill in the graph is practisable', () => {
  it('has a generator for every knowledge-graph node (no gaps)', () => {
    const missing = KNOWLEDGE_GRAPH.map((n) => n.id).filter((id) => !hasGenerator(id))
    expect(missing).toEqual([])
  })

  for (const skillId of SUPPORTED_SKILLS) {
    it(`${skillId}: every tier and band generates solvable items`, () => {
      for (const tier of TIERS) {
        for (const band of BANDS) {
          for (let i = 0; i < SEEDS; i++) {
            const c = ctx(skillId, tier, band, `all:${skillId}:${tier}:${band}:${i}`)
            const ex = generate(c)
            expect(ex.primarySkillId).toBe(skillId)
            expect(ex.instructionNl.trim().length).toBeGreaterThan(0)
            for (const step of ex.steps) {
              expect(step.promptNl.trim().length, `${skillId} ${step.id}`).toBeGreaterThan(0)
              expect(step.validate(step.expected).isCorrect, `${skillId} ${tier} ${band} ${step.id} expected ${JSON.stringify(step.expected)}`).toBe(true)
              const wrong = wrongAnswer(step)
              if (wrong !== null && JSON.stringify(wrong) !== JSON.stringify(step.expected)) {
                const result = step.validate(wrong)
                // Some wrong-looking answers are equally right (another exact
                // payment, another friendly estimate); they must still parse.
                if (result.isCorrect) continue
                expect(result.feedbackNl.length, `${skillId} ${step.id} feedback`).toBeGreaterThan(0)
              }
              // Blank input is never wrong-math evidence.
              expect(step.validate('').isCorrect).toBe(false)
            }
            // Determinism: the same seed gives the same item.
            const again = generateExercise({ ...c, seed: `${c.seed}:0` })
            const first = generateExercise({ ...c, seed: `${c.seed}:0` })
            expect(again.fingerprint).toBe(first.fingerprint)
          }
        }
      }
    })
  }

  it('test-format items use the book’s own instructions', () => {
    const offenders: string[] = []
    for (const skillId of SUPPORTED_SKILLS) {
      for (const band of BANDS) {
        for (let i = 0; i < 6; i++) {
          const ex = generate(ctx(skillId, 'S3', band, `book:${skillId}:${band}:${i}`))
          // A word problem's text is its instruction, as on the test page.
          const ok = ex.representation === 'story'
            || BOOK_INSTRUCTIONS.some((b) => ex.instructionNl.startsWith(b))
            || SITUATION_INSTRUCTIONS.some((s) => ex.instructionNl.startsWith(s))
          if (!ok) offenders.push(`${skillId}: ${ex.instructionNl}`)
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([])
  })

  it('builds a test-format block for every skill: several items, no hints, all solvable', () => {
    for (const skillId of SUPPORTED_SKILLS) {
      for (const band of BANDS) {
        const block = generateTestBlockFor(ctx(skillId, 'S3', band, `block:${skillId}:${band}`))
        expect(block.format).toBe('block')
        expect(block.hintsNl).toEqual([])
        expect(block.variationTags).toContain('toetsvorm')
        expect(block.steps.length, skillId).toBeGreaterThanOrEqual(2)
        expect(new Set(block.steps.map((s) => s.id)).size).toBe(block.steps.length)
        for (const step of block.steps) expect(step.validate(step.expected).isCorrect).toBe(true)
      }
    }
  })
})
