import type { GeneratedExercise } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { parseIntAnswer, uniqueId } from './types'

export const TABLES = Array.from({ length: 10 }, (_, i) => i + 1)
export const DEFAULT_TABLES = [6, 7, 8, 9]
export const isTableSkill = (id: string) => /^MUL\.FACT\.T(?:10|[1-9])$/.test(id)

/**
 * The order in which to suggest tables: the anchors first (1, 10, 2, 5),
 * then tables built from them (4 = double 2, 3, 6 = double 3, 9 = 10 − 1,
 * 8 = double 4) and 7 last.
 */
export const TABLE_SUGGESTION_ORDER = [1, 10, 2, 5, 4, 3, 6, 9, 8, 7] as const

/** A table counts as known from Level 2: passed in test format, on her own, on two days. */
export const tableKnown = (level: number | undefined) => (level ?? 0) >= 2

/**
 * When every chosen table is known, the next one to suggest: the first in
 * the suggestion order that she does not know yet and has not chosen.
 * Returns null while a chosen table still needs practice, or when all are known.
 */
export function suggestNextTable(selected: number[], levelOf: (table: number) => number | undefined): { known: number[]; next: number | null } {
  const known = selected.filter((t) => tableKnown(levelOf(t))).sort((a, b) => a - b)
  if (selected.length === 0 || known.length < selected.length) return { known, next: null }
  const next = TABLE_SUGGESTION_ORDER.find((t) => !selected.includes(t) && !tableKnown(levelOf(t))) ?? null
  return { known, next }
}

export function generateMultiplicationFacts(ctx: GeneratorContext): GeneratedExercise {
  const table = Number(ctx.primarySkillId.replace('MUL.FACT.T', ''))
  if (!TABLES.includes(table)) throw new Error('Unknown multiplication table')
  const rng = new SeededRng(ctx.seed)
  const multiplier = rng.int(1, 10)
  const product = multiplier * table
  const supported = ctx.tier === 'S0' || ctx.tier === 'S1'
  const missing = !supported && rng.next() < 0.3
  // S3 is the test format: bare facts under "Reken uit.", as on the test page.
  const test = ctx.tier === 'S3'
  // The test page mixes in a word problem now and then.
  // No word problems for the ×1 table or one box: "1 doosjes met elk 1
  // potloden" is wrong Dutch and a silly question.
  const story = !supported && !missing && rng.next() < (test ? 0.2 : 0.35) && table > 1 && multiplier > 1
  const target = missing ? multiplier : product
  const equation = `${multiplier} × ${table} = ${product}`
  const split = Math.min(5, multiplier)
  const strategy = multiplier > 5
    ? `Splits de rijen: 5 × ${table} + ${multiplier - 5} × ${table}.`
    : `Tel ${multiplier} keer een groepje van ${table}.`
  return {
    id: uniqueId(rng), archetypeId: 'multiplication-facts', seed: ctx.seed,
    primarySkillId: ctx.primarySkillId, supportingSkillIds: [],
    // On a test page the missing-factor lines get their own book instruction,
    // so "□ × 10 = 30" never sits under "Reken uit." next to "4 × 10 =":
    // she answered 4 × 10 with 4 when the two kinds were mixed.
    instructionNl: test && missing ? BOOK.vulOntbrekende : test && !story ? BOOK.rekenUit : missing ? `Welk getal ontbreekt? □ × ${table} = ${product}`
      : story ? `Er zijn ${multiplier} doosjes met elk ${table} potloden.`
        : `Hoeveel is ${multiplier} × ${table}?`,
    steps: [{
      // A box marks the missing number more clearly than dots ("… × 10 = 60" got 60).
      id: 'fact', promptNl: missing ? `□ × ${table} = ${product}` : story ? 'Hoeveel potloden zijn er samen?' : `${multiplier} × ${table} =`,
      answerType: { kind: 'integer' }, skillTarget: { skillId: ctx.primarySkillId, role: 'primary' },
      revealsAnswer: true, expected: target, solutionNl: missing ? `${product} : ${table} = ${multiplier}` : equation,
      validate(answer) {
        const value = parseIntAnswer(answer as string | number)
        if (value === null) return { isCorrect: false, invalidFormat: true, feedbackNl: 'Vul een heel getal in.', misconceptionId: null }
        return { isCorrect: value === target, feedbackNl: value === target ? 'Goed gedaan!' : missing
          ? `Hoeveel groepjes van ${table} vormen samen ${product}?`
          : `Nog niet. Denk aan gelijke groepjes van ${table}, of gebruik een hint.`, misconceptionId: null }
      },
    }],
    // Independent work hides the array until help is requested or feedback is shown.
    // Missing-factor arrays would directly disclose the unknown number of rows.
    widget: missing || test ? null : { type: 'multiplication-array', props: { rows: multiplier, columns: table, split, mode: ctx.tier === 'S1' ? 'strategy' : 'array' } },
    representation: ctx.tier === 'S0' ? 'pictorial' : story ? 'story' : 'symbolic',
    difficultyBand: ctx.band, purpose: ctx.purpose,
    variationTags: [`T${table}:m${multiplier}`, missing ? 'missing-factor' : 'product', ...(missing ? ['inverse-verification'] : [])],
    explanationNl: [equation, strategy, `${multiplier} × ${table} is evenveel als ${table} × ${multiplier}.`],
    hintsNl: missing
      ? [`Zoek hoeveel groepjes van ${table} je nodig hebt.`, `Tel met sprongen van ${table} tot ${product}.`, `Je kunt ook delen: ${product} : ${table}.`]
      : [`Elke rij is één groepje van ${table}.`, strategy, `Tel de twee delen bij elkaar: ${split * table} + ${(multiplier - split) * table}.`],
    fingerprint: `mul:${multiplier}x${table}:${missing ? 'missing' : story ? 'story' : 'product'}`,
  }
}
