/**
 * Graph validation per docs/adaptive-learning-design.md §5.3.1:
 * unique IDs; every dependency resolves; no self-edges/cycles;
 * topological sort succeeds; every KC is reachable from an in-scope root.
 */
import { KNOWLEDGE_GRAPH, SKILL_INDEX } from './knowledge-graph'
import type { SkillId } from './types'

export interface GraphValidationResult {
  valid: boolean
  errors: string[]
  nodeCount: number
  edgeCount: number
  topologicalOrder: SkillId[]
}

export function validateGraph(): GraphValidationResult {
  const errors: string[] = []
  const ids = new Set<SkillId>()

  for (const n of KNOWLEDGE_GRAPH) {
    if (ids.has(n.id)) errors.push(`Duplicate KC id: ${n.id}`)
    ids.add(n.id)
    for (const p of n.prerequisites) {
      if (p === n.id) errors.push(`Self-edge on ${n.id}`)
      if (!SKILL_INDEX.has(p)) errors.push(`Unresolved prerequisite ${p} of ${n.id}`)
    }
  }

  // Kahn topological sort (cycle detection).
  const inDegree = new Map<SkillId, number>()
  const adjacency = new Map<SkillId, SkillId[]>()
  let edgeCount = 0
  for (const n of KNOWLEDGE_GRAPH) {
    inDegree.set(n.id, n.prerequisites.length)
    edgeCount += n.prerequisites.length
    for (const p of n.prerequisites) {
      const list = adjacency.get(p) ?? []
      list.push(n.id)
      adjacency.set(p, list)
    }
  }

  const queue: SkillId[] = KNOWLEDGE_GRAPH.filter((n) => n.prerequisites.length === 0).map((n) => n.id)
  const order: SkillId[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const child of adjacency.get(id) ?? []) {
      const d = inDegree.get(child)! - 1
      inDegree.set(child, d)
      if (d === 0) queue.push(child)
    }
  }
  if (order.length !== KNOWLEDGE_GRAPH.length) {
    const cyclic = KNOWLEDGE_GRAPH.filter((n) => (inDegree.get(n.id) ?? 0) > 0).map((n) => n.id)
    errors.push(`Cycle detected involving: ${cyclic.join(', ')}`)
  }

  // Reachability: every KC must be reachable from an in-scope root.
  const roots = KNOWLEDGE_GRAPH.filter((n) => n.prerequisites.length === 0).map((n) => n.id)
  const visited = new Set<SkillId>(roots)
  const stack = [...roots]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const child of adjacency.get(id) ?? []) {
      if (!visited.has(child)) {
        visited.add(child)
        stack.push(child)
      }
    }
  }
  for (const n of KNOWLEDGE_GRAPH) {
    if (!visited.has(n.id)) errors.push(`KC ${n.id} is unreachable from any root`)
  }

  return { valid: errors.length === 0, errors, nodeCount: KNOWLEDGE_GRAPH.length, edgeCount, topologicalOrder: order }
}