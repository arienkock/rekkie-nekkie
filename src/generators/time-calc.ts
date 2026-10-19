/**
 * Tijd beyond the Dutch phrases: 1 uur = 60 minuten, reading where the
 * hour hand is, 24-hour digital time, "Over een kwartier is het …" and
 * "Anderhalf uur geleden was het …" (blok 2 lesson 5, exercise 10),
 * durations ("Hoelang is ze weg geweest?") and timetables.
 */
import type { GeneratedExercise, GeneratedStep } from '../domain/types'
import { BOOK } from '../domain/book-wording'
import { formatDigital, formatDigital12, fromMinuteOfDay, toDutchVerbalTime } from '../domain/dutch-time'
import { SeededRng } from '../engine/rng'
import type { GeneratorContext } from './types'
import { choiceStep, intStep, isSupported, isTestFormat, makeExercise, timeStep } from './kit'

const digital = (m: number) => formatDigital(fromMinuteOfDay(m))

function hourMinute(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const items = [
    { prompt: '1 uur = … minuten', answer: 60 },
    { prompt: 'een kwartier = … minuten', answer: 15 },
    { prompt: 'een half uur = … minuten', answer: 30 },
    { prompt: 'drie kwartier = … minuten', answer: 45 },
    { prompt: 'anderhalf uur = … minuten', answer: 90 },
    { prompt: '2 uur = … minuten', answer: 120 },
    ...(ctx.band !== 'easier' ? [
      { prompt: '2 uur en 15 minuten = … minuten', answer: 135 },
      { prompt: '90 minuten = 1 uur en … minuten', answer: 30 },
      { prompt: '150 minuten = 2 uur en … minuten', answer: 30 },
      { prompt: '3 uur = … minuten', answer: 180 },
    ] : []),
  ]
  const item = rng.pick(items)
  return makeExercise(ctx, rng, {
    archetypeId: 'hour-minute',
    instructionNl: BOOK.vulIn,
    steps: [intStep({
      id: 'answer', prompt: item.prompt, skill: ctx.primarySkillId, answer: item.answer, solution: item.prompt.replace('…', String(item.answer)),
      wrong: (v) => (v === item.answer / 60 * 100 || v === 100 || v === item.answer + 40
        ? { feedbackNl: 'Een uur heeft 60 minuten, niet 100. De klok telt anders dan gewone getallen.', misconceptionId: 'MC.TIME.HundredMinutes' }
        : null),
    })],
    widget: isSupported(ctx) ? { type: 'clock', props: { hours: 12, minutes: 0 } } : null,
    supportingSkillIds: [],
    representation: 'symbolic',
    variationTags: ['sixty'],
    explanationNl: [item.prompt.replace('…', String(item.answer)), '1 uur = 60 minuten, een kwartier = 15 minuten.'],
    hintsNl: ['Een uur heeft 60 minuten.', 'Een kwartier is een vierde uur: 15 minuten.', 'Tel de uren en de minuten apart en dan samen.'],
    fingerprint: `hm:${item.prompt}`,
  })
}

function hourProgress(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const nearHour = ctx.band !== 'easier' && rng.bool(0.6)
  const hours = rng.int(1, 12)
  const minutes = nearHour ? rng.pick([40, 45, 50, 55]) : rng.pick([5, 10, 15, 20, 25, 30, 35])
  const m = (hours % 12) * 60 + minutes
  const steps: GeneratedStep[] = [
    ...(isSupported(ctx) ? [choiceStep({
      id: 'passed', prompt: 'Welk uur is al voorbij? (kijk naar de kleine wijzer)', skill: ctx.primarySkillId, role: 'supporting',
      options: [`${hours} uur`, `${hours === 12 ? 1 : hours + 1} uur`], answer: `${hours} uur`,
      solution: `De kleine wijzer is net voorbij de ${hours}.`, reveals: false,
      wrong: () => ({ feedbackNl: 'De kleine wijzer staat bijna bij dat getal, maar is er nog niet. Welk getal is hij net voorbij?', misconceptionId: 'MC.TIME.HourHandRounded' }),
    })] : []),
    timeStep({
      id: 'time', prompt: 'Hoe laat is het?', skill: ctx.primarySkillId, minuteOfDay: m, solution: formatDigital12(fromMinuteOfDay(m)),
      wrong: (v) => (Math.floor(v / 60) % 12 === (hours + 1) % 12 && v % 60 === minutes
        ? { feedbackNl: 'De kleine wijzer is bijna bij het volgende uur, maar dat uur is nog niet begonnen.', misconceptionId: 'MC.TIME.HourHandRounded' }
        : null),
    }),
  ]
  return makeExercise(ctx, rng, {
    archetypeId: 'hour-progress',
    instructionNl: isSupported(ctx) ? 'Kijk eerst naar de kleine wijzer: welk uur is voorbij? Dan de grote wijzer.' : BOOK.hoeLaat,
    steps,
    widget: { type: 'clock', props: { hours: hours % 12, minutes } },
    supportingSkillIds: ['TIME.READ.MinuteFive'],
    representation: 'pictorial',
    variationTags: [nearHour ? 'near-hour' : 'early-hour'],
    explanationNl: [`De kleine wijzer is voorbij de ${hours} en de grote wijzer staat op ${minutes} minuten: ${formatDigital12(fromMinuteOfDay(m))}.`],
    hintsNl: ['De kleine wijzer wijst het uur aan dat al begonnen is.', 'Staat hij tussen twee getallen? Kies het kleinste (het uur dat voorbij is).', 'Lees dan de minuten af met de grote wijzer.'],
    fingerprint: `hprog:${m}`,
  })
}

function dayPart(h: number): string {
  return h < 6 ? "'s nachts" : h < 12 ? "'s ochtends" : h < 18 ? "'s middags" : "'s avonds"
}

function digital24(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const evening = ctx.band !== 'easier' && rng.bool(0.5)
  const h = evening ? rng.int(18, 23) : rng.int(13, 17)
  const minutes = rng.pick([0, 15, 30, 45, 10, 50, 5, 25, 35])
  const m = h * 60 + minutes
  const phrase = toDutchVerbalTime(fromMinuteOfDay(m))
  // "half 6 's avonds" belongs to the hour before: use the actual hour for the day part.
  return makeExercise(ctx, rng, {
    archetypeId: 'digital-24',
    instructionNl: isSupported(ctx) ? `Na 12 uur 's middags tel je verder: 1 uur 's middags is 13:00.` : BOOK.vulDigitaleTijd,
    steps: [timeStep({
      id: 'time', prompt: `${phrase} ${dayPart(h)} =`, skill: ctx.primarySkillId, minuteOfDay: m, strict24: true,
      solution: digital(m),
      wrong: (v) => (v === m - 720 ? { feedbackNl: `Het is ${dayPart(h)}: tel 12 uur erbij. ${formatDigital12(fromMinuteOfDay(m))} wordt ${digital(m)}.`, misconceptionId: 'MC.TIME.TwelveHourOnly' } : null),
    })],
    widget: isSupported(ctx) ? { type: 'clock', props: { hours: h % 12, minutes } } : null,
    supportingSkillIds: ['TIME.READ.DutchHalfNextHour'],
    representation: 'symbolic',
    variationTags: [evening ? 'evening' : 'afternoon'],
    explanationNl: [`${phrase} ${dayPart(h)} is ${digital(m)}.`],
    hintsNl: ['Welk uur is het op de klok?', `Is het na 12 uur 's middags? Tel dan 12 bij het uur op.`, `Bijvoorbeeld: 3 uur 's middags = 15:00.`],
    fingerprint: `d24:${m}`,
  })
}

const OFFSETS = [
  { words: 'Over tien minuten is het', delta: 10 },
  { words: 'Over een kwartier is het', delta: 15 },
  { words: 'Over veertig minuten is het', delta: 40 },
  { words: 'Over drie kwartier is het', delta: 45 },
  { words: 'Een half uur geleden was het', delta: -30 },
  { words: 'Anderhalf uur geleden was het', delta: -90 },
  { words: 'Over een half uur is het', delta: 30 },
  { words: 'Tien minuten geleden was het', delta: -10 },
]

function offset(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const start = rng.int(7, 17) * 60 + rng.pick([5, 10, 20, 35, 40, 45, 50, 55])
  const count = isTestFormat(ctx) ? 3 : 1
  const offsets = rng.shuffle(ctx.band === 'easier' ? OFFSETS.filter((o) => Math.abs(o.delta) <= 30) : OFFSETS).slice(0, count)
  const steps = offsets.map((o, i) => timeStep({
    id: `offset-${i}`, prompt: `${o.words} …`, skill: ctx.primarySkillId, minuteOfDay: start + o.delta, solution: digital(start + o.delta),
    wrong: (v) => (v % 60 === (start + o.delta + 1440) % 60 && Math.floor(v / 60) % 12 === Math.floor(start / 60) % 12
      ? { feedbackNl: 'De minuten kloppen, maar ga je over het hele uur heen? Dan verandert het uur ook.', misconceptionId: 'MC.TIME.HourBoundary' }
      : v === start - o.delta ? 'Over is later, geleden is eerder.' : null),
  }))
  const crosses = offsets.some((o) => Math.floor((start + o.delta) / 60) !== Math.floor(start / 60))
  return makeExercise(ctx, rng, {
    archetypeId: 'time-offset',
    instructionNl: `${BOOK.vulDigitaleTijd} Het is nu ${digital(start)}.`,
    steps,
    widget: { type: 'clock', props: { hours: Math.floor(start / 60) % 12, minutes: start % 60 } },
    supportingSkillIds: ['TIME.UNIT.HourMinute'],
    representation: 'pictorial',
    variationTags: [crosses ? 'hour-boundary' : 'within-hour'],
    explanationNl: offsets.map((o) => `${o.words} ${digital(start + o.delta)}.`),
    hintsNl: ['Over = later, geleden = eerder.', 'Tel eerst door tot het hele uur.', 'Een uur heeft 60 minuten.'],
    fingerprint: `offset:${start}:${offsets.map((o) => o.delta).join(',')}`,
  })
}

function elapsed(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const nextDay = ctx.band === 'harder' && rng.bool(0.5)
  const start = nextDay ? rng.int(20, 22) * 60 + rng.pick([15, 30, 45]) : rng.int(7, 14) * 60 + rng.pick([5, 10, 20, 35, 40, 50])
  // A next-day item really ends after midnight.
  const dur = nextDay
    ? 24 * 60 - start + rng.int(0, 2) * 60 + rng.pick([15, 30, 45])
    : rng.int(1, 4) * 60 + rng.pick([0, 5, 10, 20, 25, 35, 40, 55])
  const end = start + dur
  const hours = Math.floor(dur / 60)
  const mins = dur % 60
  const name = rng.pick(['Sarah', 'Timo', 'Fleur', 'Ilyas'])
  const endText = nextDay ? `${digital(end)} de volgende dag` : digital(end)
  return makeExercise(ctx, rng, {
    archetypeId: 'time-elapsed',
    instructionNl: `${BOOK.rekenUit} ${name} vertrekt om ${digital(start)} en komt om ${endText} terug. Hoelang is ${name} weg geweest?`,
    steps: [
      intStep({ id: 'hours', prompt: '… uur', skill: ctx.primarySkillId, answer: hours, solution: `${hours} uur en ${mins} minuten` }),
      intStep({
        id: 'minutes', prompt: 'en … minuten', skill: ctx.primarySkillId, answer: mins, solution: `${hours} uur en ${mins} minuten`,
        wrong: (v) => (v === (100 + (end % 60) - (start % 60)) % 100 ? { feedbackNl: 'Een uur heeft 60 minuten. Tel via het hele uur.', misconceptionId: 'MC.TIME.HundredMinutes' } : null),
      }),
    ],
    widget: null,
    supportingSkillIds: ['TIME.CALC.Offset'],
    representation: 'story',
    variationTags: [nextDay ? 'next-day' : 'hour-boundary'],
    explanationNl: [`Van ${digital(start)} tot ${digital(Math.ceil(start / 60) * 60)} is ${(60 - (start % 60)) % 60} minuten. Daarna verder tot ${digital(end)}: samen ${hours} uur en ${mins} minuten.`],
    hintsNl: ['Tel eerst door tot het volgende hele uur.', 'Tel dan de hele uren.', 'Tel de minuten die overblijven erbij.'],
    fingerprint: `elapsed:${start}:${dur}`,
  })
}

function schedule(ctx: GeneratorContext, rng: SeededRng): GeneratedExercise {
  const stops = ['Station', 'Kerkplein', 'Markt', 'Ziekenhuis', 'Sportpark']
  const departures = [0, 1, 2].map((i) => 7 * 60 + 10 + i * rng.pick([15, 20, 30]) + rng.int(0, 1) * 5)
  const legs = [rng.int(3, 9), rng.int(4, 12), rng.int(3, 10), rng.int(5, 12)]
  const rows = stops.map((stop, s) => ({ stop, times: departures.map((d) => digital(d + legs.slice(0, s).reduce((a, b) => a + b, 0))) }))
  const bus = rng.int(0, 2)
  const from = rng.int(0, 2)
  const to = rng.int(from + 1, 4)
  const dur = legs.slice(from, to).reduce((a, b) => a + b, 0)
  return makeExercise(ctx, rng, {
    archetypeId: 'timetable',
    instructionNl: 'Bekijk de dienstregeling.',
    steps: [intStep({
      id: 'duration', prompt: `Hoeveel minuten doet bus ${bus + 1} over de rit van ${stops[from]} naar ${stops[to]}?`, skill: ctx.primarySkillId,
      answer: dur, unit: 'minuten', solution: `${rows[to]!.times[bus]} − ${rows[from]!.times[bus]} = ${dur} minuten`,
      wrong: (v) => (v === legs[from] ? 'Je keek naar de volgende halte. Zoek de rij van ' + stops[to] + '.' : 'Kijk alleen naar de kolom van bus ' + (bus + 1) + ' en de rijen van de twee haltes.'),
    })],
    widget: { type: 'timetable', props: { columns: departures.map((_, i) => `Bus ${i + 1}`), rows } },
    supportingSkillIds: ['TIME.CALC.Elapsed'],
    representation: 'pictorial',
    variationTags: ['irrelevant-row'],
    explanationNl: [`Bus ${bus + 1}: ${stops[from]} ${rows[from]!.times[bus]}, ${stops[to]} ${rows[to]!.times[bus]}. Dat is ${dur} minuten.`],
    hintsNl: [`Zoek de kolom van bus ${bus + 1}.`, `Zoek de rijen van ${stops[from]} en ${stops[to]}. De andere rijen heb je niet nodig.`, 'Reken het verschil tussen de twee tijden uit.'],
    fingerprint: `sched:${departures.join(',')}:${bus}:${from}-${to}`,
  })
}

export function generateTimeCalc(ctx: GeneratorContext): GeneratedExercise {
  const rng = new SeededRng(ctx.seed)
  switch (ctx.primarySkillId) {
    case 'TIME.UNIT.HourMinute': return hourMinute(ctx, rng)
    case 'TIME.READ.HourProgress': return hourProgress(ctx, rng)
    case 'TIME.READ.Digital24': return digital24(ctx, rng)
    case 'TIME.CALC.Offset': return offset(ctx, rng)
    case 'TIME.CALC.Elapsed': return elapsed(ctx, rng)
    case 'TIME.SCHEDULE.SelectInterval': return schedule(ctx, rng)
    default: throw new Error(`time-calc: unsupported skill ${ctx.primarySkillId}`)
  }
}

export const TIME_CALC_SKILLS = [
  'TIME.UNIT.HourMinute', 'TIME.READ.HourProgress', 'TIME.READ.Digital24', 'TIME.CALC.Offset', 'TIME.CALC.Elapsed', 'TIME.SCHEDULE.SelectInterval',
]
