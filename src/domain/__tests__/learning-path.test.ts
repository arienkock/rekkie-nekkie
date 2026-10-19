import { describe, expect, it } from 'vitest'
import { KNOWLEDGE_GRAPH } from '../knowledge-graph'
import { LEARNING_PATH, PROEFTOETSEN, currentLessons, lessonById, pathSkills } from '../learning-path'
import { newSkillState } from '../../engine/evidence'
import { generateTestBlockFor, hasGenerator } from '../../generators'
import type { LearnerSkillState } from '../types'

describe('learning path', () => {
  it('places every skill of the knowledge graph on the path (no gaps)', () => {
    const onPath = new Set(pathSkills())
    expect(KNOWLEDGE_GRAPH.map((n) => n.id).filter((id) => !onPath.has(id))).toEqual([])
  })

  it('only lists skills that exist and can be practised', () => {
    const known = new Set(KNOWLEDGE_GRAPH.map((n) => n.id))
    for (const id of pathSkills()) {
      expect(known.has(id), id).toBe(true)
      expect(hasGenerator(id), id).toBe(true)
    }
  })

  it('follows the blok 2 table of contents: lessons 1–15 with the book’s titles', () => {
    const blok2 = LEARNING_PATH.find((b) => b.id === 'blok-2')!
    expect(blok2.lessons.map((l) => l.titleNl.split(' ').slice(0, 2).join(' '))).toEqual(
      Array.from({ length: 15 }, (_, i) => `Les ${i + 1}`),
    )
    expect(lessonById('2-3')!.goalNl).toBe('cijferend vermenigvuldigen zoals 3 x 295.')
  })

  it('has unique lesson ids', () => {
    const ids = LEARNING_PATH.flatMap((b) => b.lessons.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('moves the session window forward once a lesson reaches the test format', () => {
    const states: Record<string, LearnerSkillState> = {}
    for (const n of KNOWLEDGE_GRAPH) states[n.id] = newSkillState(n.id)
    expect(currentLessons('blok-2', states).map((l) => l.id)).toEqual(['2-1', '2-2'])
    for (const id of lessonById('2-1')!.skills) states[id]!.scaffolding.currentTier = 'S3'
    expect(currentLessons('blok-2', states).map((l) => l.id)).toEqual(['2-1', '2-2', '2-3'])
  })
})

describe('proeftoetsen', () => {
  it('mirror Test jezelf blok 2: the same skills in the same order', () => {
    const test = PROEFTOETSEN.find((p) => p.id === 'proeftoets-blok-2')!
    expect(test.groups.map((g) => g.skillId).slice(0, 9)).toEqual([
      'PV.DHTE.Decompose', 'NUM.ROUND.Ten', 'NUM.ROUND.Hundred', 'NUM.COMPARE.Symbols', 'MUL.SPLIT.Distribute',
      'MUL.ESTIMATE.Friendly', 'MUL.COLUMN.Carry', 'MUL.COLUMN.TensFactor', 'MONEY.NOTATION.EuroCent',
    ])
  })

  it('every group builds a solvable test block of the requested size and item type', () => {
    for (const test of PROEFTOETSEN) {
      for (const [i, group] of test.groups.entries()) {
        const block = generateTestBlockFor({
          seed: `pt:${test.id}:${i}`, tier: 'S3', band: 'standard', purpose: 'diagnostic', primarySkillId: group.skillId, variant: group.variant,
        }, group.items)
        expect(block.format).toBe('block')
        for (const step of block.steps) expect(step.validate(step.expected).isCorrect, `${group.skillId} ${step.id}`).toBe(true)
        if (group.variant === 'digit-value') {
          for (const step of block.steps) expect(step.promptNl).toMatch(/^Wat is de \d waard in: € /)
        }
        if (group.variant === 'type') {
          for (const step of block.steps) expect(step.promptNl).toMatch(/≈$/)
        }
      }
    }
  })
})
