# Blok 2 (groep 6): mined skills and incorporation plan

## Source

`blok-2/` holds 81 HEIC photos and 65 MP4s from *Getal & Ruimte Junior, groep 6
Leerwerkboek*, blok 2 (workbook pages 6–82). The MP4s are the Live Photo motion
clips of HEICs with the same name (2–3 s, same page); they hold no extra content.
The handwritten answers on some pages are deliberately not analysed.

How these skills reach test level (*toetsvorm*, the proeftoets, school-blok mode) is
described in `test-readiness-plan.md`. That plan takes priority over the rollout
order below.

The table of contents also shows what comes next. **Blok 3** covers *cijferend
delen* and *klokkijken* (pages 84–156).

### Lesson structure

| Part | Lessons | Topic | Workbook “Je leert” |
| --- | --- | --- | --- |
| 2.1 | 1–4 | Vermenigvuldigen | numbers up to 10 000, estimating · 3 × 125 · written 3 × 295 · sums from a context |
| 2.1 | 5 | Weet je nog? | number line up to 10 000, digit value, ±1/10/100, add/subtract, division tables, clock |
| 2.2 | 6–9 | Rekenen met geld | amounts with a comma · estimating with money · adding and subtracting amounts · money in contexts |
| 2.2 | 10 | Weet je nog? | counting on in steps, digit value, ×10/×100, length units |
| 2.3 | 11–14 | Vermenigvuldigen | rounding to 10/100, `<` `>` · 30 × 12 · 40 × 56 · recognising 40 × 24 in contexts |
| 2.3 | 15 | Weet je nog? | add/subtract, reading simple charts |
| 2.4 | 16–20 | Test jezelf, Maatwerk, Pluswerk, Speelwerk | review; puzzles |
| — | — | Wat kun je nu? | self-assessment “Ik kan …” statements (see [Mastery checks](#mastery-checks-from-wat-kun-je-nu)) |

Each lesson follows the same arc as blok 1: *voorbereiden → oefenen → toepassen*,
with *Samen*/*Zelf* items. Each *toepassen* lesson uses the **4-step plan** (Maak
een tekening → Wat moet je uitrekenen? → Wat is je antwoord? → Klopt je antwoord?).
Step 4 is always “Het antwoord ligt in de buurt van de schatting.”

## Key finding: blok 2 mostly adds generators, not new graph nodes

Most of blok 2 is already a node in `src/domain/knowledge-graph.ts`. Those nodes
are tracked but **cannot be served**, because they have no generator. This blok
says which ones to build first and gives the exact number ranges to use.

### Existing nodes that blok 2 exercises

| Node | Generator today | What blok 2 adds (ranges from the book) |
| --- | --- | --- |
| `PV.DHTE.Identify` | — | Digit value in 2–4 digit numbers (16, 162, 2638, 3040, 8001). Answer as “6 eenheden” / “8 tientallen” or as a value. |
| `PV.DHTE.Decompose` | ✓ | 4-digit, multiplicative form: `8342 = 8 × 1000 + 3 × 100 + 4 × 10 + 2 × 1`. |
| `NUM.LINE.Position` | — | Lettered arrows on 0–5000 and 0–10 000 lines, ticks every 1000 or 500. Approximate placement (“waar liggen de getallen ongeveer?”: 4738, 8010, 1138). |
| `NUM.ROUND.Ten` / `NUM.ROUND.Hundred` | — | Round 38, 91, 107, 1049, 1495, 1998. Inverse form: “Welke getallen rond je af op 130?” (pick from 125, 132, 135, 128). |
| `MUL.SCALE.OneFactor` | — | `10 × 600`, `100 × 60`, missing factor `… × 100 = 700`, `13 × … = 2600`. |
| `MUL.SCALE.TwoFactors` | — | Estimates such as `40 × 60 = 2400` and `30 × 30 = 900`. |
| `MUL.SPLIT.Distribute` | — | **1-digit × 3-digit**: `3 × 133 = 300 + 90 + 9`, `2 × 468 = 800 + 120 + 16`. Table form: rows × columns 200 / 30 / 5 → 235. |
| `MUL.COLUMN.PartialProducts`, `MUL.COLUMN.Carry` | — | Written `3 × 295 = 885`, `4 × 312`, `7 × 423`, `3 × 549`. Always estimate first. |
| `MONEY.NOTATION.EuroCent` | — | `€ 24,13 = € 20 + € 4 + € 0,10 + € 0,03`; “34 euro en 5 cent = € 34,05”; 1/10/100 cent ↔ € 0,01/0,10/1,00. |
| `MONEY.PAY.Exact` / `MONEY.PAY.Minimal` | — | Pay exactly (`€ 82,25 = … × 20 euro + …`). Fewest notes and coins for `€ 175,92`, `€ 305,25`, `€ 1200`. Counting a collection (5 × 5 c = € 0,25; 2 × € 5 + 5 × € 2 + …). |
| `MONEY.CALC.Add` / `MONEY.CALC.Subtract` | — | Written with the commas lined up: `€ 128,87 + € 23,56`, `€ 125,54 − € 23,76`, `€ 10,05 − € 9,85`. |
| `MONEY.CHANGE.Complement` | ✓ | Larger notes: change from € 50 and € 100 (`€ 100 − € 45,95`); table format price / betaald met / geld terug. |
| `MONEY.CONTEXT.DiscountShortfall` | — | Korting (−€ 2,50), statiegeld refund, saving shortfall (`€ 67` goal), “Hoeveel moet Timo nog sparen?”. |
| `ADD/SUB.COLUMN.*`, `ADD/SUB.JUMP.*` | partly | Review only (lessons 5, 10, 15), sums up to 1000. |
| `TIME.CALC.Offset` / `TIME.CALC.Elapsed` | — | Review only: “over drie kwartier”, “anderhalf uur geleden”, 8:05 → 12:00. |

### New nodes to add

The book teaches these but the graph does not have them. Child-facing text is a draft;
have a Dutch-speaking adult read it aloud first, as `easiest-level-help-plan.md` asks.

| Proposed id | Theme | `titleNl` / `learnerCanNl` (draft) | Prerequisites | Variation tags |
| --- | --- | --- | --- | --- |
| `NUM.COMPARE.Symbols` | all | *Groter of kleiner* — “Ik kan getallen tot 10 000 vergelijken met < en >.” | `PV.DHTE.Identify` | `same-digits` (4234 vs 4324), `near-thousand` (9970 vs 9907) |
| `NUM.ROUND.Thousand` | all | *Afronden op duizendtallen* — “Ik kijk naar het honderdtal om af te ronden op duizendtallen.” | `NUM.ROUND.Hundred` | `which-rounds-to` |
| `NUM.SEQ.Step` | OA | *Tel verder* — “Ik zie welke stap erbij komt of eraf gaat en tel verder.” | `PV.DHTE.Compose`, `ADD.JUMP.HundredBridge` | `step-50`, `step-80`, `step-900`, `descending` |
| `MUL.ESTIMATE.Friendly` | MD | *Schatten met passende getallen* — “Ik kan 92 × 25 schatten met getallen waarmee ik makkelijk reken.” | `NUM.ROUND.Ten`, `NUM.ROUND.Hundred`, `MUL.SCALE.TwoFactors` | `1x3`, `2x2`, `more-or-less`, `match-estimate` |
| `MUL.COLUMN.TensFactor` | MD | *Keer een tiental onder elkaar* — “Ik kan 40 × 56 onder elkaar uitrekenen en schrijf eerst de tiental-nul op.” | `MUL.COLUMN.Carry`, `MUL.SCALE.OneFactor` | `no-carry` (30 × 12), `carry` (40 × 56) |
| `MUL.CONTEXT.FourStep` | MD | *Keersommen in verhaaltjes* — “Ik vind de keersom in een verhaal, schat eerst en controleer mijn antwoord.” | `MUL.ESTIMATE.Friendly`, `META.EQUATION.Select`, `META.CHECK.EstimateInverse` | `single-step`, `two-step` (4 × 245 + 2 × 135), `three-factor` (8 × 6 × 4), `compare` (who lifts the most) |
| `MONEY.ROUND.WholeEuro` | TG | *Afronden op hele euro’s* — “Ik weet tussen welke hele euro’s een bedrag ligt en rond af.” | `MONEY.NOTATION.EuroCent`, `NUM.ROUND.Ten` | `between`, `fifty-cent-boundary` (€ 2,50) |
| `MONEY.ESTIMATE.Total` | TG | *Ongeveer hoeveel samen?* — “Ik kan een kassabon schatten door af te ronden op hele euro’s.” | `MONEY.ROUND.WholeEuro`, `ADD.JUMP.TenBridge` | `receipt`, `three-items` |
| `MONEY.CONTEXT.Budget` | TG | *Heb ik genoeg?* — “Ik kan uitrekenen of mijn geld genoeg is en hoeveel ik overhoud.” | `MONEY.ESTIMATE.Total`, `MONEY.CALC.Add`, `META.EQUATION.Select` | `enough`, `not-enough`, `earnings` (end − start of day), `per-person` |
| `DATA.GRAPH.ReadBar` | new `data` theme | *Staafgrafiek aflezen* — “Ik kan in een staafgrafiek aflezen hoeveel het is, ook tussen twee streepjes.” | `MEAS.SCALE.Interval`, `NUM.LINE.Position` | `scale-1000`, `between-gridlines` |
| `DATA.GRAPH.ReadLine` | data | *Lijngrafiek aflezen* — “Ik kan een lijngrafiek per week of jaar aflezen.” | `DATA.GRAPH.ReadBar` | `scale-1` |
| `DATA.GRAPH.Compare` | data | *Vragen bij een grafiek* — “Ik kan de hoogste en laagste vinden, het verschil uitrekenen en alles optellen.” | `DATA.GRAPH.ReadBar`, `REL.ADD.Inverse` | `max-min`, `difference`, `total`, `complement` (fouten = 10 − goed) |
| `META.INSTRUCTION.Read` | all | *Wat moet ik doen?* — “Ik weet wat een opdracht vraagt voordat ik ga rekenen.” | — | one tag per book instruction (see `test-readiness-plan.md` §E) |

Variation tags on existing nodes, rather than new nodes:

- `MONEY.NOTATION.EuroCent`: `split` (€ 20 + € 4 + € 0,10 + € 0,03), `digit-value` (“Wat is de 3 waard in € 25,37?” → € 0,30), `words-to-amount`.
- `MONEY.PAY.Exact`: `count-collection` (a number of each coin → total).
- `NUM.ROUND.Ten` / `NUM.ROUND.Hundred`: `which-rounds-to`.
- `MUL.SPLIT.Distribute`: `three-digit`, `table-form`.
- `MUL.SCALE.OneFactor`: `missing-factor`.

Graph changes must keep `graph-validation.ts` passing (DAG, known prerequisites)
and update the node count in the header comment (89 → 102). The `DATA.*` nodes
need a fifth `ThemeId` (`'data'`, *Grafieken*), which also means the theme picker
and the progress view must handle it.

### Deliberately not mined (for now)

- **Geometry** (lesson 10: “Teken een vierkant met zijden van 3 cm”). Drawing to size is not a good fit for the app.
- **Pluswerk puzzles**: missing digits in multiplication, products from a maze,
  perfect numbers, “Geef het door” (3ⁿ growth), two equations
  (2 schriften + 3 potloden = € 3,25), bonbon price comparison, parking tariffs.
  Better as an optional challenge after mastery than as graph skills.
  The cheap exception is **product parity** (“even/oneven zonder uit te rekenen”),
  which could be a `harder` variation inside `MUL.ESTIMATE.Friendly`.

## Generator plan

Every generator follows the existing contract: a pure function of
`(seed, tier, band, purpose, primarySkillId)`, it throws on unsatisfiable constraints, and it has a hint ladder.
Number ranges come from the book. `easier` follows `easiest-level-help-plan.md`:
smaller numbers, and only one new thing per step up.

| # | New file | Serves | Widget | easier → standard → harder |
| --- | --- | --- | --- | --- |
| 1 | `place-value-identify.ts` | `PV.DHTE.Identify`, `NUM.COMPARE.Symbols` | `dhte-grid` (exists) | 2-digit → 4-digit → 4-digit with zeros / same digits reordered |
| 2 | `rounding.ts` | `NUM.ROUND.Ten/Hundred/Thousand`, `MONEY.ROUND.WholeEuro` | `number-line` with the two candidate endpoints highlighted (exists) | clear cases (23, 28) → boundary 5/50 → `which-rounds-to` and crossing a hundred/thousand (1998) |
| 3 | `number-line-position.ts` | `NUM.LINE.Position`, `NUM.SEQ.Step` | `number-line` with lettered arrows | ticks every 1000 → every 500 → approximate placement |
| 4 | `multiplication-written.ts` | `MUL.SCALE.*`, `MUL.SPLIT.Distribute`, `MUL.COLUMN.*`, `MUL.COLUMN.TensFactor` | `column-grid` with a × operator and carry row (extend) + split arcs | 1 × 2-digit no carry → 1 × 3-digit one carry (3 × 295) → tens × 2-digit with carry (40 × 56) |
| 5 | `multiplication-estimate.ts` | `MUL.ESTIMATE.Friendly` | none / step plan | minder/meer than a benchmark → pick the matching estimate → type an estimate |
| 6 | `money-notation.ts` | `MONEY.NOTATION.EuroCent` | `money-tray` (exists) | “2 euro en 5 cent” → split into notes and coins → digit value |
| 7 | `money-pay.ts` | `MONEY.PAY.Exact`, `MONEY.PAY.Minimal` | `money-tray` | amounts under € 10 → under € 100 → up to € 1200 |
| 8 | `money-column.ts` | `MONEY.CALC.Add`, `MONEY.CALC.Subtract` | `column-grid` with a fixed comma column (extend) | no regrouping → cent→euro regroup → borrow across zero (€ 100,00 − …) |
| 9 | `money-estimate.ts` | `MONEY.ESTIMATE.Total`, `MONEY.CONTEXT.Budget` | **`receipt`** (new: kassabon lines + total) | 2 items → 3–5 items → “heb je genoeg aan € 20?” |
| 10 | `word-problem-steps.ts` | `MUL.CONTEXT.FourStep`, `MONEY.CONTEXT.DiscountShortfall`, `MONEY.CONTEXT.Budget` | **`step-plan`** (new) | single-step → two-step → compare/multi-step |
| 11 | `graph-reading.ts` | `DATA.GRAPH.*` | **`bar-chart`**, **`line-chart`** (new) | values on gridlines, scale 1 → between gridlines, scale 1000 → difference/total/complement |
| 12 | `instruction-words.ts` | `META.INSTRUCTION.Read` | none | match book instruction ↔ what to do |
| — | extend `money-change.ts` | `MONEY.CHANGE.Complement` | `money-tray` | add € 50/€ 100 notes and cents at `standard`/`harder` |

### Answer checking that needs a decision

- **Estimates have more than one right answer.** 92 × 25 ≈ 90 × 25, 100 × 25 or
  90 × 30 are all reasonable. Proposal: start with the `more-or-less` and
  `match-estimate` forms (one right answer). For a typed estimate, accept any product
  in which each factor is rounded to its leading place or one place lower, or to 25/50.
  Then show the child's chosen friendly numbers back to them, as the book does.
- **Money input**: reuse `AnswerType { kind: 'money', unit: 'euro-comma' }` and require two decimal places only at S2+.
- **Rounding answers** use `≈` in the prompt, never `=`. The book explains that ≈ means “is ongeveer”.

### The 4-step plan (`step-plan` widget)

The book uses the 4-step plan in every *toepassen* lesson, and `META.*` nodes
already model it. Build it as a sequence of `GeneratedStep`s, so evidence
attribution keeps working:

1. *Maak een tekening*: choose the matching model (bar, groups, or receipt) from 2–3 pictures. At S0 the model is shown, not chosen.
2. *Wat moet je uitrekenen?*: choose the expression (`4 × 318` versus `4 + 318`), which feeds `META.EQUATION.Select`.
3. *Wat is je antwoord?*: estimate first, then the exact answer with a unit, which feeds `META.ANSWER.Unit`.
4. *Klopt je antwoord?*: yes/no, “is it near the estimate?”, which feeds `META.CHECK.EstimateInverse`.

Book contexts that work well as story templates: regentonnen × liters, fruit
weights in grams, benches × price, rows of seeds, planks in mm, packs of notebooks
from the storeroom, children × markers, school book orders (175 × 4), lorries ×
boxes, swimming lengths × 50 m. For money: receipt totals, korting, statiegeld,
pizza + delivery, cash register at the start and end of the day.

## Rollout order

This is the order *within* step 3 of `test-readiness-plan.md`. Build each generator
test-first: the *Zelf*/*Toetsvorm* form of the book's item group first, then the
supported tiers. Blok 2 is what the class is doing now, so the order follows the
book's dependency chain:

1. **Number sense bridge**: generators 1–3 and the three new `NUM.*` nodes.
   This unlocks rounding, which both blok-2 tracks need.
2. **Multiplication track (2.1 + 2.3)**: generators 4–5, nodes `MUL.ESTIMATE.Friendly` and `MUL.COLUMN.TensFactor`.
3. **Money track (2.2)**: generators 6–8, the `money-change` extension, and the `MONEY.ROUND`/`ESTIMATE` nodes.
4. **Applications**: the `step-plan` and `receipt` widgets, generators 9–10, `MUL.CONTEXT.FourStep`, and `MONEY.CONTEXT.Budget`.
5. **Charts and instruction words**: generators 11–12 and the *Grafieken* theme. After that, optional Pluswerk challenge items.

For each step: add nodes, register generators in `src/generators/index.ts`, and add
generator tests in the style of `generators.test.ts` / `multiplication-facts.test.ts`
(range constraints per band, determinism per seed, every hint ladder non-empty).
Also add a *Waarom leren we dit?* purpose line for each new family, as described in
`easiest-level-help-plan.md`. Suggested lines:

- Rounding: “Afronden helpt je snel te zien ongeveer hoeveel iets is.”
- Estimating: “Eerst schatten laat zien of je antwoord kan kloppen.”
- Money with a comma: “Voor de komma staan de hele euro’s, achter de komma de centen.”
- Kassabon estimate: “Zo weet je bij de kassa of je genoeg geld bij je hebt.”

## Mastery checks from *Wat kun je nu?*

The book's self-assessment items map directly onto checks for the new and extended nodes:

| Book statement | Node | Check item |
| --- | --- | --- |
| Ik kan de uitkomst van berekeningen schatten met passende getallen | `MUL.ESTIMATE.Friendly` | 18 × 32 ≈ … |
| Ik kan 8 × 237 op 2 manieren uitrekenen | `MUL.SPLIT.Distribute` + `MUL.COLUMN.Carry` | split 200 + 30 + 7, then written after estimating |
| Ik kan geldbedragen met komma’s schrijven | `MONEY.NOTATION.EuroCent` | 5 euro en 10 cent = € 5,10 |
| € 12,75 ligt tussen de hele bedragen … en … | `MONEY.ROUND.WholeEuro` | € 12 and € 13 |
| Schatten met geld | `MONEY.ESTIMATE.Total` | € 13,95 + € 9,90 + € 20,10 ≈ € 44 |
| Geldbedragen optellen en aftrekken; komma’s recht onder elkaar | `MONEY.CALC.Add/Subtract` | column item with the comma column |
| Afronden op tientallen / honderdtallen | `NUM.ROUND.Ten/Hundred` | 48, 221 / 375, 719 |
| Vermenigvuldigingen als 30 × 23 | `MUL.COLUMN.TensFactor` | 30 × 23 ≈ 30 × 20, then written |

## Decisions

- **Charts are in scope.** They are added as a new *Grafieken* theme (the `DATA.*` nodes above).
- **The handwriting is not analysed.**
- **Pluswerk puzzles** remain optional challenge items after *toetsvorm* mastery; they are not required for the test.

## Open questions

1. **Blok 3** (*cijferend delen*, *klokkijken*) comes next. Photograph it the same way when the class starts it.
   Clock reading already has a generator, and written division would extend the `DIV.*` cluster.
2. **A marked school test** (the method's *toets*, not *Test jezelf*), photographed, would let the proeftoets be calibrated against the real thing.
