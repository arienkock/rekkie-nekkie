/**
 * UI contract test: every exercise the generators can produce must be
 * renderable by the React components. Guards the wiring between
 * generators (WidgetSpec props, AnswerType kinds) and the UI dispatchers
 * (ExerciseWidget, StepInput) without needing a DOM.
 */
import { describe, expect, it } from 'vitest'
import { generateExercise, SUPPORTED_SKILLS } from '../../generators'
import type { GeneratedExercise, ScaffoldTier, WidgetSpec } from '../../domain/types'

const KNOWN_WIDGETS: WidgetSpec['type'][] = [
  'dhte-grid',
  'number-line',
  'column-grid',
  'ruler',
  'clock',
  'division-groups',
  'money-tray',
]

const KNOWN_ANSWER_KINDS = ['integer', 'text', 'time', 'quotient-remainder', 'digits', 'money']

const REQUIRED_WIDGET_PROPS: Record<WidgetSpec['type'], string[]> = {
  'dhte-grid': ['number', 'columns'],
  'number-line': ['range', 'jumps'],
  'column-grid': ['operation', 'operands'],
  ruler: ['startMm', 'endMm'],
  clock: ['hours', 'minutes'],
  'division-groups': ['total', 'groupSize', 'mode'],
  'money-tray': ['price', 'paid'],
}

interface Case {
  ex: GeneratedExercise
  tier: ScaffoldTier
}

function allCases(): Case[] {
  const out: Case[] = []
  for (const skill of SUPPORTED_SKILLS) {
    for (const tier of ['S0', 'S1', 'S2', 'S3'] as const) {
      for (const band of ['easier', 'standard', 'harder'] as const) {
        for (let i = 0; i < 6; i++) {
          try {
            out.push({
              tier,
              ex: generateExercise({
                seed: `ui-contract:${skill}:${tier}:${band}:${i}`,
                tier,
                band,
                purpose: 'free',
                primarySkillId: skill,
              }),
            })
          } catch {
            // Constraint-violating requests are legitimately rejected.
          }
        }
      }
    }
  }
  return out
}

function allExercises(): GeneratedExercise[] {
  return allCases().map((c) => c.ex)
}

describe('UI ↔ generator contract', () => {
  it('produces a body of exercises to check', () => {
    expect(allExercises().length).toBeGreaterThan(100)
  })

  it('only emits widget types the UI dispatcher knows, with required props', () => {
    for (const ex of allExercises()) {
      if (!ex.widget) continue
      expect(KNOWN_WIDGETS).toContain(ex.widget.type)
      const required = REQUIRED_WIDGET_PROPS[ex.widget.type]
      for (const key of required) {
        expect(ex.widget.props, `${ex.archetypeId} widget ${ex.widget.type}`).toHaveProperty(key)
      }
    }
  })

  it('only emits answer kinds the step input handles', () => {
    for (const ex of allExercises()) {
      for (const step of ex.steps) {
        expect(KNOWN_ANSWER_KINDS).toContain(step.answerType.kind)
      }
    }
  })

  it('every exercise carries an archetype-specific hint ladder', () => {
    for (const ex of allExercises()) {
      expect(ex.hintsNl, ex.archetypeId).toBeDefined()
      expect(ex.hintsNl!.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('digit-grid steps expose columns via the widget for per-cell inputs', () => {
    const digits = allExercises().filter((ex) => ex.steps.some((s) => s.answerType.kind === 'digits'))
    expect(digits.length).toBeGreaterThan(0)
    for (const ex of digits) {
      expect(ex.widget).not.toBeNull()
      const columns = ex.widget!.props.columns
      expect(Array.isArray(columns)).toBe(true)
      expect((columns as string[]).every((c) => typeof c === 'string' && c.length === 1)).toBe(true)
    }
  })

  it('number-line jumps are ordered, labeled, and within the range', () => {
    const lines = allExercises().filter((ex) => ex.widget?.type === 'number-line')
    expect(lines.length).toBeGreaterThan(0)
    for (const ex of lines) {
      const range = ex.widget!.props.range as [number, number]
      const jumps = ex.widget!.props.jumps as Array<{ from: number; to: number; label: string }>
      expect(range[0]).toBeLessThan(range[1])
      let prev = null as number | null
      for (const j of jumps) {
        expect(typeof j.label).toBe('string')
        expect(j.from).toBeLessThan(j.to)
        expect(j.to).toBeGreaterThan(range[0])
        expect(j.to).toBeLessThanOrEqual(range[1])
        if (prev !== null) expect(j.from).toBe(prev)
        prev = j.to
      }
    }
  })

  it('division groups are only pre-grouped at scaffolded tiers (no answer leak)', () => {
    const cases = allCases().filter((c) => c.ex.widget?.type === 'division-groups')
    expect(cases.length).toBeGreaterThan(0)
    for (const c of cases) {
      const mode = c.ex.widget!.props.mode
      if (c.tier === 'S0' || c.tier === 'S1') {
        expect(mode, `${c.ex.archetypeId} @ ${c.tier}`).toBe('grouped')
      } else {
        expect(mode, `${c.ex.archetypeId} @ ${c.tier}`).toBe('ungrouped')
      }
    }
  })

  it('clock faces are only shown at scaffolded tiers (independent items are verbal-only)', () => {
    const cases = allCases().filter((c) => c.ex.archetypeId === 'clock-reading')
    expect(cases.length).toBeGreaterThan(0)
    for (const c of cases) {
      if (c.tier === 'S0' || c.tier === 'S1') {
        expect(c.ex.widget?.type).toBe('clock')
      } else {
        expect(c.ex.widget).toBeNull()
      }
    }
  })

  it('unparseable answers are flagged as invalid format (never wrong-math evidence)', () => {
    const cases = allCases()
    for (const c of cases) {
      for (const step of c.ex.steps) {
        // Garbage never parses in any answer kind: the generator must
        // distinguish "cannot read this" from "wrong math".
        const v = step.validate('helemaal geen getal')
        expect(v.isCorrect, `${c.ex.archetypeId}/${step.id}`).toBe(false)
        expect(v.invalidFormat, `${c.ex.archetypeId}/${step.id}`).toBe(true)
      }
    }
  })
})