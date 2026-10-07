import type { GeneratedExercise } from '../domain/types'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { parseIntAnswer, uniqueId } from './types'

export const TABLES = Array.from({ length: 10 }, (_, i) => i + 1)
export const DEFAULT_TABLES = [6, 7, 8, 9]
export const isTableSkill = (id: string) => /^MUL\.FACT\.T(?:10|[1-9])$/.test(id)

export function generateMultiplicationFacts(ctx: GeneratorContext): GeneratedExercise {
  const table = Number(ctx.primarySkillId.replace('MUL.FACT.T', ''))
  if (!TABLES.includes(table)) throw new Error('Unknown multiplication table')
  const rng = new SeededRng(ctx.seed)
  const multiplier = rng.int(1, 10)
  const product = multiplier * table
  const supported = ctx.tier === 'S0' || ctx.tier === 'S1'
  const missing = !supported && rng.next() < 0.3
  const story = !supported && !missing && (ctx.tier === 'S3' || rng.next() < 0.35)
  const target = missing ? multiplier : product
  const equation = `${multiplier} × ${table} = ${product}`
  const split = Math.min(5, multiplier)
  const strategy = multiplier > 5
    ? `Splits de rijen: 5 × ${table} + ${multiplier - 5} × ${table}.`
    : `Tel ${multiplier} keer een groepje van ${table}.`
  return {
    id: uniqueId(rng), archetypeId: 'multiplication-facts', seed: ctx.seed,
    primarySkillId: ctx.primarySkillId, supportingSkillIds: [],
    instructionNl: missing ? `Welk getal ontbreekt? □ × ${table} = ${product}`
      : story ? `Er zijn ${multiplier} doosjes met elk ${table} potloden. Hoeveel potloden zijn dat samen?`
        : `Hoeveel is ${multiplier} × ${table}?`,
    steps: [{
      id: 'fact', promptNl: missing ? `□ × ${table} = ${product}` : story ? 'Hoeveel potloden zijn er samen?' : `${multiplier} × ${table} = ?`,
      answerType: { kind: 'integer' }, skillTarget: { skillId: ctx.primarySkillId, role: 'primary' },
      revealsAnswer: true, solutionNl: missing ? `${product} : ${table} = ${multiplier}` : equation,
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
    widget: missing ? null : { type: 'multiplication-array', props: { rows: multiplier, columns: table, split, mode: ctx.tier === 'S1' ? 'strategy' : 'array' } },
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
