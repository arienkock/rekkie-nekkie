import { describe, expect, it } from 'vitest'
import { validateGraph } from '../graph-validation'

describe('knowledge graph structural validation (docs §5.3.1)', () => {
  it('the shipped graph passes: unique IDs, resolved deps, no cycles, full reachability', () => {
    const result = validateGraph()
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
    expect(result.nodeCount).toBeGreaterThan(50)
    expect(result.topologicalOrder.length).toBe(result.nodeCount)
  })
})