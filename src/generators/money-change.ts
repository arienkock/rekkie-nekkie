/**
 * Archetype 5.5: Wisselgeld — MONEY.CHANGE.Complement.
 * Counts up from price to payment; verifies price + change = paid.
 * All amounts are integer cents (domain/units.ts).
 */
import type { GeneratedExercise } from '../domain/types'
import { formatMoney, parseMoneyCents } from '../domain/units'
import { BOOK } from '../domain/book-wording'
import { euro } from './kit'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { uniqueId } from './types'

export function generateMoneyChange(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  // Book ranges (blok 2.2): change from € 2 and € 5 up to € 50 and € 100,
  // prices in steps of 5 cent.
  const paidOptions =
    ctx.band === 'easier' ? [200, 500] : ctx.band === 'standard' ? [500, 1000, 2000] : [2000, 5000, 10000]
  const paid = rng.pick(paidOptions)
  const price = rng.int(Math.ceil(paid / 20), Math.floor(paid * 0.95 / 5)) * 5
  const change = paid - price

  return {
    id: uniqueId(rng),
    archetypeId: 'change-calculation',
    seed: ctx.seed,
    instructionNl: ctx.tier === 'S2' || ctx.tier === 'S3'
      ? BOOK.hoeveelTerug
      : 'Je betaalt en krijgt wisselgeld terug. Reken vanaf de prijs tot aan het betaalde bedrag.',
    steps: [
      {
        id: 'change',
        promptNl: ctx.tier === 'S3'
          ? `Het kost ${euro(price)}. Je betaalt met ${euro(paid)}. Je krijgt terug:`
          : `Je koopt iets voor ${euro(price)} en betaalt met ${euro(paid)}. Hoeveel wisselgeld krijg je terug?`,
        answerType: { kind: 'money', unit: 'euro-comma' },
        solutionNl: `${formatMoney(paid)} − ${formatMoney(price)} = ${formatMoney(change)}`,
        skillTarget: { skillId: 'MONEY.CHANGE.Complement', role: 'primary' },
        revealsAnswer: true,
        expected: `${Math.floor(change / 100)},${String(change % 100).padStart(2, '0')}`,
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
    // This is a missing-part task (price + change = paid), an inverse relation
    // required by this KC's Level 3 variation gate.
    variationTags: ['change', 'inverse-verification'],
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
