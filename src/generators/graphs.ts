/**
 * Grafieken (blok 2 lesson 15, "eenvoudige diagrammen lezen"): a bar chart
 * of visitors per year or bikes per month, a line graph of dictation words
 * per week, and the questions the book asks about them: read a value,
 * the most/least, the difference, the total, and "fout = 10 − goed".
 */
import type { GeneratedExercise, GeneratedStep } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { choiceStep, intStep, isSupported, isTestFormat, makeExercise } from './kit'

interface Chart { kind: 'bar' | 'line'; title: string; unit: string; labels: string[]; values: number[]; max: number; gridStep: number; context: string }

function barChart(ctx: GeneratorContext, rng: SeededRng): Chart {
  if (rng.bool(0.5)) {
    // Visitors per year, axis to 8000 with lines every 1000 (bars on 500s).
    const gridStep = 1000
    const half = ctx.band !== 'easier'
    const startYear = rng.int(2007, 2015)
    const n = ctx.band === 'easier' ? 5 : 8
    const labels = Array.from({ length: n }, (_, i) => String(startYear + i))
    const values = labels.map(() => rng.int(2, 15) * (half ? 500 : 1000))
    return { kind: 'bar', title: 'aantal bezoekers', unit: 'bezoekers', labels, values: values.map((v) => Math.min(v, 8000)), max: 8000, gridStep, context: 'bezoekers' }
  }
  const labels = ['januari', 'februari', 'maart', 'april', 'mei']
  const values = labels.map(() => rng.int(2, 18) * (ctx.band === 'easier' ? 10 : 5))
  return { kind: 'bar', title: 'verkochte fietsen', unit: 'fietsen', labels, values, max: 100, gridStep: 10, context: 'fietsen' }
}

function lineChart(rng: SeededRng): Chart {
  const labels = ['1', '2', '3', '4', '5'].map((w) => `week ${w}`)
  const values = labels.map(() => rng.int(3, 10))
  return { kind: 'line', title: 'aantal goede woorden', unit: 'woorden', labels, values, max: 10, gridStep: 1, context: 'dictee' }
}

function readStep(chart: Chart, i: number, skill: string, id: string): GeneratedStep {
  const v = chart.values[i]!
  return intStep({
    id, prompt: chart.context === 'dictee' ? `${chart.labels[i]}: … woorden goed` : `${chart.labels[i]}: … ${chart.unit}`, skill, answer: v, unit: chart.unit,
    solution: `${chart.labels[i]}: ${v} ${chart.unit}`,
    wrong: (x) => (x === v / chart.gridStep ? `Eén hokje op de as is ${chart.gridStep}, niet 1.` : Math.abs(x - v) === chart.gridStep / 2 ? 'Staat de staaf precies op een lijn, of halverwege twee lijnen?' : null),
  })
}

function read(ctx: GeneratorContext, rng: SeededRng, kind: 'bar' | 'line'): GeneratedExercise {
  const chart = kind === 'bar' ? barChart(ctx, rng) : lineChart(rng)
  const count = isTestFormat(ctx) ? 3 : 1
  const picks = rng.shuffle(chart.labels.map((_, i) => i)).slice(0, count).sort((a, b) => a - b)
  return makeExercise(ctx, rng, {
    archetypeId: kind === 'bar' ? 'bar-read' : 'line-read',
    instructionNl: isSupported(ctx) ? `Kijk naar de as links: elke lijn is ${chart.gridStep}. Volg de bovenkant van de staaf naar links.` : kind === 'bar' ? BOOK.leesGrafiek : BOOK.bekijkGrafiek,
    steps: picks.map((i, n) => readStep(chart, i, ctx.primarySkillId, `read-${n}`)),
    widget: { type: kind === 'bar' ? 'bar-chart' : 'line-chart', props: { title: chart.title, labels: chart.labels, values: chart.values, max: chart.max, gridStep: chart.gridStep } },
    supportingSkillIds: ['MEAS.SCALE.Interval'],
    representation: 'pictorial',
    variationTags: picks.some((i) => chart.values[i]! % chart.gridStep !== 0) ? ['between-gridlines'] : ['on-gridline'],
    explanationNl: picks.map((i) => `${chart.labels[i]}: ${chart.values[i]} ${chart.unit}.`),
    hintsNl: [`Hoeveel is één lijn op de as? (${chart.gridStep})`, `Zoek ${chart.labels[picks[0]!]} onderaan.`, 'Ga recht omhoog tot de staaf of de punt, en dan recht naar links.'],
    fingerprint: `${kind}:${chart.values.join(',')}:${picks.join(',')}`,
  })
}

function compare(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  // Regenerate until the most and the least are unique, so the questions have one answer.
  const useBar = rng.bool(0.6)
  let chart = useBar ? barChart(ctx, rng) : lineChart(rng)
  const unique = (c: Chart) => {
    const mx = Math.max(...c.values)
    const mn = Math.min(...c.values)
    return c.values.filter((v) => v === mx).length === 1 && c.values.filter((v) => v === mn).length === 1
  }
  for (let i = 0; i < 100 && !unique(chart); i++) chart = useBar ? barChart(ctx, rng) : lineChart(rng)
  if (!unique(chart)) throw new Error('graph-compare: no chart with unique extremes')
  const hi = Math.max(...chart.values)
  const lo = Math.min(...chart.values)
  const hiLabel = chart.labels[chart.values.indexOf(hi)]!
  const loLabel = chart.labels[chart.values.indexOf(lo)]!
  const total = chart.values.reduce((s, v) => s + v, 0)
  const isDictee = chart.context === 'dictee'
  const allSteps: GeneratedStep[] = [
    choiceStep({ id: 'least', prompt: isDictee ? 'In welke week heeft Mischa de meeste fouten gemaakt?' : `Wanneer waren er de minste ${chart.unit}?`, skill: ctx.primarySkillId, options: chart.labels, answer: loLabel, solution: `${loLabel}: ${lo}` }),
    intStep({
      id: 'difference', prompt: isDictee ? 'Hoeveel woorden is het verschil tussen de beste en de slechtste week?' : 'Wat is het verschil tussen de meeste en de minste?', skill: ctx.primarySkillId,
      answer: hi - lo, unit: chart.unit, solution: `${hi} − ${lo} = ${hi - lo}`,
      wrong: (v) => (v === hi + lo ? 'Verschil betekent: hoeveel meer. Dat is een min-som.' : null),
    }),
    isDictee
      ? intStep({ id: 'wrong-total', prompt: 'Hoeveel woorden heeft Mischa in 5 dictees fout geschreven?', skill: ctx.primarySkillId, answer: 50 - total, unit: 'woorden', solution: `5 × 10 = 50 woorden; ${total} goed, dus ${50 - total} fout` })
      : intStep({ id: 'total', prompt: `Hoeveel ${chart.unit} zijn het in totaal?`, skill: ctx.primarySkillId, answer: total, unit: chart.unit, solution: `${chart.values.join(' + ')} = ${total}` }),
  ]
  const steps = isTestFormat(ctx) ? allSteps : isSupported(ctx) ? [allSteps[0]!, allSteps[1]!] : [allSteps[rng.int(1, 2)]!]
  return makeExercise(ctx, rng, {
    archetypeId: 'graph-compare',
    instructionNl: isDictee ? `${BOOK.bekijkGrafiek} Mischa krijgt elke week een dictee met 10 woorden.` : BOOK.leesGrafiek,
    steps,
    widget: { type: chart.kind === 'bar' ? 'bar-chart' : 'line-chart', props: { title: chart.title, labels: chart.labels, values: chart.values, max: chart.max, gridStep: chart.gridStep } },
    supportingSkillIds: [chart.kind === 'bar' ? 'DATA.GRAPH.ReadBar' : 'DATA.GRAPH.ReadLine'],
    representation: 'pictorial',
    variationTags: ['difference', ...(isDictee ? ['complement'] : ['total'])],
    explanationNl: [`Hoogste: ${hiLabel} (${hi}). Laagste: ${loLabel} (${lo}). Verschil: ${hi - lo}.`, isDictee ? `Goed samen: ${total}, fout: ${50 - total}.` : `Totaal: ${total}.`],
    hintsNl: ['Lees eerst alle waarden af en schrijf ze op.', 'Verschil = grootste − kleinste.', isDictee ? 'Fout = 10 − goed, per week.' : 'Totaal = alles bij elkaar opgeteld.'],
    fingerprint: `gcmp:${chart.kind}:${chart.values.join(',')}`,
  })
}

export function generateGraphs(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  switch (ctx.primarySkillId) {
    case 'DATA.GRAPH.ReadBar': return read(ctx, rng, 'bar')
    case 'DATA.GRAPH.ReadLine': return read(ctx, rng, 'line')
    case 'DATA.GRAPH.Compare': return compare(ctx, rng)
    default: throw new Error(`graphs: unsupported skill ${ctx.primarySkillId}`)
  }
}

export const GRAPH_SKILLS = ['DATA.GRAPH.ReadBar', 'DATA.GRAPH.ReadLine', 'DATA.GRAPH.Compare']
