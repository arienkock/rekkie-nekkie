/**
 * The learning path: bloks → lessons → skills, in the order of the
 * workbook (Getal & Ruimte Junior groep 6). Blok 2 follows the table of
 * contents and lesson goals ("Je leert …") of the photographed workbook.
 * Blok 1 is not photographed: it gathers what blok 2's "Weet je nog?"
 * lessons review and the groep 5/6 foundations the blok 2 skills build on,
 * so every skill in the knowledge graph has a place on the path.
 */
import type { LearnerSkillState, SkillId } from './types'

export interface PathLesson {
  id: string
  /** As in the book: "Les 3 Vermenigvuldigen – oefenen". */
  titleNl: string
  /** The lesson's "Je leert" line. */
  goalNl: string
  skills: SkillId[]
}

export interface PathBlok {
  id: string
  titleNl: string
  /** Where the content comes from, shown to parents. */
  sourceNl: string
  lessons: PathLesson[]
}

const TABLES = Array.from({ length: 10 }, (_, i) => `MUL.FACT.T${i + 1}`)

export const LEARNING_PATH: PathBlok[] = [
  {
    id: 'blok-1',
    titleNl: 'Blok 1 · Basis en herhaling',
    sourceNl: 'Samengesteld uit de herhaling in blok 2 (Weet je nog?) en de basis uit groep 5. Nog niet gecontroleerd met het blok 1-boek.',
    lessons: [
      {
        id: '1.1', titleNl: 'Getallen tot 10 000', goalNl: 'getallen splitsen, de waarde van cijfers, getallen op de getallenlijn en vergelijken.',
        skills: ['FND.COUNT.Group', 'PV.DHTE.Identify', 'PV.DHTE.Decompose', 'PV.DHTE.Compose', 'PV.DHTE.Exchange', 'NUM.LINE.Interval', 'NUM.LINE.Position', 'NUM.COMPARE.Symbols', 'NUM.SEQ.Step'],
      },
      {
        id: '1.2', titleNl: 'Optellen en aftrekken', goalNl: 'optellen en aftrekken tot 1000 met sprongen, en de omgekeerde som.',
        skills: ['FND.FACT.AddWithin20', 'FND.FACT.SubWithin20', 'REL.ADD.Inverse', 'ADD.JUMP.NoBridge', 'ADD.JUMP.TenBridge', 'ADD.JUMP.HundredBridge', 'SUB.JUMP.NoBridge', 'SUB.JUMP.TenBridge', 'SUB.JUMP.HundredBridge', 'REL.ADD.MissingPart'],
      },
      {
        id: '1.3', titleNl: 'Cijferend optellen en aftrekken', goalNl: 'onder elkaar optellen en aftrekken, schat eerst het antwoord.',
        skills: ['ADD.COLUMN.Align', 'ADD.COLUMN.Carry', 'SUB.COLUMN.Align', 'SUB.COLUMN.BorrowCrossout', 'SUB.COLUMN.BorrowAcrossZero', 'META.CHECK.EstimateInverse'],
      },
      {
        id: '1.4', titleNl: 'Tafels en delen', goalNl: 'de tafels en deeltafels tot en met 10, delen met rest.',
        skills: ['MUL.GROUP.Array', ...TABLES, 'DIV.GROUP.EqualShare', 'DIV.FACT.Inverse', 'DIV.SCALE.CancelFactor', 'DIV.REMAINDER.Compute', 'DIV.REMAINDER.LeftoverUnit', 'DIV.REMAINDER.CeilContext', 'DIV.REMAINDER.FloorContext'],
      },
      {
        id: '1.5', titleNl: 'Meten', goalNl: 'lengte, gewicht en inhoud: maten kennen, omrekenen en aflezen.',
        skills: ['MEAS.UNIT.Select', 'MEAS.LENGTH.Anchor', 'MEAS.MASS.Anchor', 'MEAS.CAPACITY.Anchor', 'MEAS.LENGTH.Convert', 'MEAS.MASS.Convert', 'MEAS.CAPACITY.Convert', 'MEAS.MIXED.ComposeSplit', 'MEAS.COMPARE.Normalize', 'MEAS.RULER.ZeroStart', 'MEAS.RULER.Offset', 'MEAS.SCALE.Interval', 'MEAS.BEAKER.Read', 'MEAS.MASS.ReadScale', 'MEAS.CONTEXT.CombineLimit'],
      },
      {
        id: '1.6', titleNl: 'Klokkijken en kalender', goalNl: 'klokkijken, tijd erbij en eraf, hoe lang iets duurt en de kalender.',
        skills: ['TIME.UNIT.HourMinute', 'TIME.READ.MinuteFive', 'TIME.READ.HourProgress', 'TIME.READ.DutchHourQuarter', 'TIME.READ.DutchHourOffset', 'TIME.READ.DutchHalfNextHour', 'TIME.READ.DutchPhrasingHalfHourOffset', 'TIME.READ.Digital24', 'TIME.CALC.Offset', 'TIME.CALC.Elapsed', 'TIME.SCHEDULE.SelectInterval', 'CAL.UNIT.MonthQuarterYear', 'CAL.DATE.MonthLength', 'CAL.DATE.Navigate'],
      },
      {
        id: '1.7', titleNl: 'Het stappenplan en de opdrachten', goalNl: 'verhaaltjessommen met het stappenplan, en weten wat een opdracht vraagt.',
        skills: ['META.INSTRUCTION.Read', 'META.MODEL.Quantity', 'META.EQUATION.Select', 'META.ANSWER.Unit'],
      },
    ],
  },
  {
    id: 'blok-2',
    titleNl: 'Blok 2 · Vermenigvuldigen en geld',
    sourceNl: 'Getal & Ruimte Junior groep 6, blok 2 (bladzijde 6–82), lesdoelen uit het werkboek.',
    lessons: [
      { id: '2-1', titleNl: 'Les 1 Vermenigvuldigen – voorbereiden', goalNl: 'getallen tot 10 000. schatten van antwoorden.', skills: ['NUM.LINE.Position', 'PV.DHTE.Decompose', 'MUL.SCALE.OneFactor', 'MUL.SCALE.TwoFactors', 'MUL.ESTIMATE.Friendly'] },
      { id: '2-2', titleNl: 'Les 2 Vermenigvuldigen – oefenen', goalNl: 'vermenigvuldigen zoals 3 x 125.', skills: ['PV.SCALE.TenHundred', 'MUL.SCALE.OneFactor', 'MUL.SPLIT.Distribute'] },
      { id: '2-3', titleNl: 'Les 3 Vermenigvuldigen – oefenen', goalNl: 'cijferend vermenigvuldigen zoals 3 x 295.', skills: ['MUL.COLUMN.PartialProducts', 'MUL.COLUMN.Carry', 'MUL.ESTIMATE.Friendly'] },
      { id: '2-4', titleNl: 'Les 4 Vermenigvuldigen – toepassen', goalNl: 'sommen uit een context halen.', skills: ['META.EQUATION.Select', 'MUL.CONTEXT.FourStep', 'MEAS.CONTEXT.CombineLimit'] },
      { id: '2-5', titleNl: 'Les 5 Weet je nog?', goalNl: 'optellen, aftrekken, vermenigvuldigen en delen. deeltafels tot en met 10. klokkijken.', skills: ['NUM.LINE.Position', 'PV.DHTE.Identify', 'ADD.COLUMN.Carry', 'SUB.COLUMN.BorrowCrossout', 'DIV.FACT.Inverse', 'TIME.CALC.Offset', 'TIME.CALC.Elapsed'] },
      { id: '2-6', titleNl: 'Les 6 Rekenen met geld – voorbereiden', goalNl: "geldbedragen met komma's schrijven.", skills: ['MONEY.VALUE.Denomination', 'MONEY.NOTATION.EuroCent', 'MONEY.PAY.Exact', 'MONEY.ROUND.WholeEuro'] },
      { id: '2-7', titleNl: 'Les 7 Rekenen met geld – oefenen', goalNl: 'schatten en rekenen met geld.', skills: ['MONEY.PAY.Exact', 'MONEY.PAY.Minimal', 'MONEY.CHANGE.Complement', 'MONEY.ROUND.WholeEuro', 'MONEY.ESTIMATE.Total'] },
      { id: '2-8', titleNl: 'Les 8 Rekenen met geld – oefenen', goalNl: 'optellen en aftrekken van geldbedragen.', skills: ['MONEY.CALC.Add', 'MONEY.CALC.Subtract', 'MONEY.CHANGE.Complement'] },
      { id: '2-9', titleNl: 'Les 9 Rekenen met geld – toepassen', goalNl: 'rekenen met geld in contexten.', skills: ['MONEY.CONTEXT.DiscountShortfall', 'MONEY.CONTEXT.Budget', 'MONEY.ESTIMATE.Total'] },
      { id: '2-10', titleNl: 'Les 10 Weet je nog?', goalNl: 'optellen, aftrekken, vermenigvuldigen en delen. vermenigvuldigen met 10 en 100. lengtematen.', skills: ['NUM.SEQ.Step', 'PV.DHTE.Identify', 'PV.SCALE.TenHundred', 'MEAS.LENGTH.Anchor', 'REL.ADD.MissingPart'] },
      { id: '2-11', titleNl: 'Les 11 Vermenigvuldigen – voorbereiden', goalNl: 'afronden op tientallen en honderdtallen. de symbolen voor groter en kleiner dan (> en <).', skills: ['NUM.ROUND.Ten', 'NUM.ROUND.Hundred', 'NUM.ROUND.Thousand', 'NUM.COMPARE.Symbols'] },
      { id: '2-12', titleNl: 'Les 12 Vermenigvuldigen – oefenen', goalNl: 'vermenigvuldigen van getallen zoals 30 x 12.', skills: ['MUL.SCALE.TwoFactors', 'MUL.COLUMN.TensFactor', 'MUL.ESTIMATE.Friendly'] },
      { id: '2-13', titleNl: 'Les 13 Vermenigvuldigen – oefenen', goalNl: 'vermenigvuldigen van getallen zoals 40 × 56.', skills: ['MUL.COLUMN.TensFactor', 'MUL.ESTIMATE.Friendly'] },
      { id: '2-14', titleNl: 'Les 14 Vermenigvuldigen – toepassen', goalNl: 'vermenigvuldigingen zoals 40 x 24 herkennen in toepassingen.', skills: ['MUL.CONTEXT.FourStep', 'META.ANSWER.Unit'] },
      { id: '2-15', titleNl: 'Les 15 Weet je nog?', goalNl: 'optellen, aftrekken, vermenigvuldigen en delen. eenvoudige diagrammen lezen.', skills: ['ADD.COLUMN.Carry', 'SUB.COLUMN.BorrowCrossout', 'DATA.GRAPH.ReadBar', 'DATA.GRAPH.ReadLine', 'DATA.GRAPH.Compare'] },
    ],
  },
]

/** One group of a practice test: a skill, how many items, and an optional variant. */
export interface ProeftoetsGroup {
  skillId: SkillId
  items: number
  /** Generator variant, to match the test page's exact item type. */
  variant?: string
  /** The workbook's Maatwerk reference for this group ("> M: 6, 7"). */
  maatwerkNl?: string
}

export interface Proeftoets {
  id: string
  blokId: string
  titleNl: string
  sourceNl: string
  groups: ProeftoetsGroup[]
}

export const PROEFTOETSEN: Proeftoets[] = [
  {
    id: 'proeftoets-blok-2',
    blokId: 'blok-2',
    titleNl: 'Proeftoets blok 2',
    sourceNl: 'Zelfde opbouw als Test jezelf (les 16, blz. 68–70): 11 opdrachten, zelfde soort getallen.',
    groups: [
      { skillId: 'PV.DHTE.Decompose', items: 5, maatwerkNl: 'M: 1, 2' },
      { skillId: 'NUM.ROUND.Ten', items: 6, maatwerkNl: 'M: 3' },
      { skillId: 'NUM.ROUND.Hundred', items: 6, maatwerkNl: 'M: 4' },
      { skillId: 'NUM.COMPARE.Symbols', items: 6, maatwerkNl: 'M: 5' },
      { skillId: 'MUL.SPLIT.Distribute', items: 4, maatwerkNl: 'M: 6, 7' },
      { skillId: 'MUL.ESTIMATE.Friendly', items: 6, variant: 'type', maatwerkNl: 'M: 8' },
      { skillId: 'MUL.COLUMN.Carry', items: 2, maatwerkNl: 'M: 10' },
      { skillId: 'MUL.COLUMN.TensFactor', items: 4, maatwerkNl: 'M: 9, 11, 12' },
      { skillId: 'MONEY.NOTATION.EuroCent', items: 4, variant: 'digit-value', maatwerkNl: 'M: 13, 14' },
      { skillId: 'MONEY.CALC.Add', items: 2, maatwerkNl: 'M: 16' },
      { skillId: 'MONEY.CALC.Subtract', items: 2, maatwerkNl: 'M: 16' },
      { skillId: 'MONEY.ESTIMATE.Total', items: 1, maatwerkNl: 'M: 15, 16' },
      { skillId: 'MONEY.CHANGE.Complement', items: 1, maatwerkNl: 'M: 15, 16' },
    ],
  },
  {
    id: 'proeftoets-blok-1',
    blokId: 'blok-1',
    titleNl: 'Herhalingstoets blok 1',
    sourceNl: 'Opgebouwd uit wat blok 2 herhaalt (Weet je nog?), in de vorm van Test jezelf.',
    groups: [
      { skillId: 'PV.DHTE.Identify', items: 6 },
      { skillId: 'NUM.LINE.Position', items: 3 },
      { skillId: 'NUM.SEQ.Step', items: 2 },
      { skillId: 'ADD.COLUMN.Carry', items: 3 },
      { skillId: 'SUB.COLUMN.BorrowCrossout', items: 3 },
      { skillId: 'REL.ADD.MissingPart', items: 4 },
      { skillId: 'DIV.FACT.Inverse', items: 6 },
      { skillId: 'MEAS.LENGTH.Anchor', items: 4 },
      { skillId: 'TIME.CALC.Offset', items: 3 },
      { skillId: 'TIME.CALC.Elapsed', items: 1 },
    ],
  },
]

export function lessonById(id: string): PathLesson | null {
  for (const blok of LEARNING_PATH) for (const lesson of blok.lessons) if (lesson.id === id) return lesson
  return null
}

export function proeftoetsById(id: string): Proeftoets | null {
  return PROEFTOETSEN.find((p) => p.id === id) ?? null
}

/** Every skill on the path, in path order, without duplicates. */
export function pathSkills(): SkillId[] {
  return [...new Set(LEARNING_PATH.flatMap((b) => b.lessons.flatMap((l) => l.skills)))]
}

// ---- Where she is on the path ----

/** A skill counts as done on the path once it reached the test format or Level 2. */
export function skillOnTestLevel(state: LearnerSkillState | undefined): boolean {
  return !!state && (state.currentVerifiedLevel >= 2 || state.scaffolding.currentTier === 'S3')
}

export function lessonComplete(lesson: PathLesson, states: Record<SkillId, LearnerSkillState>): boolean {
  return lesson.skills.every((id) => skillOnTestLevel(states[id]))
}

/**
 * The lessons a general session draws from, like a teacher's week: the
 * finished lessons of the blok (for review), the current lesson, and a
 * look at the next one.
 */
export function currentLessons(blokId: string, states: Record<SkillId, LearnerSkillState>): PathLesson[] {
  const blok = LEARNING_PATH.find((b) => b.id === blokId) ?? LEARNING_PATH[LEARNING_PATH.length - 1]!
  const current = blok.lessons.findIndex((l) => !lessonComplete(l, states))
  if (current === -1) return blok.lessons
  return blok.lessons.slice(0, current + 2)
}

/** The first lesson of the blok that is not finished yet. */
export function currentLesson(blokId: string, states: Record<SkillId, LearnerSkillState>): PathLesson | null {
  const blok = LEARNING_PATH.find((b) => b.id === blokId)
  return blok?.lessons.find((l) => !lessonComplete(l, states)) ?? null
}
