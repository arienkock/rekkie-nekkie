# Learning path: blok 1 and 2, from understanding to the test

How the app now replaces the teacher's sequence of explanation → guided
practice → independent practice → test → remediation. Background and the
reasons are in `test-readiness-plan.md`; the blok 2 content analysis is in
`blok-2-curriculum-plan.md`.

## No gaps

- **Every one of the 102 knowledge-graph skills has a generator.** There are 89 original skills and 13 mined from blok 2. `all-generators.test.ts` fails if a node has none.
- **Every skill sits on the path** (`src/domain/learning-path.ts`). `learning-path.test.ts` fails if a node is missing.
- **Blok 2** follows the workbook's table of contents: lessons 1–15, using the book's titles and *Je leert* goals.
- **Blok 1 is reconstructed.** It holds what blok 2's *Weet je nog?* lessons review, plus the groep 5/6 foundations that blok 2 builds on. It still has to be checked against the blok 1 workbook; photos of it would let us align it lesson by lesson.

## One path per skill

| Tier | Label in the app | What she sees |
| --- | --- | --- |
| S0 | Samen oefenen | Model (widget) and guided sub-steps |
| S1 | Met een beetje hulp | Model with fewer steps: the bridge to the written form |
| S2 | Zelf oefenen | One item in the book's wording, no model |
| S3 | **Toetsvorm** | A block of items under one book instruction, no hints, checked together at the end |

Moving up and down:

- **Moving up:** two successes on distinct items move her one tier up, within a session.
- **Toetsvorm blocks pass at 80%:** 5 of 6, 4 of 5, or 8 of 10 lines, with estimates included.
- **A failed block** sends her back to *Zelf* (S2).
- **Level 2** (the second star) requires a passed toetsvorm block.
- **Stages for parents:** each skill shows *met hulp*, *zelf*, *toetsvorm* or *na een week nog* (Voortgang and Leerpad).

## The book's wording

- **Book instructions:** `src/domain/book-wording.ts` holds the workbook's instructions, verbatim. S2 and S3 items use them.
- **Wording check:** a test checks every S3 item's instruction against that list. Word problems are the exception: their story is the instruction.
- **Book notation:**
  - `118 ≈` for estimates, `… × 100 = 700` for a missing number, `€ 24,13` with a space.
  - Estimate-then-exact pairs: `3 × 232 ≈` followed by `3 × 232 =`.
  - Expanded form: `= 8 × 1000 + 3 × 100 + 4 × 10 + 2 × 1`.
- **School method:**
  - Carries in written multiplication.
  - The tens zero written first in `40 × 56`.
  - Commas lined up under each other for money.
  - Rounding at 5 and at 50 cent.
  - The 4-step plan, with *Het antwoord ligt in de buurt van de schatting.*

## Sessions

- **Rekenen** follows the lessons of the current blok, like a teacher's week:
  - the finished lessons (for review), the current lesson, and the next one;
  - due reviews of anything practised before;
  - maatwerk.
  - The current blok is set in Instellingen and defaults to blok 2.
- **Leerpad → Oefen deze les** practises one lesson's skills.
- **Leerpad → Proeftoets:**
  - **Proeftoets blok 2** copies *Test jezelf* (pp. 68–70): the same groups in the same order, the same item types, and the book's `M:` references.
  - **Herhalingstoets blok 1** covers what blok 2 reviews.
  - Groups below 80% become **maatwerk**. More than half wrong means back to S1, otherwise S2. Maatwerk skills get priority in every session until they pass a toetsvorm block again.

## Engine changes that came with it

- **Sessions stay inside a window.** A general session draws from a window of lessons, not all 100 skills. Otherwise a new profile would only ever see each skill once.
- **Maatwerk skips the predicted-success band.** A skill she just failed would never fall inside it.
- **Rested skills only when nothing else is left.** A skill that is resting (4 independent successes in 12 h) can still be served when nothing else can, e.g. a session on one chosen table.
- **One observation per skill per item.** A sub-step on the item's own skill counts towards the item's own skill, never as a second observation.
- **Fixed: the €20, €10 and €5 notes** were missing from the denomination list.

## Tests that guard this

| Test | What it checks |
| --- | --- |
| `all-generators.test.ts` | Every skill × tier × band × 12 seeds generates; each step's own canonical `expected` answer validates; a wrong answer gets feedback; blank is never correct; the same seed gives the same item; S3 uses book wording; every skill builds a test block. |
| `learning-path.test.ts` | No gaps on the path; blok 2 matches the book; each proeftoets group builds the requested item type. |
| `learner-store.test.ts` | Blocks (no hints, blanks wrong, unreadable notation records nothing, failing returns to S2), lesson sessions, path-following sessions, and a proeftoets with maatwerk. |
| `render-smoke.test.ts` | Every skill renders through the real React components as an item and as a block, before and after checking; the Leerpad and Voortgang render. |
| `validateGeneratedExercise` | At runtime, refuses any item whose own canonical answer does not validate. |

## Still open

- **Photos of the blok 1 workbook**, to check the reconstructed blok 1 lesson by lesson.
- **Photos of a marked school test**, to calibrate the proeftoets against the real thing.
- **Blok 3** (*cijferend delen*, *klokkijken*) once the class starts it.
- **Paper mode** for *Zet onder elkaar*, where she types her written lines one at a time to find a mistake (plan §B). Not built yet.
