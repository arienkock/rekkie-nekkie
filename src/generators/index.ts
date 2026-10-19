/**
 * Generator registry: maps supported primary KCs to their archetype generator.
 * Skills without a generator are still tracked in the graph but never served.
 */
import type { GeneratedExercise, SkillId } from '../domain/types'
import type { Generator, GeneratorContext } from './types'
import { generateDhteDecompose } from './dhte-decompose'
import { generateNumberLineJumps } from './number-line-jumps'
import { generateColumnarAddition } from './columnar-addition'
import { generateRulerOffset } from './ruler-offset'
import { generateDivisionRemainderContext } from './division-remainder-context'
import { generateClockDutchPhrase } from './clock-dutch-phrase'
import { generateMoneyChange } from './money-change'
import { generateUnitConversion } from './unit-conversion'

import { generateMultiplicationFacts, TABLES, isTableSkill } from './multiplication-facts'
import { FACT_SKILLS, generateFacts } from './facts'
import { PLACE_VALUE_SKILLS, generatePlaceValue } from './place-value'
import { NUMBER_LINE_READ_SKILLS, generateNumberLineRead } from './number-line-read'
import { ROUNDING_SKILLS, generateRounding } from './rounding'
import { SUBTRACTION_COLUMN_SKILLS, generateColumnarSubtraction } from './columnar-subtraction'
import { META_SKILLS, generateMeta } from './meta'
import { MEASUREMENT_SKILLS, generateMeasurement } from './measurement'
import { MULTIPLICATION_SKILLS, generateMultiplication } from './multiplication'
import { DIVISION_MORE_SKILLS, generateDivisionMore } from './division-more'
import { TIME_CALC_SKILLS, generateTimeCalc } from './time-calc'
import { CALENDAR_SKILLS, generateCalendar } from './calendar'
import { MONEY_SKILLS, generateMoney } from './money'
import { GRAPH_SKILLS, generateGraphs } from './graphs'
import { generateTestBlock } from './test-block'

const family = (skills: string[], generator: Generator) => Object.fromEntries(skills.map((id) => [id, generator]))

const REGISTRY: Record<string, Generator> = {
  ...Object.fromEntries(TABLES.map((n) => [`MUL.FACT.T${n}`, generateMultiplicationFacts])),
  'PV.DHTE.Decompose': generateDhteDecompose,
  'ADD.JUMP.NoBridge': generateNumberLineJumps,
  'ADD.JUMP.TenBridge': generateNumberLineJumps,
  'ADD.JUMP.HundredBridge': generateNumberLineJumps,
  'ADD.COLUMN.Align': generateColumnarAddition,
  'ADD.COLUMN.Carry': generateColumnarAddition,
  'MEAS.RULER.ZeroStart': generateRulerOffset,
  'MEAS.RULER.Offset': generateRulerOffset,
  'DIV.REMAINDER.Compute': generateDivisionRemainderContext,
  'DIV.REMAINDER.CeilContext': generateDivisionRemainderContext,
  'DIV.REMAINDER.FloorContext': generateDivisionRemainderContext,
  'TIME.READ.MinuteFive': generateClockDutchPhrase,
  'TIME.READ.DutchHourQuarter': generateClockDutchPhrase,
  'TIME.READ.DutchHourOffset': generateClockDutchPhrase,
  'TIME.READ.DutchHalfNextHour': generateClockDutchPhrase,
  'TIME.READ.DutchPhrasingHalfHourOffset': generateClockDutchPhrase,
  'MONEY.CHANGE.Complement': generateMoneyChange,
  'MEAS.LENGTH.Convert': generateUnitConversion,
  'MEAS.MASS.Convert': generateUnitConversion,
  'MEAS.CAPACITY.Convert': generateUnitConversion,
  'MEAS.MIXED.ComposeSplit': generateUnitConversion,
  'SUB.JUMP.NoBridge': generateNumberLineJumps,
  'SUB.JUMP.TenBridge': generateNumberLineJumps,
  'SUB.JUMP.HundredBridge': generateNumberLineJumps,
  ...family(FACT_SKILLS, generateFacts),
  ...family(PLACE_VALUE_SKILLS, generatePlaceValue),
  ...family(NUMBER_LINE_READ_SKILLS, generateNumberLineRead),
  ...family(ROUNDING_SKILLS, generateRounding),
  ...family(SUBTRACTION_COLUMN_SKILLS, generateColumnarSubtraction),
  ...family(META_SKILLS, generateMeta),
  ...family(MEASUREMENT_SKILLS, generateMeasurement),
  ...family(MULTIPLICATION_SKILLS, generateMultiplication),
  ...family(DIVISION_MORE_SKILLS, generateDivisionMore),
  ...family(TIME_CALC_SKILLS, generateTimeCalc),
  ...family(CALENDAR_SKILLS, generateCalendar),
  ...family(MONEY_SKILLS, generateMoney),
  ...family(GRAPH_SKILLS, generateGraphs),
}

export const SUPPORTED_SKILLS: SkillId[] = Object.keys(REGISTRY)

export const CURRICULUM_SKILLS = SUPPORTED_SKILLS.filter((id) => !isTableSkill(id))

export function hasGenerator(skillId: SkillId): boolean {
  return skillId in REGISTRY
}

/**
 * Deterministically generate an exercise for the requested primary skill.
 * Throws on unsatisfiable constraints — the caller must catch and retry with
 * a fresh seed (invalid items are never shown, §4.1 selecting).
 */
export function generateExercise(ctx: GeneratorContext): GeneratedExercise {
  const generator = REGISTRY[ctx.primarySkillId]
  if (!generator) throw new Error(`No generator registered for ${ctx.primarySkillId}`)
  const exercise = generator(ctx)
  validateGeneratedExercise(exercise)
  return exercise
}

/** Generator validity checks (docs §5.3.2) before any item is displayed. */
export function validateGeneratedExercise(ex: GeneratedExercise): void {
  if (!ex.id || !ex.archetypeId) throw new Error('Exercise missing id/archetype')
  if (ex.steps.length === 0) throw new Error('Exercise has no steps')
  if (!ex.primarySkillId) throw new Error('Exercise missing primary skill')
  if (!ex.fingerprint) throw new Error('Exercise missing fingerprint')
  const ids = new Set<string>()
  for (const step of ex.steps) {
    if (typeof step.validate !== 'function') throw new Error(`Step ${step.id} has no validator`)
    if (!step.skillTarget.skillId) throw new Error(`Step ${step.id} has no skill target`)
    if (step.expected === undefined) throw new Error(`Step ${step.id} has no expected answer`)
    if (ids.has(step.id)) throw new Error(`Duplicate step id ${step.id}`)
    ids.add(step.id)
    // The canonical answer must pass the step's own validator: an item whose
    // stated solution is marked wrong would be unwinnable.
    if (!step.validate(step.expected).isCorrect) throw new Error(`Step ${step.id}: expected answer does not validate`)
  }
}

/**
 * A test-format block (toetsvorm) for a skill: several S3 items under one
 * book instruction, checked together at the end without help.
 */
export function generateTestBlockFor(ctx: GeneratorContext, size?: number): GeneratedExercise {
  const generator = REGISTRY[ctx.primarySkillId]
  if (!generator) throw new Error(`No generator registered for ${ctx.primarySkillId}`)
  const block = generateTestBlock(ctx, generator, size)
  validateGeneratedExercise(block)
  return block
}
