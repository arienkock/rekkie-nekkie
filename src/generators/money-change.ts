/**
 * Archetype 5.5: Wisselgeld — MONEY.CHANGE.Complement.
 * Counts up from price to payment; verifies price + change = paid.
 * All amounts are integer cents (domain/units.ts).
 */
import type { GeneratedExercise } from '../domain/types'
import { formatMoney, parseMoneyCents } from '../domain/units'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { uniqueId } from './types'

export function generateMoneyChange(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  const paidOptions =
    ctx.band === 'easier' ? [200, 500] : ctx.band === 'standard' ? [500, 1000] : [1000, 2000]
  const paid = rng.pick(paidOptions)
  const price = rng.int(Math.floor(paid / 4), Math.floor(paid / 2) - 20)
  const change = paid - price

  return {
    id: uniqueId(rng),
    archetypeId: 'change-calculation',
    seed: ctx.seed,
    instructionNl: 'Je betaalt en krijgt wisselgeld terug. Reken vanaf de prijs tot aan het betaalde bedrag.',
    steps: [
      {
        id: 'change',
        promptNl: `Je koopt iets voor ${formatMoney(price)} en betaalt met ${formatMoney(paid)}. Hoeveel wisselgeld krijg je terug?`,
        answerType: { kind: 'money', unit: 'euro-comma' },
        solutionNl: `${formatMoney(paid)} − ${formatMoney(price)} = ${formatMoney(change)}`,
        skillTarget: { skillId: 'MONEY.CHANGE.Complement', role: 'primary' },
        revealsAnswer: true,
        validate: (answer) => {
          const v = parseMoneyCents(String(answer))
          if (v === null) {
            return { isCorrect: false, feedbackNl: 'Schrijf het bedrag met een komma, bijvoorbeeld 4,50.', misconceptionId: null, invalidFormat: true }
          }
          if (v === change) {
            return { isCorrect: true, feedbackNl: `Klopt: ${formatMoney(change)}. Controle: ${formatMoney(price)} + ${formatMoney(change)} = ${formatMoney(paid)}.`, misconceptionId: null }
          }
          const inverted = v === price
          return {
            isCorrect: false,
            feedbackNl: inverted
              ? 'Je schreef de prijs op. Tel vanaf de prijs door tot het betaalde bedrag.'
              : `Tel van ${formatMoney(price)} naar ${formatMoney(paid)}. Hoeveel telde je?`,
            misconceptionId: null,
          }
        },
      },
    ],
    widget: { type: 'money-tray', props: { price, paid } },
    primarySkillId: 'MONEY.CHANGE.Complement',
    supportingSkillIds: ['MONEY.CALC.Subtract'],
    difficultyBand: ctx.band,
    representation: 'story',
    variationTags: ['change'],
    purpose: ctx.purpose,
    explanationNl: [
      `Tel vanaf de prijs door naar het betaalde bedrag: ${formatMoney(price)} → … → ${formatMoney(paid)}, samen ${formatMoney(change)} wisselgeld.`,
      `Controleer: prijs + wisselgeld = betaald (${formatMoney(price)} + ${formatMoney(change)} = ${formatMoney(paid)}).`,
    ],
    hintsNl: [
      'Tel vanaf de prijs door tot het betaalde bedrag.',
      'Maak de som makkelijker: reken eerst door tot een heel bedrag.',
      'Controleer: prijs + wisselgeld moet precies het betaalde bedrag zijn.',
    ],
    fingerprint: `change:${price}:${paid}`,
  }
}