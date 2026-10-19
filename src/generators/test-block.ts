/**
 * Toetsvorm (docs/test-readiness-plan.md §A): a page of several items under
 * one book instruction, answered together and checked at the end, without
 * help — the shape of a Test jezelf group. Built from the generator's own
 * test-format (S3) items, so wording and number ranges stay the book's.
 */
import type { GeneratedExercise, GeneratedStep } from '../domain/types'
import type { Generator, GeneratorContext } from './types'

/** Share of answers that must be right to pass a block (5 of 6, 4 of 5, 8 of 10). */
export const BLOCK_PASS_FRACTION = 0.8

export function blockPassed(correct: number, total: number): boolean {
  return total > 0 && correct / total >= BLOCK_PASS_FRACTION - 1e-9
}

/** Items per block: like the test page, fewer when each item has a picture or two lines. */
function blockSize(sample: GeneratedExercise): number {
  if (sample.widget || sample.steps.some((s) => s.widget)) return 3
  return sample.steps.length >= 2 ? 4 : 6
}

export function generateTestBlock(ctx: GeneratorContext, generate: Generator, size?: number): GeneratedExercise {
  const at = (i: number) => generate({ ...ctx, tier: 'S3', seed: `${ctx.seed}:b${i}` })
  const first = at(0)
  // One picture with several questions (graphs, clock offsets, lettered lines)
  // is already a test page of its own.
  if (first.steps.length >= 3) {
    return { ...first, format: 'block', hintsNl: [], variationTags: [...new Set([...first.variationTags, 'toetsvorm'])] }
  }
  const target = size ?? blockSize(first)
  const items: GeneratedExercise[] = [first]
  const seen = new Set([first.fingerprint])
  for (let i = 1; items.length < target && i < target * 8; i++) {
    const ex = at(i)
    if (seen.has(ex.fingerprint)) continue
    seen.add(ex.fingerprint)
    items.push(ex)
  }
  const shared = items.every((ex) => ex.instructionNl === first.instructionNl)
  const steps: GeneratedStep[] = items.flatMap((ex, n) =>
    ex.steps.map((s, k) => ({
      ...s,
      id: `i${n}-${s.id}`,
      // Stories carry their own text: keep it with the item when instructions differ.
      promptNl: !shared && k === 0 ? `${ex.instructionNl} ${s.promptNl}` : s.promptNl,
      widget: s.widget ?? ex.widget ?? null,
    })),
  )
  return {
    ...first,
    id: `${first.id}-blk`,
    instructionNl: shared ? first.instructionNl : 'Maak de opgaven.',
    steps,
    widget: null,
    format: 'block',
    // A test page with a word problem on it shows transfer, like the real test.
    representation: items.some((ex) => ex.representation === 'story') ? 'story' : 'symbolic',
    variationTags: [...new Set([...items.flatMap((ex) => ex.variationTags), 'toetsvorm'])],
    explanationNl: items.flatMap((ex) => ex.explanationNl.slice(0, 1)),
    hintsNl: [],
    fingerprint: `block:${items.map((ex) => ex.fingerprint).join('|')}`,
  }
}
