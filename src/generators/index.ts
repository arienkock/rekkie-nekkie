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

const REGISTRY: Record<string, Generator> = {
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
}

export const SUPPORTED_SKILLS: SkillId[] = Object.keys(REGISTRY)

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
  for (const step of ex.steps) {
    if (typeof step.validate !== 'function') throw new Error(`Step ${step.id} has no validator`)
    if (!step.skillTarget.skillId) throw new Error(`Step ${step.id} has no skill target`)
  }
}
