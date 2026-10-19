/**
 * Small builders shared by the generators: typed steps that carry their own
 * canonical answer and validator, and the exercise envelope. Keeps each
 * generator about the mathematics and the wording, not the plumbing.
 */
import type {
  DifficultyBand,
  ExerciseAnswer,
  GeneratedExercise,
  GeneratedStep,
  SkillId,
  StepValidation,
  WidgetSpec,
} from '../domain/types'
import { parseMoneyCents } from '../domain/units'
import { formatDigital, formatDigital12, fromMinuteOfDay } from '../domain/dutch-time'
import type { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { parseTimeAnswer, sameClockTime, uniqueId } from './types'

// ---- Tier and band helpers ----

/** S0/S1: model and sub-steps. */
export const isSupported = (ctx: GeneratorContext) => ctx.tier === 'S0' || ctx.tier === 'S1'
/** S3: test format (book wording, bare item, no picture unless the task is a picture). */
export const isTestFormat = (ctx: GeneratorContext) => ctx.tier === 'S3'

export function byBand<T>(band: DifficultyBand, options: { easier: T; standard: T; harder: T }): T {
  return options[band]
}

// ---- Formatting in the book's style ----

/** "€ 24,13", as printed in the workbook (space after the euro sign). */
export function euro(cents: number): string {
  const abs = Math.abs(Math.round(cents))
  return `${cents < 0 ? '−' : ''}€ ${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

// ---- Parsing ----

/** Whole numbers: "1200", "1 200", "1.200" (Dutch thousands dot) and a trailing unit ("40 cm"). */
export function parseLooseInt(input: ExerciseAnswer): number | null {
  if (typeof input === 'number') return Number.isInteger(input) ? input : null
  if (typeof input !== 'string') return null
  let s = input.trim().replace(/\s+(?=\d{3}\b)/g, '').replace(/\s*[a-zA-Z€]+\.?$/u, '').trim()
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  if (!/^-?\d+$/.test(s)) return null
  return Number(s)
}

const normalizeChoice = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

// ---- Steps ----

interface StepBase {
  id: string
  prompt: string
  skill: SkillId
  role?: 'primary' | 'supporting'
  solution: string
  /** Defaults to true: the solution gives this step's answer away. */
  reveals?: boolean
  widget?: WidgetSpec | null
}

type Wrong<T> = (value: T) => string | { feedbackNl: string; misconceptionId: string } | null

function wrongResult<T>(wrong: Wrong<T> | undefined, value: T, fallback: string): StepValidation {
  const w = wrong?.(value)
  if (!w) return { isCorrect: false, feedbackNl: fallback, misconceptionId: null }
  if (typeof w === 'string') return { isCorrect: false, feedbackNl: w, misconceptionId: null }
  return { isCorrect: false, feedbackNl: w.feedbackNl, misconceptionId: w.misconceptionId }
}

function base(b: StepBase, expected: ExerciseAnswer): Omit<GeneratedStep, 'answerType' | 'validate'> {
  return {
    id: b.id,
    promptNl: b.prompt,
    solutionNl: b.solution,
    skillTarget: { skillId: b.skill, role: b.role ?? 'primary' },
    revealsAnswer: b.reveals ?? true,
    expected,
    ...(b.widget !== undefined ? { widget: b.widget } : {}),
  }
}

export function intStep(
  b: StepBase & { answer: number; unit?: string; ok?: string; wrong?: Wrong<number>; retry?: string },
): GeneratedStep {
  return {
    ...base(b, b.answer),
    answerType: b.unit ? { kind: 'integer', unit: b.unit } : { kind: 'integer' },
    validate: (raw) => {
      const v = parseLooseInt(raw)
      if (v === null) {
        return { isCorrect: false, feedbackNl: 'Schrijf een heel getal, bijvoorbeeld 120.', misconceptionId: null, invalidFormat: true }
      }
      if (v === b.answer) {
        return { isCorrect: true, feedbackNl: b.ok ?? `Goed: ${b.answer}${b.unit ? ` ${b.unit}` : ''}.`, misconceptionId: null }
      }
      return wrongResult(b.wrong, v, b.retry ?? 'Nog niet goed. Kijk nog eens rustig.')
    },
  }
}

export function choiceStep(
  b: StepBase & { options: string[]; answer: string; ok?: string; wrong?: Wrong<string>; retry?: string },
): GeneratedStep {
  if (!b.options.includes(b.answer)) throw new Error(`choice ${b.id}: answer not among options`)
  if (new Set(b.options.map(normalizeChoice)).size !== b.options.length) throw new Error(`choice ${b.id}: duplicate options`)
  return {
    ...base(b, b.answer),
    answerType: { kind: 'choice', options: b.options },
    validate: (raw) => {
      const v = normalizeChoice(String(raw))
      const option = b.options.find((o) => normalizeChoice(o) === v)
      if (!option) {
        return { isCorrect: false, feedbackNl: 'Kies een van de knoppen.', misconceptionId: null, invalidFormat: true }
      }
      if (option === b.answer) return { isCorrect: true, feedbackNl: b.ok ?? `Goed: ${b.answer}`, misconceptionId: null }
      return wrongResult(b.wrong, option, b.retry ?? 'Nog niet goed. Kijk nog eens.')
    },
  }
}

/** Money answers in integer cents; the learner writes "4,50". */
export function moneyStep(
  b: StepBase & { cents: number; ok?: string; wrong?: Wrong<number>; retry?: string },
): GeneratedStep {
  return {
    ...base(b, `${Math.floor(b.cents / 100)},${String(b.cents % 100).padStart(2, '0')}`),
    answerType: { kind: 'money', unit: 'euro-comma' },
    validate: (raw) => {
      const v = parseMoneyCents(String(raw))
      if (v === null) {
        return { isCorrect: false, feedbackNl: 'Schrijf het bedrag met een komma, bijvoorbeeld 4,50.', misconceptionId: null, invalidFormat: true }
      }
      if (v === b.cents) return { isCorrect: true, feedbackNl: b.ok ?? `Goed: ${euro(b.cents)}.`, misconceptionId: null }
      return wrongResult(b.wrong, v, b.retry ?? 'Nog niet goed. Kijk goed naar de euro’s en de centen.')
    },
  }
}

/**
 * Digital time. `strict24` requires the 24-hour reading (an afternoon time
 * written as 3:15 is then wrong); otherwise 3:15 and 15:15 both match.
 */
export function timeStep(
  b: StepBase & { minuteOfDay: number; strict24?: boolean; ok?: string; wrong?: Wrong<number>; retry?: string },
): GeneratedStep {
  const target = ((b.minuteOfDay % 1440) + 1440) % 1440
  const shown = b.strict24 ? formatDigital(fromMinuteOfDay(target)) : formatDigital12(fromMinuteOfDay(target))
  return {
    ...base(b, shown),
    answerType: { kind: 'time', use24Hour: b.strict24 ?? false },
    validate: (raw) => {
      const s = String(raw).trim()
      const v = parseTimeAnswer(s)
      if (v === null) {
        return { isCorrect: false, feedbackNl: 'Schrijf de tijd zoals op een digitale klok, bijvoorbeeld 08:20.', misconceptionId: null, invalidFormat: true }
      }
      const m = s.match(/^(\d{1,2})[:.u](\d{2})$/)!
      const exact = Number(m[1]) * 60 + Number(m[2])
      const ok = b.strict24 ? exact === target : sameClockTime(v, target)
      if (ok) return { isCorrect: true, feedbackNl: b.ok ?? `Goed: ${shown}.`, misconceptionId: null }
      return wrongResult(b.wrong, exact, b.retry ?? 'Nog niet goed. Kijk goed naar de uren en de minuten.')
    },
  }
}

// ---- Exercise envelope ----

type ExerciseFields = Omit<GeneratedExercise, 'id' | 'seed' | 'difficultyBand' | 'purpose' | 'primarySkillId'> &
  Partial<Pick<GeneratedExercise, 'primarySkillId'>>

export function makeExercise(ctx: GeneratorContext, rng: SeededRng, fields: ExerciseFields): GeneratedExercise {
  return {
    id: uniqueId(rng),
    seed: ctx.seed,
    difficultyBand: ctx.band,
    purpose: ctx.purpose,
    primarySkillId: ctx.primarySkillId,
    ...fields,
  }
}

/** Distinct wrong options near a value, for choice items. */
export function shuffleOptions(rng: SeededRng, answer: string, distractors: string[]): string[] {
  const unique = [...new Set(distractors.filter((d) => d !== answer))]
  return rng.shuffle([answer, ...unique])
}

// ---- Estimating ("Schat het antwoord.") ----

/** Round half up to a multiple of `place` (the book's rule: 5 or more rounds up). */
export function roundTo(n: number, place: number): number {
  return Math.floor((n + place / 2) / place) * place
}

/** The place a number is naturally rounded to for an estimate: its leading place. */
export function leadingPlace(n: number): number {
  return 10 ** Math.max(0, String(Math.abs(n)).length - 1)
}

/**
 * Friendly values for a factor or term: rounded to its leading place or
 * one place lower, plus the book's handy numbers (25, 50, 125, 250).
 */
export function friendlyValues(n: number): number[] {
  const lead = leadingPlace(n)
  const out = new Set<number>([roundTo(n, lead), roundTo(n, Math.max(1, lead / 10))])
  for (const handy of [25, 50, 125, 250]) if (Math.abs(n - handy) <= handy * 0.12) out.add(handy)
  out.delete(0)
  return [...out]
}

/**
 * An estimate counts when it is what friendly numbers give. `accepted` lists
 * every such value; the canonical one is shown in the solution.
 */
export function estimateStep(
  b: StepBase & { accepted: number[]; canonical: number; how: string; exact?: number },
): GeneratedStep {
  const accepted = new Set(b.accepted)
  return {
    ...base(b, b.canonical),
    answerType: { kind: 'integer' },
    validate: (raw) => {
      const v = parseLooseInt(raw)
      if (v === null) {
        return { isCorrect: false, feedbackNl: 'Schrijf een heel getal, bijvoorbeeld 900.', misconceptionId: null, invalidFormat: true }
      }
      if (accepted.has(v)) return { isCorrect: true, feedbackNl: `Goede schatting: ${b.how}`, misconceptionId: null }
      if (b.exact !== undefined && v === b.exact) {
        return {
          isCorrect: false,
          feedbackNl: 'Dat is het precieze antwoord. Bij schatten maak je eerst makkelijke getallen en reken je ongeveer.',
          misconceptionId: 'MC.EST.ComputedExactly',
        }
      }
      return { isCorrect: false, feedbackNl: 'Maak van de getallen passende getallen waarmee je makkelijk kunt rekenen.', misconceptionId: null }
    },
  }
}

/** Accepted sum estimates: both terms rounded to tens, or both to hundreds. */
export function sumEstimates(terms: number[], op: '+' | '−' = '+'): number[] {
  const combine = (vals: number[]) => vals.slice(1).reduce((acc, v) => (op === '+' ? acc + v : acc - v), vals[0]!)
  return [...new Set([10, 100].map((p) => combine(terms.map((t) => roundTo(t, p)))))]
}

/** Accepted product estimates: every combination of friendly factor values. */
export function productEstimates(a: number, b: number): number[] {
  const out = new Set<number>()
  for (const x of friendlyValues(a)) for (const y of friendlyValues(b)) out.add(x * y)
  return [...out]
}

/** Counts per label ("€ 20" → 1, "€ 2" → 0, …). Blank cells count as 0. */
export function countsStep(
  b: StepBase & {
    labels: string[]
    expected: Record<string, number>
    /** Accept any counts this function approves (several payments can be right). */
    accept: (counts: Record<string, number>) => true | string
  },
): GeneratedStep {
  return {
    ...base(b, Object.fromEntries(b.labels.map((l) => [l, String(b.expected[l] ?? 0)]))),
    answerType: { kind: 'counts', labels: b.labels },
    validate: (raw) => {
      const map = (raw && typeof raw === 'object' ? raw : {}) as Record<string, string | number>
      const counts: Record<string, number> = {}
      let any = false
      for (const label of b.labels) {
        const cell = String(map[label] ?? '').trim()
        if (cell === '') { counts[label] = 0; continue }
        const v = parseLooseInt(cell)
        if (v === null || v < 0) {
          return { isCorrect: false, feedbackNl: 'Vul bij elk hokje een heel getal in (of laat het leeg).', misconceptionId: null, invalidFormat: true }
        }
        counts[label] = v
        any = true
      }
      if (!any) return { isCorrect: false, feedbackNl: 'Vul in hoeveel je van elk nodig hebt.', misconceptionId: null, invalidFormat: true }
      const verdict = b.accept(counts)
      if (verdict === true) return { isCorrect: true, feedbackNl: 'Goed!', misconceptionId: null }
      return { isCorrect: false, feedbackNl: verdict, misconceptionId: null }
    },
  }
}
