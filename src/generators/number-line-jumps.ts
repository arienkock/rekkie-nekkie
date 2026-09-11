/**
 * Archetype 2.1: Rijgen op de getallenlijn — ADD.JUMP.NoBridge /
 * ADD.JUMP.TenBridge / ADD.JUMP.HundredBridge.
 * The difficulty band controls the bridge dimension (one critical dimension
 * at a time, docs §2.4): easier = no bridge, standard = one ten bridge,
 * harder = hundred bridge.
 */
import type { GeneratedExercise, GeneratedStep } from '../domain/types'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { parseIntAnswer, uniqueId } from './types'

interface BridgePlan {
  a: number
  b: number
  bridges: 'none' | 'ten' | 'hundred'
}

/** The primary skill selects the bridge dimension (§2.4: one critical
 *  dimension at a time); the band only tweaks the numeric range. */
function desiredBridges(primarySkillId: string): BridgePlan['bridges'] {
  switch (primarySkillId) {
    case 'ADD.JUMP.NoBridge': return 'none'
    case 'ADD.JUMP.TenBridge': return 'ten'
    case 'ADD.JUMP.HundredBridge': return 'hundred'
    default: throw new Error(`number-line-jumps: unsupported skill ${primarySkillId}`)
  }
}

function findPlan(rng: SeededRng, desired: BridgePlan['bridges']): BridgePlan {
  for (let attempt = 0; attempt < 500; attempt++) {
    const a = rng.int(120, 680)
    const bH = rng.int(1, 4) * 100
    const bT = rng.int(1, 9) * 10
    const bE = rng.int(1, 9)
    const b = bH + bT + bE
    if (a + b > 999) continue
    // Bridging classification on the actual jump endpoints (§1.3):
    // a tens jump crossing a hundred (547 + 70 = 617) or an ones jump
    // crossing a hundred (698 + 8 = 706) is a HUNDRED bridge; an ones jump
    // crossing a ten (617 + 8 = 625) without any hundred crossing is a TEN
    // bridge; clean place-value jumps bridge nothing.
    const p1 = a + bH
    const p2 = p1 + bT
    const tJumpCrossesHundred = bT % 100 !== 0 && Math.floor((p1 + bT) / 100) > Math.floor(p1 / 100)
    const eJumpCrossesTen = Math.floor((p2 + bE) / 10) > Math.floor(p2 / 10)
    const eJumpCrossesHundred = Math.floor((p2 + bE) / 100) > Math.floor(p2 / 100)
    const bridges: BridgePlan['bridges'] =
      tJumpCrossesHundred || eJumpCrossesHundred ? 'hundred' : eJumpCrossesTen ? 'ten' : 'none'
    if (bridges === desired) return { a, b, bridges }
  }
  throw new Error('number-line-jumps: no plan satisfies band constraints')
}

export function generateNumberLineJumps(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  const { a, b, bridges } = findPlan(rng, desiredBridges(ctx.primarySkillId))
  const h = Math.floor(b / 100) * 100
  const t = (Math.floor(b / 10) % 10) * 10
  const e = b % 10
  const p1 = a + h
  const p2 = p1 + t
  const total = a + b

  const jumps = [
    { from: a, to: p1, label: `+${h}` },
    { from: p1, to: p2, label: `+${t}` },
    { from: p2, to: total, label: `+${e}` },
  ]

  const mkStep = (id: string, prompt: string, target: number, from: number, jump: number): GeneratedStep => ({
    id,
    promptNl: prompt,
    answerType: { kind: 'integer' },
    solutionNl: `${from} + ${jump} = ${target}`,
    skillTarget: { skillId: ctx.primarySkillId, role: 'primary' as const },
    revealsAnswer: true,
    validate: (answer) => {
      const v = parseIntAnswer(answer as string | number)
      if (v === null) return { isCorrect: false, feedbackNl: 'Schrijf een heel getal.', misconceptionId: null, invalidFormat: true }
      if (v === target) return { isCorrect: true, feedbackNl: 'Goed!', misconceptionId: null }
      // Endpoint-not-jump signature: learner writes the final result as an endpoint.
      const endpointNotJump = v === total && target !== total
      return {
        isCorrect: false,
        feedbackNl: endpointNotJump
          ? `Dit is waar je uiteindelijk uitkomt. Wat is de tussenstand na deze sprong?`
          : `Je eerste sprong klopt nog. Waar kom je uit na deze sprong?`,
        misconceptionId: endpointNotJump ? 'MC.LINE.EndpointNotJump' : null,
      }
    },
  })

  const steps =
    ctx.tier === 'S0' || ctx.tier === 'S1'
      ? [
          mkStep('jump-1', `Je start op ${a} en springt eerst ${h}. Waar kom je uit?`, p1, a, h),
          mkStep('jump-2', `Vanaf ${p1} spring je ${t}. Waar kom je uit?`, p2, p1, t),
          mkStep('jump-3', `Vanaf ${p2} spring je nog ${e}. Waar kom je uit?`, total, p2, e),
        ]
      : [mkStep('final', `Reken uit: ${a} + ${b} = ?`, total, a, b)]

  return {
    id: uniqueId(rng),
    archetypeId: 'number-line-jumps',
    seed: ctx.seed,
    instructionNl:
      ctx.tier === 'S0' || ctx.tier === 'S1'
        ? `Reken met sprongen: eerst de honderdtallen, dan de tientallen, dan de eenheden.`
        : `Reken uit. Tip: je mag de getallenlijn als kladruimte gebruiken.`,
    steps,
    widget: { type: 'number-line', props: { range: [Math.floor(a / 100) * 100, Math.ceil(total / 100) * 100], jumps } },
    primarySkillId: ctx.primarySkillId,
    supportingSkillIds: [],
    difficultyBand: ctx.band,
    representation: ctx.tier === 'S0' || ctx.tier === 'S1' ? 'pictorial' : 'symbolic',
    variationTags: [bridges === 'none' ? 'no-bridge' : bridges === 'ten' ? 'ten-bridge' : 'hundred-bridge'],
    purpose: ctx.purpose,
    explanationNl: [
      `${a} + ${h} = ${p1}, dan ${p1} + ${t} = ${p2}, en ${p2} + ${e} = ${total}.`,
    ],
    hintsNl: [
      'Kijk op de getallenlijn: waar sta je nu, en welke sprong moet je maken?',
      'Spring eerst met de honderdtallen, dan de tientallen, dan de eenheden.',
      'Tel vanaf de tussenstand verder: kijk waar de boog van de getallenlijn uitkomt.',
    ],
    fingerprint: `nlj:${a}+${b}`,
  }
}