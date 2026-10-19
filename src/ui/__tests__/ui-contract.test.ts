/**
 * UI contract test: every exercise the generators can produce must be
 * renderable by the React components. Guards the wiring between
 * generators (WidgetSpec props, AnswerType kinds) and the UI dispatchers
 * (ExerciseWidget, StepInput) without needing a DOM.
 */
import { describe, expect, it } from 'vitest'
import { generateExercise, generateTestBlockFor, SUPPORTED_SKILLS } from '../../generators'
import type { GeneratedExercise, ScaffoldTier, WidgetSpec } from '../../domain/types'

const KNOWN_WIDGETS: WidgetSpec['type'][] = [
  'multiplication-array',
  'dhte-grid',
  'number-line',
  'column-grid',
  'ruler',
  'clock',
  'division-groups',
  'money-tray',
  'bar-chart',
  'line-chart',
  'receipt',
  'beaker',
  'scale-dial',
  'calendar',
  'timetable',
  'coins',
  'bar-model',
  'pyramid',
  'split-table',
]

const KNOWN_ANSWER_KINDS = ['integer', 'text', 'time', 'quotient-remainder', 'digits', 'money', 'choice', 'counts']

const REQUIRED_WIDGET_PROPS: Record<WidgetSpec['type'], string[]> = {
  'multiplication-array': ['rows', 'columns', 'split'],
  'dhte-grid': ['number', 'columns'],
  'number-line': ['range'],
  'column-grid': ['operation', 'operands'],
  ruler: ['startMm', 'endMm'],
  clock: ['hours', 'minutes'],
  'division-groups': ['total', 'groupSize', 'mode'],
  'money-tray': ['price', 'paid'],
  'bar-chart': ['title', 'labels', 'values', 'max', 'gridStep'],
  'line-chart': ['title', 'labels', 'values', 'max', 'gridStep'],
  receipt: ['items'],
  beaker: ['max', 'tickStep', 'level', 'unit'],
  'scale-dial': ['max', 'tickStep', 'labelEvery', 'value', 'unit'],
  calendar: ['year', 'month', 'highlight'],
  timetable: ['columns', 'rows'],
  coins: ['items'],
  'bar-model': [],
  pyramid: ['rows'],
  'split-table': ['factor', 'parts'],
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

/** One test-format block per skill and band (S3 items merged, per-step widgets). */
function allBlocks(): GeneratedExercise[] {
  return SUPPORTED_SKILLS.flatMap((skill) => (['easier', 'standard', 'harder'] as const).map((band) =>
    generateTestBlockFor({ seed: `ui-block:${skill}:${band}`, tier: 'S3', band, purpose: 'free', primarySkillId: skill })))
}

describe('UI ↔ generator contract', () => {
  it('produces a body of exercises to check', () => {
    expect(allExercises().length).toBeGreaterThan(100)
  })

  it('only emits widget types the UI dispatcher knows, with required props', () => {
    for (const ex of [...allExercises(), ...allBlocks()]) {
      const widgets = [ex.widget, ...ex.steps.map((s) => s.widget)].filter((w): w is WidgetSpec => !!w)
      for (const widget of widgets) {
        expect(KNOWN_WIDGETS).toContain(widget.type)
        for (const key of REQUIRED_WIDGET_PROPS[widget.type]) {
          expect(widget.props, `${ex.archetypeId} widget ${widget.type}`).toHaveProperty(key)
        }
      }
    }
  })

  it('choice steps offer their answer among distinct options', () => {
    for (const ex of allExercises()) {
      for (const step of ex.steps) {
        if (step.answerType.kind !== 'choice') continue
        expect(step.answerType.options).toContain(step.expected)
        expect(new Set(step.answerType.options).size).toBe(step.answerType.options.length)
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

  it('every exercise carries an archetype-specific hint ladder (except the test format, which has none)', () => {
    for (const { ex, tier } of allCases()) {
      if (tier === 'S3') continue
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
      // Addition jumps forward, subtraction backward — never both in one line.
      const directions = new Set((jumps ?? []).map((j) => Math.sign(j.to - j.from)))
      expect(directions.size).toBeLessThanOrEqual(1)
      for (const j of jumps ?? []) {
        expect(typeof j.label).toBe('string')
        expect(j.from).not.toBe(j.to)
        expect(j.to).toBeGreaterThanOrEqual(range[0])
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