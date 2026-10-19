/**
 * Archetype 1.1: DHTE Place Value Decomposition — PV.DHTE.Decompose.
 * Zero positions are critical variation (5307 → 0 T must not collapse).
 */
import type { GeneratedExercise, GeneratedStep } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { digitsAnswer, uniqueId } from './types'

const PLACE = [1000, 100, 10, 1]

/**
 * Parse an expanded form: "8 × 1000 + 3 × 100 + 4 × 10 + 2 × 1" (the
 * book's notation, also with x or *) or "8000 + 300 + 40 + 2". Returns the
 * digit per place, or null when a term is not one digit times one place.
 */
export function parseExpandedForm(input: string): Record<number, number> | null {
  const terms = input.replace(/\s+/g, '').replace(/^=/, '').split('+').filter((t) => t !== '')
  if (terms.length === 0) return null
  const digits: Record<number, number> = {}
  for (const term of terms) {
    const product = term.match(/^(\d)[×x*](1000|100|10|1)$/i)
    let digit: number
    let place: number
    if (product) {
      digit = Number(product[1])
      place = Number(product[2])
    } else if (/^[1-9]0*$/.test(term) && term.length <= 4) {
      digit = Number(term[0])
      place = 10 ** (term.length - 1)
    } else if (term === '0') {
      continue
    } else {
      return null
    }
    if (digits[place] !== undefined) return null
    digits[place] = digit
  }
  return digits
}

/** Test format: the D H T E row is given, she writes the expanded form. */
function expandedFormStep(n: number): GeneratedStep {
  const ds = String(n).padStart(4, '0').split('').map(Number)
  const canonical = ds.map((d, i) => `${d} × ${PLACE[i]}`).join(' + ')
  return {
    id: 'expanded',
    promptNl: `D ${ds[0]} · H ${ds[1]} · T ${ds[2]} · E ${ds[3]} =`,
    answerType: { kind: 'text' },
    solutionNl: `${n} = ${canonical}`,
    skillTarget: { skillId: 'PV.DHTE.Decompose', role: 'primary' },
    revealsAnswer: true,
    expected: canonical,
    validate: (answer) => {
      const parsed = parseExpandedForm(String(answer))
      if (!parsed) {
        return { isCorrect: false, feedbackNl: 'Schrijf het zo: 8 × 1000 + 3 × 100 + 4 × 10 + 2 × 1.', misconceptionId: null, invalidFormat: true }
      }
      const wrongPlaces = PLACE.filter((place, i) => (parsed[place] ?? 0) !== ds[i])
      if (wrongPlaces.length === 0) return { isCorrect: true, feedbackNl: `Goed: ${canonical}.`, misconceptionId: null }
      return {
        isCorrect: false,
        feedbackNl: `Kijk nog eens naar ${wrongPlaces.map((p) => `× ${p}`).join(' en ')}: welk cijfer staat op die plek?`,
        misconceptionId: null,
      }
    },
  }
}

export function generateDhteDecompose(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  const n = ctx.band === 'easier' ? rng.int(100, 999) : rng.int(1000, 9999)
  const digits = String(n).padStart(4, '0')
  const [d, h, t, e] = [...digits].map(Number)
  const hasZero = digits.includes('0')


  const expected: Record<string, number> = ctx.band === 'easier'
    ? { H: h, T: t, E: e }
    : { D: d, H: h, T: t, E: e }

  if (ctx.tier === 'S3' && ctx.band !== 'easier') {
    return {
      id: uniqueId(rng),
      archetypeId: 'dhte-decompose',
      seed: ctx.seed,
      instructionNl: `${BOOK.maakDeOpgave} ${BOOK.verdeelDhte}`,
      steps: [expandedFormStep(n)],
      widget: null,
      primarySkillId: 'PV.DHTE.Decompose',
      supportingSkillIds: [],
      difficultyBand: ctx.band,
      representation: 'symbolic',
      variationTags: hasZero ? ['zero-position', 'dhte', 'expanded-form'] : ['dhte', 'expanded-form'],
      purpose: ctx.purpose,
      explanationNl: [`${n} = ${d} × 1000 + ${h} × 100 + ${t} × 10 + ${e} × 1.`],
      hintsNl: [],
      fingerprint: `dhte:${n}`,
    }
  }

  const steps: GeneratedExercise['steps'] = [
    {
      id: 'dhte',
      promptNl:
        ctx.band === 'easier'
          ? `Zet de cijfers van ${n} op de goede plek in de tabel.`
          : `Zet de cijfers van ${n} op de goede plek in de tabel. Let op: een lege plek krijgt een 0.`,
      answerType: { kind: 'digits', length: 4 },
      solutionNl: `${n} = ${d} duizendtallen, ${h} honderdtallen, ${t} tientallen en ${e} eenheden.`,
      skillTarget: { skillId: 'PV.DHTE.Decompose', role: 'primary' },
      revealsAnswer: true,
      expected: Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, String(v)])),
      validate: (answer) => {
        let parsed: Record<string, number>
        try {
          parsed = digitsAnswer(answer as Record<string, string | number>)
        } catch {
          return { isCorrect: false, feedbackNl: 'Gebruik overal hele getallen (0–9).', misconceptionId: null, invalidFormat: true }
        }
        const wrong: string[] = []
        for (const [k, v] of Object.entries(expected)) {
          if (parsed[k] !== v) wrong.push(k)
        }
        if (wrong.length === 0) {
          return { isCorrect: true, feedbackNl: 'Klopt! Elk cijfer staat op zijn eigen plek.', misconceptionId: null }
        }
        // Zero-collapse signature: a zero digit entered as blank/omitted (t=0 but answer 7).
        const zeroCollapse =
          (Object.keys(expected) as string[]).some((k) => expected[k] === 0 && parsed[k] !== 0)
        return {
          isCorrect: false,
          feedbackNl: zeroCollapse
            ? `Kijk nog eens naar de ${wrong.join(' en ')}. Wat gebeurt er met een plek die leeg is?`
            : `Kijk nog eens naar de ${wrong.join(' en ')}. Wat is elk cijfer waard?`,
          misconceptionId: zeroCollapse ? 'MC.PV.ZeroCollapse' : null,
        }
      },
    },
  ]

  return {
    id: uniqueId(rng),
    archetypeId: 'dhte-decompose',
    seed: ctx.seed,
    instructionNl:
      ctx.tier === 'S0' || ctx.tier === 'S1'
        ? 'D = duizendtallen, H = honderdtallen, T = tientallen, E = eenheden.'
        : `${BOOK.maakDeOpgave} ${BOOK.verdeelDhte}`,
    steps,
    widget: { type: 'dhte-grid', props: { number: n, columns: Object.keys(expected) } },
    primarySkillId: 'PV.DHTE.Decompose',
    supportingSkillIds: [],
    difficultyBand: ctx.band,
    representation: ctx.tier === 'S0' || ctx.tier === 'S1' ? 'pictorial' : 'symbolic',
    variationTags: hasZero ? ['zero-position', 'dhte'] : ['dhte'],
    purpose: ctx.purpose,
    explanationNl: [
      `${n} bestaat uit ${d} duizendtallen (${d * 1000}), ${h} honderdtallen (${h * 100}), ${t} tientallen (${t * 10}) en ${e} eenheden.`,
    ],
    hintsNl: [
      'Kijk naar het getal bovenaan: elk cijfer heeft zijn eigen plek in de tabel.',
      'D staat voor duizendtallen, H voor honderdtallen, T voor tientallen en E voor eenheden.',
      'Een plek zonder cijfer krijgt een 0. Bijvoorbeeld: 5037 heeft 0 tientallen.',
    ],
    fingerprint: `dhte:${n}`,
  }
}
