/**
 * Archetype 2.2: Cijferen — ADD.COLUMN.Align / ADD.COLUMN.Carry.
 * The primary skill selects the regrouping dimension (docs §2.4: one
 * critical dimension at a time): Align never carries; Carry carries in every
 * band (exactly one regrouping at easier/standard, chained when harder).
 * At S0/S1 an extra step asks for the carried ten explicitly.
 */
import type { DifficultyBand, GeneratedExercise } from '../domain/types'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { parseIntAnswer, uniqueId } from './types'

function carriesWanted(requested: string, band: DifficultyBand, carryCount: number): boolean {
  if (requested === 'ADD.COLUMN.Align') return carryCount === 0
  // One critical dimension at a time (§2.4): easier/standard carry items
  // regroup exactly once; harder chains.
  if (requested === 'ADD.COLUMN.Carry') return band === 'harder' ? carryCount >= 2 : carryCount === 1
  // Unregistered skills constrain by band as a safe default.
  return band === 'easier' ? carryCount === 0 : band === 'standard' ? carryCount === 1 : carryCount >= 2
}

function findPair(
  rng: SeededRng,
  band: DifficultyBand,
  requested: string,
): { a: number; b: number; carryCount: number } {
  for (let i = 0; i < 500; i++) {
    const a = rng.int(100, 899)
    const b = rng.int(100, Math.min(899, 999 - a))
    let carryCount = 0
    const e = (a % 10) + (b % 10)
    if (e >= 10) carryCount++
    const t = (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) + (e >= 10 ? 1 : 0)
    if (t >= 10) carryCount++
    const h = Math.floor(a / 100) + Math.floor(b / 100) + (t >= 10 ? 1 : 0)
    if (h >= 10) carryCount++
    if (carriesWanted(requested, band, carryCount)) return { a, b, carryCount }
  }
  throw new Error('columnar-addition: no pair satisfies band constraints')
}

export function generateColumnarAddition(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  const { a, b, carryCount } = findPair(rng, ctx.band, ctx.primarySkillId)
  const total = a + b
  const carryFromUnits = (a % 10) + (b % 10) >= 10 ? 1 : 0
  const hasCarry = carryFromUnits === 1

  const steps: GeneratedExercise['steps'] = []

  if ((ctx.tier === 'S0' || ctx.tier === 'S1') && hasCarry) {
    steps.push({
      id: 'carry-e',
      promptNl: `Hoeveel onthoud je bij de eenheden? (${a % 10} + ${b % 10})`,
      answerType: { kind: 'integer' },
      solutionNl: `${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}, dus onthoud ${carryFromUnits}`,
      skillTarget: { skillId: 'ADD.COLUMN.Carry', role: 'primary' },
      revealsAnswer: false,
      validate: (answer) => {
        const v = parseIntAnswer(answer as string | number)
        if (v === null) return { isCorrect: false, feedbackNl: 'Schrijf 0 of 1.', misconceptionId: null, invalidFormat: true }
        if (v === carryFromUnits) return { isCorrect: true, feedbackNl: 'Klopt!', misconceptionId: null }
        return {
          isCorrect: false,
          feedbackNl: `Reken ${a % 10} + ${b % 10} uit. Past dat in de eenheden-kolom, of moet je ruilen?`,
          misconceptionId: v === 0 ? 'MC.ADD.CarryLost' : null,
        }
      },
    })
  }

  steps.push({
    id: 'sum',
    promptNl: `Reken onder elkaar uit: ${a} + ${b} = ?`,
    answerType: { kind: 'integer' },
    solutionNl: `${a} + ${b} = ${total}`,
    skillTarget: { skillId: ctx.primarySkillId, role: 'primary' },
    revealsAnswer: true,
    validate: (answer) => {
      const v = parseIntAnswer(answer as string | number)
      if (v === null) return { isCorrect: false, feedbackNl: 'Schrijf een heel getal.', misconceptionId: null, invalidFormat: true }
      if (v === total) return { isCorrect: true, feedbackNl: 'Helemaal goed!', misconceptionId: null }
      // Carry-lost signature: correct sum ignoring all carries.
      const noCarry =
        (a % 10) + (b % 10) <= 9
        ? null
        : Math.floor(a / 100) + Math.floor(b / 100) < 10
          ? ((Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10)) % 10 * 10 + ((a % 10) + (b % 10)) % 10
          : null
      const carryLost = noCarry !== null && v === Math.floor(a / 100) * 100 + Math.floor(b / 100) * 100 + noCarry
      return {
        isCorrect: false,
        feedbackNl: carryLost
          ? 'Je som klopt bijna. Kijk nog eens goed naar wat je onthoudt bij de eenheden.'
          : 'Zet H, T en E netjes onder elkaar en reken kolom voor kolom.',
        misconceptionId: carryLost ? 'MC.ADD.CarryLost' : null,
      }
    },
  })

  return {
    id: uniqueId(rng),
    archetypeId: 'columnar-addition',
    seed: ctx.seed,
    instructionNl:
      ctx.tier === 'S0' || ctx.tier === 'S1'
        ? 'Reken onder elkaar uit. Begin bij de eenheden en onthoud bij elke tien.'
        : 'Reken onder elkaar uit.',
    steps,
    widget: { type: 'column-grid', props: { operation: '+', operands: [a, b] } },
    primarySkillId: ctx.primarySkillId,
    supportingSkillIds: [],
    difficultyBand: ctx.band,
    representation: 'symbolic',
    variationTags: carryCount >= 2 ? ['chained-carry'] : carryCount === 1 ? ['single-carry'] : ['no-carry'],
    purpose: ctx.purpose,
    explanationNl: [
      `Eenheden: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}${carryFromUnits ? ` → onthoud 1, schrijf ${((a % 10) + (b % 10)) % 10}` : ''}.`,
      `Antwoord: ${total}. Controleer: ${total} − ${b} = ${total - b}.`,
    ],
    hintsNl: [
      'Zet H, T en E netjes onder elkaar in het raster.',
      'Begin bij de eenheden (rechtsonder) en werk naar links.',
      'Past de som niet in één kolom? Reken 10 eenheden om in 1 tiental: onthoud 1 bij de volgende kolom.',
    ],
    fingerprint: `coladd:${a}+${b}`,
  }
}