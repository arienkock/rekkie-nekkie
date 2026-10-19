# From understanding to the test: closing the transfer gap

## The problem

Yente says the exercises in the app differ quite a bit from the ones on her tests.
Understanding an idea in the app does not yet mean she can do the test item. The
goal here is broader than adding exercises: the app should take over the
teacher's job of going from **explanation → guided practice → independent
practice in the school's format → test → remediation → retest**.

Evidence used:

- `rekkie-nekkie-voortgang.json`: the progress export from her tablet (12 Sep – 12 Oct 2026,
  108 items, 17 visits). It is not committed, because it is personal data.
- The blok 2 *Test jezelf* (workbook pp. 68–70) and the lessons it is drawn from (`blok-2/`, see `blok-2-curriculum-plan.md`).

## Why the gap exists

### 1. She almost never practised without support

| | Items | Share |
| --- | --- | --- |
| With a model or step-by-step support (S0/S1) | 79 | 73% |
| Independent (S2, counted as independent evidence) | 24 | 22% |
| Answer revealed by help | 26 | 24% |

She practised 21 skills. **19 of them never got a single independent attempt.**
Independent work happened in only two skills: `ADD.JUMP.NoBridge` (18/19 correct)
and `MEAS.RULER.Offset` (4/5). On most other skills she had 2–5 scaffolded items.
`MONEY.CHANGE.Complement` had the answer revealed in 9 of 10 items, and the clock items in 9 of 15.

The cause is in the engine. `isReady()` (`src/engine/selector.ts`) requires every
prerequisite at Level ≥ 1. Many prerequisites (`FND.FACT.*`, `NUM.LINE.Position`,
`PV.DHTE.Identify`, `PV.DHTE.Exchange`, …) **have no generator**, so they can never
reach Level 1. Every skill downstream of them is stuck as “teach-first”. It starts
again at S0/S1 each time, and scaffolds never fade, because fading needs ≥ 3
successes at the same skill close together. The few skills she does master then get
overserved. `ADD.JUMP.NoBridge` is 30% of all items, including complete 8-item sessions
of only that skill on 27 Sep, 5 Oct and 11 Oct, after she had already mastered it.

### 2. The app practises different content from school

The app's catalogue is a generic groep 5/6 inventory. In September–October the class
worked on blok 2: 1-digit × 3-digit, tens × 2-digit, estimating, rounding, `<`/`>`,
money with a comma. **The app served none of these**, because no generator exists for
them. When she sits the blok 2 test, the app has prepared nothing on it.

### 3. The task looks different on the test

Compare the same skill in the app and in *Test jezelf*:

| | App | Test |
| --- | --- | --- |
| Instruction | App wording, one item: “Reken onder elkaar uit: 347 + 278 = ?” | Book wording, 2–6 items per instruction: “Zet onder elkaar en reken uit. Schat eerst het antwoord.” |
| Sub-steps | The app asks for them (“Hoeveel onthoud je bij de eenheden?”) | Nobody asks. She must know the steps herself and write them down. |
| Model | Widget on screen (number line, grid, coins) | None. Bare numbers, or a short story with a picture. |
| Where the work happens | Digit boxes in a ready-made grid | On squared paper or in her notebook (the 📖 icon), where she draws the layout herself |
| Estimate then exact | Separate skills | Always a pair: `3 × 232 ≈ …` on one line, `3 × 232 = …` on the next |
| Notation | `=` | `≈` (“is ongeveer”), `< / >`, D H T E table, `€ 25,78` |
| Help | Hints and reveal | None. Afterwards, every item is labelled `> M: 6, 7`, the Maatwerk exercises to redo. |
| Mix | One skill at a time | 11 item groups from three topics on three pages |

The instruction wording is part of the task. “Rond af op tientallen”, “Schat het
antwoord”, “Vul < of > in”, and “Wat is de 5 waard in € 15,37?” each tell her which
procedure to use. In the app she gets a ready procedure and never has to choose one.

### In short

The approach — understanding first, with models and steps — is sound. The research
on faded worked examples supports it. But the app stops halfway: it does not fade
the support, and the final stage, the school's own format, is missing.
Practising in the format you'll be tested in is a well-established effect
(“transfer-appropriate processing”, the testing effect). It has to be designed in, not hoped for.

## The fix: every skill ends in *toetsvorm*

### A. A five-stage path per skill

These stages map onto the existing tiers. S3 is redefined as the test format.

| Stage | Tier | What she sees | Counts as |
| --- | --- | --- | --- |
| **Uitleg** (explanation) | before S0 | A worked example **using the school's method and notation** (the *Uitleg* box), plus the purpose card from `easiest-level-help-plan.md` | exposure |
| **Samen** (together) | S0 | Model + guided sub-steps (today's app) | scaffolded |
| **Brug** (bridge) | S1 | Model and paper layout **side by side**, then a *completion problem*: the written work with gaps to fill (e.g. the carries in `3 × 295`) | scaffolded |
| **Zelf** (on her own) | S2 | One item in the book's wording, no model, no sub-steps; a hint is available at reduced weight | independent |
| **Toetsvorm** (test format) | S3 | A **block** of 4–6 items under one book instruction, with ≈/= pairs; no hints; feedback only after the block | independent + format |

The rules change too:

- **Level 2 requires a passed *toetsvorm* block.** At least 5 of 6 correct, without help. Level 3 additionally requires a *toetsvorm* success ≥ 7 days later, in a mixed block. Stars then mean “can do it on the test”.
- **Fade within a session.** For example, two *Brug* items in a row move her to *Zelf*, and two *Zelf* items to *Toetsvorm*. Fading no longer has to wait for the next visit.
- **A revealed answer is always followed straight away by a sibling item (“Nu jij”)** at the same tier, so a reveal never ends the practice.
- **Readiness ignores prerequisites without a generator.** Each one gets a generator, or is treated as satisfied if it is not practisable, so that skills are no longer permanently “teach-first”.
- **Stop serving mastered skills.** Once a skill passes *toetsvorm*, it only comes back as spaced review, never as a whole session.

### B. Work on paper for *Zet onder elkaar*

When the book shows 📖 (“work in your notebook”), the app does the same:

1. It shows the item in book form and asks her to work on squared paper.
2. She types the **estimate** and the **answer**.
3. If the answer is wrong, the app asks for one line at a time of her written work (the carries, then each partial row). This finds where the error is, the way a teacher looks over her shoulder. Then it offers the matching *Brug* item.

This trains the actual test behaviour: drawing the layout herself and keeping the columns straight.

### C. School-blok mode and a test date

- The parent sets the **current school blok** (now 2, next 3) and, if known, the **test date**.
- The selector serves ~70% of items from the current blok's skills and ~30% as spaced review of earlier bloks. This mirrors the book's *Weet je nog?* lessons.
- Countdown plan:
  - **Up to 10 days before:** learn new skills along the path.
  - **7 days before:** proeftoets 1.
  - **Next few days:** maatwerk on the items she got wrong.
  - **2 days before:** proeftoets 2, newly generated.
  - **Day before:** only a short mixed *toetsvorm* block, nothing new.

### D. Proeftoets (practice test) per blok

A generated version of the blok's *Test jezelf* uses the same item groups, number
ranges, instructions and page order. Blok 2 has the 11 groups from pp. 68–70:

| Group | Book instruction | Skill(s) |
| --- | --- | --- |
| 1 | Maak de opgave. Verdeel in D H T E (5 numbers → expanded form) | `PV.DHTE.Decompose` |
| 2 | Rond af op tientallen (118, 247, 2001, 127, 313, 1498) | `NUM.ROUND.Ten` |
| 3 | Rond af op honderdtallen (125, 770, 1753, 497, 652, 8096) | `NUM.ROUND.Hundred` |
| 4 | Vul < of > in (25 · 30, 32 · 23, 102 · 201, 390 · 309) | `NUM.COMPARE.Symbols` |
| 5 | Reken uit (3 × 149, 4 × 163, 4 × 147, 5 × 132) | `MUL.SPLIT.Distribute` |
| 6 | Schat het antwoord (145 × 4, 295 × 6, 705 × 3, 808 × 8) | `MUL.ESTIMATE.Friendly` |
| 7 | Zet onder elkaar en reken uit. Schat eerst. (3 × 232, 4 × 364) | `MUL.COLUMN.Carry` |
| 8 | idem (20 × 23, 30 × 12, 40 × 33, 80 × 78) | `MUL.COLUMN.TensFactor` |
| 9 | Wat is de 5/3 waard in € 15,37 · € 50,03 · € 64,37 · € 35,19 | `MONEY.NOTATION.EuroCent` (`digit-value`) |
| 10 | Zet onder elkaar, schat eerst (€ 25,50 + € 13,25 · € 100,00 − € 2,25) | `MONEY.CALC.Add/Subtract` |
| 11 | Context: estimate, then exact (bouquet + vase) · change from € 5 | `MONEY.ESTIMATE.Total`, `MONEY.CHANGE.Complement` |

How it is run and scored:

- It is shown as a **page**: all items visible, any order, no feedback until “Klaar”. On a tablet, one group per screen with free navigation back and forth.
- Results are scored per group. Each wrong group links to a **maatwerk** route: that skill's path, entered at *Brug* if more than half the group was wrong, otherwise at *Zelf*. This is the book's own `> M:` system.
- Only the first attempt is scored. Repeats are newly generated, so the comparison is fair.
- Groups that are at least 5/6 correct on the proeftoets count as *toetsvorm* evidence.

The real school test (the method's *toets*) is not in the photos. *Test jezelf* is
the closest proxy. **Photos of a marked school test** would be the most valuable
extra input, to calibrate item types and number ranges.

### E. Instruction words as a skill

`META.INSTRUCTION.Read` — *Wat moet ik doen?*: “Ik weet wat een opdracht vraagt
voordat ik ga rekenen.” She needs this because the book's words decide the procedure.
It is practised in two ways:

- **Quick matching items**: “Schat het antwoord” → *don't calculate exactly; choose easy numbers*. `≈` → *about*. “Zet onder elkaar” → *write it in columns*. “Rond af op honderdtallen” → *look at the tens*.
- **Through the path**: from *Zelf* on, every item uses the book's exact instruction wording. The purpose card names the instruction (“Als je *Schat eerst het antwoord* ziet, …”).

Blok 2 instruction words to cover: Reken uit · Maak de opgave · Verdeel in duizendtallen, honderdtallen, tientallen en eenheden ·
Rond af op tientallen / honderdtallen / hele euro's · Vul < of > in · Schat het antwoord ·
Zet onder elkaar en reken uit · Schat eerst het antwoord · Schrijf je berekening op ·
Wat is de … waard in · Betaal gepast · Gebruik zo min mogelijk biljetten en munten ·
Hoeveel krijg je terug · Reken uit met het stappenplan · Lees de grafiek af.

### F. Use the school's method, exactly

Teaching a different method from school creates a second gap. Generators and
explanations should copy the book's choices:

- **Multiplication:** carries written above the problem. The tens-zero (“tiental-nul”) is written first for `40 × 56`. Splitting is shown with arcs (`3 × 133 = 300 + 90 + 9`).
- **Estimating:** use friendly numbers (“passende getallen”) with `≈`, and for multiplication make one number smaller and the other larger.
- **Rounding:** for tens look at the ones, for hundreds look at the tens; 5 and up rounds up. Money: under 50 cents rounds down.
- **Money:** commas straight under each other; € 24,13 = € 20 + € 4 + € 0,10 + € 0,03.
- **Word problems:** the 4-step plan, with step 4 “Het antwoord ligt in de buurt van de schatting”.

### G. A parent view for each skill

For each skill, show what she can do, so you can see the gap directly:

| Stage | Means |
| --- | --- |
| *met hulp* | can do it with help |
| *zelf* | can do it alone |
| *toetsvorm* | can do it in test format |
| *na een week nog* | still can after a week |

Also show the latest proeftoets result per group, and the upcoming test date.

## Volume

As a replacement for class, the amount of practice matters. One book lesson has
~10–14 exercises with ~4–6 items each. The app delivered 108 items in a month, 6 per
visit on average, most of them scaffolded. *Toetsvorm* blocks are fast: 6 items in
~3 minutes. A realistic target is **15–20 minutes, 4–5 times a week**: one new path
segment, one *toetsvorm* block on a recent skill, and one mixed review block.

## Order of work

1. **Engine fixes**: readiness ignoring prerequisites without a generator, fading within a session, sibling item after a reveal, no whole sessions on mastered skills. Small changes, and the data shows the biggest problem is here.
2. **Toetsvorm block runner + book instruction wording** for the skills that already have generators: column addition, number line, ruler, clock, change, conversions. This immediately helps blok 1 review.
3. **Blok 2 generators** (`blok-2-curriculum-plan.md`) built test-first: the *Zelf*/*Toetsvorm* form of each item group first, then *Brug*/*Samen*.
4. **Proeftoets blok 2** + maatwerk routing, blok mode, test date.
5. **Paper mode** for *Zet onder elkaar*, and the parent view.
6. **Blok 3** (*cijferend delen*, *klokkijken*) as soon as it is photographed.

## How we will know it works

- **Main measure:** the share of items she answers in *toetsvorm* (target > 40% of items from the second week).
- **Proeftoets 1 vs proeftoets 2:** score per group.
- **Her actual blok-test results,** compared with the proeftoets prediction. A large gap means the proeftoets does not resemble the real test yet.
- **Her own words:** does the test still feel “different”? Ask her after each school test.
