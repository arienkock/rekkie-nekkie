/**
 * Kalender: months, quarters and years (CAL.UNIT.MonthQuarterYear), month
 * lengths with an explicit year (CAL.DATE.MonthLength) and moving dates and
 * weekdays across month and year boundaries (CAL.DATE.Navigate). Real
 * calendar arithmetic in UTC, so a leap year is a leap year.
 */
import type { GeneratedExercise } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { choiceStep, intStep, isSupported, makeExercise, shuffleOptions } from './kit'

export const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
export const WEEKDAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
const dateText = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`

function units(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const items = [
    { prompt: '1 jaar = … maanden', answer: 12 },
    { prompt: '1 jaar = … kwartalen', answer: 4 },
    { prompt: '1 kwartaal = … maanden', answer: 3 },
    { prompt: '1 week = … dagen', answer: 7 },
    { prompt: 'een half jaar = … maanden', answer: 6 },
    { prompt: '1 jaar heeft ongeveer … weken', answer: 52 },
    ...(ctx.band !== 'easier' ? [
      { prompt: '2 jaar = … maanden', answer: 24 },
      { prompt: '3 kwartalen = … maanden', answer: 9 },
      { prompt: '4 weken = … dagen', answer: 28 },
    ] : []),
  ]
  const item = rng.pick(items)
  return makeExercise(ctx, rng, {
    archetypeId: 'calendar-units',
    instructionNl: BOOK.vulIn,
    steps: [intStep({ id: 'answer', prompt: item.prompt, skill: ctx.primarySkillId, answer: item.answer, solution: item.prompt.replace('…', String(item.answer)) })],
    widget: null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: [item.prompt.includes('weken') ? 'approximate-weeks' : 'exact'],
    explanationNl: [item.prompt.replace('…', String(item.answer)), '1 jaar = 12 maanden = 4 kwartalen. Een jaar heeft 52 weken en nog 1 of 2 dagen.'],
    hintsNl: ['Tel de maanden op je vingers.', 'Een kwartaal is een kwart jaar.', 'Een jaar heeft 365 dagen; dat is 52 weken en 1 dag.'],
    fingerprint: `calunit:${item.prompt}`,
  })
}

function monthLength(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const year = rng.pick([2026, 2027, 2028])
  const month = ctx.band === 'harder' && rng.bool(0.4) ? 1 : rng.int(0, 11)
  const n = daysIn(year, month)
  const boundary = ctx.band !== 'easier' && rng.bool(0.5)
  if (boundary) {
    const next = new Date(Date.UTC(year, month, n + 1))
    const answer = dateText(next)
    return makeExercise(ctx, rng, {
      archetypeId: 'month-boundary',
      instructionNl: BOOK.kiesAntwoord,
      steps: [choiceStep({
        id: 'next', prompt: `Welke datum is de dag na ${n} ${MONTHS[month]} ${year}?`, skill: ctx.primarySkillId,
        options: shuffleOptions(rng, answer, [`${n + 1} ${MONTHS[month]}`, `31 ${MONTHS[month]}`, `2 ${MONTHS[(month + 1) % 12]}`]),
        answer, solution: `${MONTHS[month]} ${year} heeft ${n} dagen, dus daarna komt ${answer}.`,
        wrong: (v) => (v.startsWith(String(n + 1)) || v.startsWith('31') ? `${MONTHS[month]} heeft maar ${n} dagen.` : null),
      })],
      widget: { type: 'calendar', props: { year, month, highlight: n } },
      supportingSkillIds: [],
      representation: 'pictorial',
      variationTags: ['month-boundary'],
      explanationNl: [`${MONTHS[month]} ${year} heeft ${n} dagen. De dag na ${n} ${MONTHS[month]} is ${answer}.`],
      hintsNl: ['Hoeveel dagen heeft deze maand?', 'Kijk op de kalender naar de laatste dag.', 'Na de laatste dag begint de volgende maand bij 1.'],
      fingerprint: `mboundary:${year}-${month}`,
    })
  }
  return makeExercise(ctx, rng, {
    archetypeId: 'month-length',
    instructionNl: BOOK.vulIn,
    steps: [intStep({
      id: 'days', prompt: `${MONTHS[month]} ${year} heeft … dagen`, skill: ctx.primarySkillId, answer: n, solution: `${n} dagen`,
      wrong: (v) => (month === 1 ? `Kijk of ${year} een schrikkeljaar is: dan heeft februari 29 dagen, anders 28.` : v === 31 || v === 30 ? 'Gebruik de knokkels van je hand: op een knokkel 31 dagen, in een kuiltje 30 (februari 28 of 29).' : null),
    })],
    widget: isSupported(ctx) ? { type: 'calendar', props: { year, month, highlight: null } } : null,
    supportingSkillIds: [],
    representation: isSupported(ctx) ? 'pictorial' : 'symbolic',
    variationTags: [month === 1 ? 'february' : 'month'],
    explanationNl: [`${MONTHS[month]} ${year} heeft ${n} dagen.`],
    hintsNl: ['Tel op je knokkels: januari op een knokkel, februari in een kuiltje …', 'Op een knokkel: 31 dagen. In een kuiltje: 30 dagen.', 'Februari heeft 28 dagen, in een schrikkeljaar 29.'],
    fingerprint: `mlen:${year}-${month}`,
  })
}

function navigate(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const yearBoundary = ctx.band === 'harder' && rng.bool(0.4)
  const year = 2026
  const month = yearBoundary ? 11 : rng.int(0, 10)
  const n = daysIn(year, month)
  const day = rng.int(Math.max(1, n - 6), n)
  const start = new Date(Date.UTC(year, month, day))
  // Bigger steps above the easier band always cross into the next month.
  const delta = ctx.band === 'easier' ? rng.int(2, 5) : rng.int(n - day + 1, n - day + 8)
  const end = new Date(Date.UTC(year, month, day + delta))
  const answer = dateText(end)
  const weekday = WEEKDAYS[end.getUTCDay()]!
  return makeExercise(ctx, rng, {
    archetypeId: 'date-navigate',
    instructionNl: `Het is ${WEEKDAYS[start.getUTCDay()]} ${dateText(start)} ${year}. ${BOOK.kiesAntwoord}`,
    steps: [
      choiceStep({
        id: 'date', prompt: `Welke datum is het over ${delta} dagen?`, skill: ctx.primarySkillId,
        options: shuffleOptions(rng, answer, [`${day + delta} ${MONTHS[month]}`, dateText(new Date(Date.UTC(year, month, day + delta + 1))), dateText(new Date(Date.UTC(year, month, day + delta - 1)))]),
        answer, solution: `${dateText(start)} + ${delta} dagen = ${answer}${end.getUTCFullYear() !== year ? ` ${end.getUTCFullYear()}` : ''}`,
        wrong: (v) => (v === `${day + delta} ${MONTHS[month]}` ? `${MONTHS[month]} heeft maar ${n} dagen. Tel door in de volgende maand.` : null),
      }),
      choiceStep({
        id: 'weekday', prompt: 'Welke dag van de week is dat?', skill: ctx.primarySkillId, options: [...WEEKDAYS.slice(1), WEEKDAYS[0]!], answer: weekday,
        solution: `${delta} dagen na ${WEEKDAYS[start.getUTCDay()]} is het ${weekday}`,
      }),
    ],
    widget: isSupported(ctx) ? { type: 'calendar', props: { year, month, highlight: day } } : null,
    supportingSkillIds: ['CAL.DATE.MonthLength'],
    representation: isSupported(ctx) ? 'pictorial' : 'symbolic',
    variationTags: [
      end.getUTCFullYear() !== year ? 'year-boundary' : end.getUTCMonth() !== month ? 'month-boundary' : 'same-month',
    ],
    explanationNl: [`${dateText(start)} + ${delta} dagen = ${answer}. Na 7 dagen is het weer dezelfde dag van de week.`],
    hintsNl: [`Hoeveel dagen heeft ${MONTHS[month]}?`, 'Tel door tot het einde van de maand en dan verder vanaf 1.', '7 dagen later is het weer dezelfde weekdag.'],
    fingerprint: `nav:${start.toISOString().slice(0, 10)}+${delta}`,
  })
}

export function generateCalendar(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  switch (ctx.primarySkillId) {
    case 'CAL.UNIT.MonthQuarterYear': return units(ctx, rng)
    case 'CAL.DATE.MonthLength': return monthLength(ctx, rng)
    case 'CAL.DATE.Navigate': return navigate(ctx, rng)
    default: throw new Error(`calendar: unsupported skill ${ctx.primarySkillId}`)
  }
}

export const CALENDAR_SKILLS = ['CAL.UNIT.MonthQuarterYear', 'CAL.DATE.MonthLength', 'CAL.DATE.Navigate']
