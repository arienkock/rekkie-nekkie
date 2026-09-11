/**
 * child-status: the child-facing per-skill status text must be truthful and
 * consistent. Regression test for the "nog niet geoefend / blank" inversion:
 * the engine's Freshness 'new' means "no review schedule yet", not "never
 * practiced", and 'refresh' means "refreshed within the last day", not "due".
 */
import { describe, expect, it } from 'vitest'
import { childStatusText } from '../child-status'
import { newSkillState } from '../../engine/evidence'
import type { LearnerSkillState } from '../types'

function stateWith(overrides: Partial<LearnerSkillState>): LearnerSkillState {
  return { ...newSkillState('ADD.JUMP.TenBridge'), ...overrides }
}

describe('childStatusText', () => {
  it('unpracticed skills say so explicitly', () => {
    const s = stateWith({})
    expect(s.exposureCount).toBe(0)
    expect(childStatusText(s)).toBe('nog niet geoefend')
  })

  it('practiced but unverified skills (freshness new) never say "nog niet geoefend"', () => {
    // Scaffolded practice leaves reviewDueAt null: freshness stays 'new'.
    const s = stateWith({ exposureCount: 1, memory: { ...newSkillState('x').memory, freshness: 'new' } })
    expect(childStatusText(s)).toBe('aan het oefenen')
  })

  it('recently refreshed (refresh) is not presented as due', () => {
    const s = stateWith({ exposureCount: 3, memory: { ...newSkillState('x').memory, freshness: 'refresh' } })
    expect(childStatusText(s)).toBe('net geoefend')
  })

  it('scheduled/verified and due skills keep their labels', () => {
    const fresh = stateWith({ exposureCount: 3, memory: { ...newSkillState('x').memory, freshness: 'fresh' } })
    expect(childStatusText(fresh)).toBe('vers in je hoofd')
    const due = stateWith({ exposureCount: 3, memory: { ...newSkillState('x').memory, freshness: 'due' } })
    expect(childStatusText(due)).toBe('even opfrissen?')
  })
})