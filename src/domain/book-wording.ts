/**
 * Instructions exactly as the workbook prints them (Getal & Ruimte Junior,
 * groep 6, blok 2, transcribed from the photographed pages and the Test
 * jezelf). Test-format items (tier S3) and independent items (S2) use these
 * strings verbatim, so the words on her test are the words she practised.
 * docs/test-readiness-plan.md §E: the instruction decides the procedure.
 */
export const BOOK = {
  rekenUit: 'Reken uit.',
  maakDeOpgave: 'Maak de opgave.',
  vulIn: 'Vul in.',
  schrijfOp: 'Schrijf op.',
  leesAf: 'Lees af.',
  verdeelDhte: 'Verdeel de getallen in duizendtallen, honderdtallen, tientallen en eenheden.',
  bepaalWaarde: 'Bepaal de waarde van het cijfer.',
  rondAfTientallen: 'Rond af op tientallen.',
  rondAfHonderdtallen: 'Rond af op honderdtallen.',
  rondAfDuizendtallen: 'Rond af op duizendtallen.',
  rondAfHeleEuros: "Rond af op hele euro's.",
  vulKleinerGroter: 'Vul < of > in.',
  schatHetAntwoord: 'Schat het antwoord.',
  zetOnderElkaar: 'Zet onder elkaar en reken uit.',
  zetOnderElkaarSchatEerst: 'Zet onder elkaar en reken uit. Schat eerst het antwoord.',
  rekenUitSchatEerst: 'Reken uit. Schat eerst het antwoord.',
  schrijfBerekening: 'Reken uit. Schrijf je berekening op.',
  stappenplan: 'Reken uit met het stappenplan.',
  welkGetalPijl: 'Welk getal wijst de pijl aan?',
  welkGetalLetter: 'Welk getal wijst de letter aan? Schrijf dat getal achter de letter.',
  waarLiggen: 'Waar liggen de getallen ongeveer?',
  telVerder: 'Tel verder. Kijk goed wat erbij komt of eraf gaat.',
  vulOntbrekende: 'Vul de ontbrekende getallen in.',
  vulTrappen: 'Vul de trappen in.',
  vulTabel: 'Vul de tabel in.',
  welkBedrag: 'Welk bedrag is het?',
  schrijfAlsBedrag: 'Schrijf als een bedrag.',
  tussenHeleEuros: "Tussen welke hele euro's ligt het bedrag?",
  betaalGepast: 'Betaal gepast.',
  verdeelBedrag: 'Verdeel het bedrag. Gebruik zo min mogelijk biljetten en munten.',
  hoeveelTerug: 'Hoeveel krijg je terug?',
  hoeveelSamenOngeveer: "Hoeveel is het samen ongeveer? Rond af op hele euro's.",
  leesGrafiek: 'Lees de grafiek af en geef antwoord.',
  bekijkGrafiek: 'Bekijk de grafiek en geef antwoord op de vragen.',
  vulDigitaleTijd: 'Vul de digitale tijd in.',
  hoeLaat: 'Hoe laat is het? Schrijf de digitale tijd op.',
  kiesAntwoord: 'Kies het juiste antwoord.',
  welkeSom: 'Welke som hoort erbij?',
} as const

export type BookInstruction = (typeof BOOK)[keyof typeof BOOK]

/** Every book instruction, for checks that S3 items use the book's words. */
export const BOOK_INSTRUCTIONS: readonly string[] = Object.values(BOOK)

/**
 * What each instruction asks her to do, in child language. Used by the
 * META.INSTRUCTION.Read skill: "Wat moet ik doen?".
 */
export const INSTRUCTION_MEANINGS: ReadonlyArray<{ instruction: string; meaning: string; distractors: string[] }> = [
  {
    instruction: BOOK.schatHetAntwoord,
    meaning: 'Maak er makkelijke getallen van en reken ongeveer.',
    distractors: ['Reken het precies uit.', 'Zet de getallen onder elkaar.'],
  },
  {
    instruction: BOOK.zetOnderElkaar,
    meaning: 'Schrijf de getallen in kolommen onder elkaar en reken cijferend.',
    distractors: ['Reken ongeveer met ronde getallen.', 'Teken sprongen op een getallenlijn.'],
  },
  {
    instruction: BOOK.rondAfTientallen,
    meaning: 'Kijk naar de eenheden: minder dan 5 naar beneden, 5 of meer naar boven.',
    distractors: ['Kijk naar de tientallen.', 'Zet een 0 achter het getal.'],
  },
  {
    instruction: BOOK.rondAfHonderdtallen,
    meaning: 'Kijk naar de tientallen: minder dan 5 naar beneden, 5 of meer naar boven.',
    distractors: ['Kijk naar de eenheden.', 'Haal de laatste twee cijfers weg.'],
  },
  {
    instruction: BOOK.rondAfHeleEuros,
    meaning: 'Kijk naar de centen: minder dan 50 cent naar beneden, 50 cent of meer naar boven.',
    distractors: ['Laat de centen gewoon weg.', 'Rond af op tientallen euro’s.'],
  },
  {
    instruction: BOOK.vulKleinerGroter,
    meaning: 'De open kant wijst naar het grootste getal.',
    distractors: ['Reken het verschil uit.', 'Schrijf het grootste getal op.'],
  },
  {
    instruction: BOOK.verdeelDhte,
    meaning: 'Schrijf hoeveel duizendtallen, honderdtallen, tientallen en eenheden het getal heeft.',
    distractors: ['Deel het getal door 10.', 'Tel alle cijfers bij elkaar op.'],
  },
  {
    instruction: BOOK.betaalGepast,
    meaning: 'Maak precies het bedrag met munten en biljetten, zodat je niets terugkrijgt.',
    distractors: ['Betaal met het grootste biljet.', 'Reken uit hoeveel je terugkrijgt.'],
  },
  {
    instruction: BOOK.verdeelBedrag,
    meaning: 'Maak het bedrag met zo weinig mogelijk munten en biljetten: begin bij de grootste.',
    distractors: ['Gebruik alleen munten.', 'Deel het bedrag door 2.'],
  },
  {
    instruction: BOOK.stappenplan,
    meaning: 'Teken, schrijf de som op, reken uit en controleer met je schatting.',
    distractors: ['Schrijf alleen het antwoord op.', 'Reken alles uit je hoofd.'],
  },
  {
    instruction: BOOK.telVerder,
    meaning: 'Zoek wat er steeds bij komt of af gaat en ga zo door.',
    distractors: ['Tel alle getallen op.', 'Zet de getallen op volgorde.'],
  },
  {
    instruction: BOOK.schrijfBerekening,
    meaning: 'Schrijf de som op die je maakt, niet alleen het antwoord.',
    distractors: ['Schrijf alleen het antwoord op.', 'Schat het antwoord.'],
  },
]
