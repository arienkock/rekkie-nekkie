/**
 * Archetype 3.1: Unit conversion — MEAS.LENGTH.Convert, MEAS.MASS.Convert,
 * MEAS.CAPACITY.Convert, MEAS.MIXED.ComposeSplit.
 * Uses the ACTUAL integer ratios (m↔km and g↔kg = 1,000), both directions.
 */
import type { GeneratedExercise } from '../domain/types'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { parseIntAnswer, uniqueId } from './types'

type Family = 'length' | 'mass' | 'capacity'

const FAMILIES: Record<Family, { units: string[]; ratios: Record<string, number>; labelNl: string }> = {
  length: {
    units: ['km', 'm', 'dm', 'cm', 'mm'],
    ratios: { km: 1_000_000, m: 1_000, dm: 100, cm: 10, mm: 1 },
    labelNl: 'lengte',
  },
  mass: {
    units: ['kg', 'g', 'mg'],
    ratios: { kg: 1_000_000, g: 1_000, mg: 1 },
    labelNl: 'gewicht',
  },
  capacity: {
    units: ['L', 'dL', 'cL', 'mL'],
    ratios: { L: 1_000, dL: 100, cL: 10, mL: 1 },
    labelNl: 'inhoud',
  },
}

const SKILL_FAMILY: Record<string, Family> = {
  'MEAS.LENGTH.Convert': 'length',
  'MEAS.MASS.Convert': 'mass',
  'MEAS.CAPACITY.Convert': 'capacity',
}

export function generateUnitConversion(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  const skill = ctx.primarySkillId

  // Mixed compose/split: 4 m 25 cm = ___ cm.
  if (skill === 'MEAS.MIXED.ComposeSplit') {
    const big = rng.int(1, 9)
    const small = rng.int(1, 9) * 5
    const total = big * 100 + small
    return {
      id: uniqueId(rng),
      archetypeId: 'unit-conversion',
      seed: ctx.seed,
      instructionNl: 'Zet de gemengde maat om naar één maat.',
      steps: [
        {
          id: 'compose',
          promptNl: `${big} m ${small} cm = ? cm`,
          answerType: { kind: 'integer', unit: 'cm' },
          solutionNl: `${big} m = ${big * 100} cm, dus samen ${total} cm`,
          skillTarget: { skillId: 'MEAS.MIXED.ComposeSplit', role: 'primary' },
          revealsAnswer: true,
          validate: (answer) => {
            const v = parseIntAnswer(answer as string | number)
            if (v === null) return { isCorrect: false, feedbackNl: 'Schrijf een heel getal in cm.', misconceptionId: null, invalidFormat: true }
            if (v === total) return { isCorrect: true, feedbackNl: `Klopt: ${total} cm.`, misconceptionId: null }
            return {
              isCorrect: false,
              feedbackNl: `${big} m = ${big * 100} cm. Tel daarna de losse ${small} cm erbij.`,
              misconceptionId: null,
            }
          },
        },
      ],
      widget: null,
      primarySkillId: 'MEAS.MIXED.ComposeSplit',
      supportingSkillIds: ['MEAS.LENGTH.Convert'],
      difficultyBand: ctx.band,
      representation: 'symbolic',
      variationTags: ['compose'],
      purpose: ctx.purpose,
      explanationNl: [`${big} m = ${big * 100} cm en ${small} cm blijft ${small} cm, dus ${total} cm.`],
      hintsNl: [
        'Reken eerst de grote maat om naar de kleine maat.',
        `Eén meter is 100 centimeter. Hoeveel cm is ${big} m?`,
        'Tel daarna de losse centimeters erbij.',
      ],
      fingerprint: `mixed:${big}m${small}cm`,
    }
  }

  const familyKey = SKILL_FAMILY[skill]
  if (!familyKey) throw new Error(`unit-conversion: unsupported skill ${skill}`)
  const family = FAMILIES[familyKey]

  // Choose from/to units whose ratio keeps the answer a clean integer.
  for (let attempt = 0; attempt < 200; attempt++) {
    const fromIdx = rng.int(0, family.units.length - 1)
    const toIdx = rng.int(0, family.units.length - 1)
    if (fromIdx === toIdx) continue
    const from = family.units[fromIdx]!
    const to = family.units[toIdx]!
    const ratio = family.ratios[from]! / family.ratios[to]!
    const value = rng.int(1, 99)
    const answer = value * ratio
    if (!Number.isInteger(answer) || answer > 100_000) continue
    // Avoid the trivial ×10-only pattern at harder bands.
    if (ctx.band === 'harder' && ratio === 10 && rng.bool(0.8)) continue

    return {
      id: uniqueId(rng),
      archetypeId: 'unit-conversion',
      seed: ctx.seed,
      instructionNl: `Reken om met de echte verhouding (${family.labelNl}).`,
      steps: [
        {
          id: 'convert',
          promptNl: `${value} ${from} = ? ${to}`,
          answerType: { kind: 'integer', unit: to },
          solutionNl: `${value} ${from} = ${answer} ${to}`,
          skillTarget: { skillId: skill, role: 'primary' },
          revealsAnswer: true,
          validate: (raw) => {
            const v = parseIntAnswer(raw as string | number)
            if (v === null) return { isCorrect: false, feedbackNl: 'Schrijf een heel getal.', misconceptionId: null, invalidFormat: true }
            if (v === answer) return { isCorrect: true, feedbackNl: `Klopt: ${answer} ${to}.`, misconceptionId: null }
            const wrongDirection = v === value / ratio
            return {
              isCorrect: false,
              feedbackNl: wrongDirection
                ? `Let op de richting: welke maat is groter, ${from} of ${to}? In één ${from} passen ${ratio} ${to}.`
                : `Denk aan de verhouding: 1 ${from} = ${ratio} ${to}. Reken dan ${value} × ${ratio}.`,
              misconceptionId: wrongDirection ? 'MC.MEAS.Direction' : null,
            }
          },
        },
      ],
      widget: null,
      primarySkillId: skill,
      supportingSkillIds: [],
      difficultyBand: ctx.band,
      representation: 'symbolic',
      variationTags: [ratio > 1 ? 'down-scale' : 'up-scale', ratio === 1000 ? 'thousand-ratio' : 'ten-ratio'],
      purpose: ctx.purpose,
      explanationNl: [
        `1 ${from} = ${ratio} ${to}.`,
        `${value} ${from} = ${value} × ${ratio} = ${answer} ${to}.`,
      ],
      hintsNl: [
        'Kijk welke maat groter is: de kilometer of de meter?',
        `Onthoud de echte verhouding: 1 ${from} = ${ratio} ${to}.`,
        `Reken dan: ${value} × ${ratio}.`,
      ],
      fingerprint: `unitconv:${value}${from}-${to}`,
    }
  }
  throw new Error('unit-conversion: no clean item found')
}