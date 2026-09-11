/**
 * Archetype 1.1: DHTE Place Value Decomposition — PV.DHTE.Decompose.
 * Zero positions are critical variation (5307 → 0 T must not collapse).
 */
import type { GeneratedExercise } from '../domain/types'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { digitsAnswer, uniqueId } from './types'

export function generateDhteDecompose(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  const n = ctx.band === 'easier' ? rng.int(100, 999) : rng.int(1000, 9999)
  const digits = String(n).padStart(4, '0')
  const [d, h, t, e] = [...digits].map(Number)
  const hasZero = digits.includes('0')


  const expected: Record<string, number> = ctx.band === 'easier'
    ? { H: h, T: t, E: e }
    : { D: d, H: h, T: t, E: e }

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
        : 'Splits het getal in duizendtallen, honderdtallen, tientallen en eenheden.',
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
