import { describe, expect, it } from 'vitest'
import { KNOWLEDGE_GRAPH, prerequisiteEdges } from '../knowledge-graph'
import { validateGraph } from '../graph-validation'

describe('knowledge graph catalog', () => {
  it('contains the 89 initial KCs plus the 13 mined from blok 2', () => {
    expect(KNOWLEDGE_GRAPH.length).toBe(102)
    expect(new Set(KNOWLEDGE_GRAPH.map((n) => n.id)).size).toBe(102)
  })

  it('has the full prerequisite edge list from the design tables', () => {
    // Transcribed from docs/adaptive-learning-design.md §1.3 (tables A–E).
    // Plus the blok 2 / Grafieken edges.
    expect(prerequisiteEdges().length).toBe(149 + 24)
  })

  it('validates: unique ids, resolved deps, no cycles, topological order', () => {
    const result = validateGraph()
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
    expect(result.topologicalOrder.length).toBe(102)
  })

  it('every KC is reachable from an in-scope root', () => {
    const result = validateGraph()
    expect(result.errors.some((e) => e.includes('unreachable'))).toBe(false)
  })

  it('fact nodes are parallel, not a ladder (only MUL.GROUP.Array as parent)', () => {
    for (let n = 1; n <= 10; n++) {
      const node = KNOWLEDGE_GRAPH.find((k) => k.id === `MUL.FACT.T${n}`)
      expect(node?.prerequisites).toEqual(['MUL.GROUP.Array'])
    }
  })

  it('covers all five themes', () => {
    const themes = new Set(KNOWLEDGE_GRAPH.flatMap((n) => n.themes))
    expect(themes.size).toBe(5)
  })
})
