/**
 * Cijferend aftrekken — SUB.COLUMN.Align (no borrowing), .BorrowCrossout
 * (one borrow from a non-zero neighbour) and .BorrowAcrossZero (borrowing
 * through a zero, e.g. 503 − 247). Book form: "Zet onder elkaar en reken
 * uit. Schat eerst het antwoord." with an ≈ line and an = line.
 */
import type { GeneratedExercise } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { estimateStep, intStep, isSupported, makeExercise, roundTo, sumEstimates } from './kit'

type Kind = 'align' | 'borrow' | 'zero'

function borrowsOf(a: number, b: number): { count: number; acrossZero: boolean } {
  let count = 0
  let acrossZero = false
  let borrow = 0
  for (let place = 1; place <= 1000; place *= 10) {
    const da = Math.floor(a / place) % 10 - borrow
    const db = Math.floor(b / place) % 10
    if (da < db) {
      count++
      // Borrowing from the next column, which itself holds a 0.
      if (Math.floor(a / (place * 10)) % 10 === 0 && Math.floor(a / (place * 10)) > 0) acrossZero = true
      borrow = 1
    } else {
      borrow = 0
    }
  }
  return { count, acrossZero }
}

function findPair(rng: SeededRng, kind: Kind, harder: boolean): { a: number; b: number } {
  for (let i = 0; i < 2000; i++) {
    let a = rng.int(harder ? 1000 : 200, harder ? 9999 : 999)
    if (kind === 'zero') {
      // Put a zero in the tens (503) or tens and ones (500) of the minuend.
      a = Math.floor(a / 100) * 100 + (rng.bool() ? rng.int(1, 9) : 0)
    }
    const b = rng.int(100, a - 50)
    const { count, acrossZero } = borrowsOf(a, b)
    if (kind === 'align' && count === 0) return { a, b }
    if (kind === 'borrow' && count === 1 && !acrossZero) return { a, b }
    if (kind === 'zero' && acrossZero) return { a, b }
  }
  throw new Error('columnar-subtraction: no pair')
}

export function generateColumnarSubtraction(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  const kind: Kind =
    ctx.primarySkillId === 'SUB.COLUMN.Align' ? 'align'
    : ctx.primarySkillId === 'SUB.COLUMN.BorrowCrossout' ? 'borrow'
    : ctx.primarySkillId === 'SUB.COLUMN.BorrowAcrossZero' ? 'zero'
    : (() => { throw new Error(`columnar-subtraction: unsupported skill ${ctx.primarySkillId}`) })()
  const { a, b } = findPair(rng, kind, ctx.band === 'harder')
  const diff = a - b
  const ea = a % 10
  const eb = b % 10
  const borrowOnes = ea < eb
  const bookForm = !isSupported(ctx)

  const steps = []
  if (!bookForm && borrowOnes) {
    steps.push(intStep({
      id: 'ones', prompt: `Eenheden: ${ea} − ${eb} kan niet. Je leent 1 tiental. Hoeveel eenheden heb je dan?`, skill: ctx.primarySkillId,
      answer: ea + 10, solution: `${ea} + 10 = ${ea + 10}`, reveals: false,
      wrong: (v) => (v === eb - ea ? { feedbackNl: 'Je draaide de som om: je moet altijd boven − onder doen. Leen eerst.', misconceptionId: 'MC.SUB.SmallerFromLarger' } : null),
    }))
  }
  if (bookForm) {
    const canonical = roundTo(a, 100) - roundTo(b, 100)
    steps.push(estimateStep({
      id: 'estimate', prompt: `${a} − ${b} ≈`, skill: 'META.CHECK.EstimateInverse', role: 'supporting',
      solution: `${a} − ${b} ≈ ${roundTo(a, 100)} − ${roundTo(b, 100)} = ${canonical}`,
      accepted: sumEstimates([a, b], '−'), canonical, how: `${roundTo(a, 100)} − ${roundTo(b, 100)} = ${canonical}.`, exact: diff,
    }))
  }
  // "Smaller from larger": each column subtracted the wrong way round.
  const smallerFromLarger = Number(String(a).padStart(4, '0').split('').map((d, i) => Math.abs(Number(d) - Number(String(b).padStart(4, '0')[i]))).join(''))
  steps.push(intStep({
    id: 'diff', prompt: bookForm ? `${a} − ${b} =` : `${a} − ${b} = ?`, skill: ctx.primarySkillId, answer: diff,
    solution: `${a} − ${b} = ${diff}. Controle: ${diff} + ${b} = ${a}.`,
    wrong: (v) => (v === smallerFromLarger && kind !== 'align'
      ? { feedbackNl: 'Per kolom reken je boven − onder. Kan dat niet? Dan leen je bij de buren.', misconceptionId: 'MC.SUB.SmallerFromLarger' }
      : kind === 'zero' ? 'Bij een 0 moet je eerst verder naar links lenen: 1 honderdtal = 10 tientallen.' : 'Reken kolom voor kolom, van rechts naar links. Controleer met plus.'),
  }))

  return makeExercise(ctx, rng, {
    archetypeId: 'columnar-subtraction',
    instructionNl: bookForm ? BOOK.zetOnderElkaarSchatEerst : 'Reken onder elkaar uit. Begin bij de eenheden. Kan het niet? Leen bij de buren.',
    steps,
    widget: bookForm ? null : { type: 'column-grid', props: { operation: '−', operands: [a, b] } },
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: kind === 'align' ? ['no-borrow'] : kind === 'borrow' ? ['single-borrow'] : ['across-zero'],
    explanationNl: [`${a} − ${b} = ${diff}.`, `Controle: ${diff} + ${b} = ${a}.`],
    hintsNl: ['Zet de getallen precies onder elkaar: E onder E, T onder T.', 'Begin rechts bij de eenheden. Kan boven − onder niet? Leen 1 van de buurman.', 'Staat er bij de buurman een 0? Leen dan eerst van de plek daarnaast.'],
    fingerprint: `colsub:${a}-${b}`,
  })
}

export const SUBTRACTION_COLUMN_SKILLS = ['SUB.COLUMN.Align', 'SUB.COLUMN.BorrowCrossout', 'SUB.COLUMN.BorrowAcrossZero']
