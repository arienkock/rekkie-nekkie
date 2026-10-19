# Plan: clearer help and gentler first problems

## Goal

Help a child understand **what a math idea is for** before asking her to use it. The easiest experience should feel like a short guided discovery, not a smaller version of a test.

This plan applies to a learner’s first encounters: scaffold tier **S0 — Samen oefenen** and the `easier` difficulty band. It keeps the existing learning goals and the adaptive evidence rules, but makes the first examples more concrete, shorter, and easier to explain aloud.

## What we see today

The app already has a helpful foundation:

- S0 uses visual widgets and breaks some tasks into steps.
- Every generated exercise has a hint ladder and an explanation after it is solved.
- The knowledge graph includes child-facing “Ik kan …” statements.

The gaps are mainly about timing and cognitive load:

- The child normally sees the explanation **after** getting every answer right; the reason for learning the idea is not introduced first.
- `easier` is not consistently small. For example, number-line jumps still use a three-digit start plus hundreds, tens, and ones; column addition uses two three-digit numbers; unit conversion may start with any two units.
- A visual can show *what to do* without naming *why it helps*: place value preserves a number’s value, a number line tracks movement, a ruler measures a distance rather than a position, and a remainder changes its meaning in a story.
- Help is currently mostly text. A child who does not yet understand the rule needs a short “look here / try this” action tied to the widget.

## Design principles

1. **Start with a purpose in one child-sized sentence.** Put it directly under the title, before the instruction. Use “Dit helpt je om …” rather than a definition.
2. **Show, predict, then name the rule.** Let the child make one small choice with a visible model before asking for a numerical answer. Do not reveal the answer in advance.
3. **One new thing at a time.** At S0, reduce number size, language load, and number of operations while introducing a concept. Only one of these should become harder on the next item.
4. **Use an everyday reason only when it is genuine.** A ruler is for finding how long something is; change is for checking money returned; clock language is for agreeing when something happens. Avoid decorative stories that add reading without helping the math.
5. **Make help actionable and optional.** The child can open “Waarom doen we dit?” or “Laat het stapje zien”; it never blocks a confident child or counts as an error.
6. **Celebrate useful thinking, not speed.** Feedback should name the idea used (“Je telde de ruimtes”) as well as whether the answer is right.

## Proposed learner flow

For every new S0 skill, add this compact sequence above the first exercise. It should take about 20–40 seconds and be skippable after it has been seen once for that skill.

1. **Why card** — title, a one-sentence purpose, and a familiar miniature scene or visual.
2. **Tiny try** — one non-scored prediction or direct manipulation, such as choosing which ruler mark is the start, grouping six counters into two equal rows, or moving one jump on a number line.
3. **Name the idea** — one sentence linking the action to the rule: “We tellen de ruimtes, want lengte is de afstand van begin tot eind.”
4. **Guided first question** — a deliberately small S0 item, with the relevant part of the widget highlighted and a single response expected at a time.
5. **Explain and connect** — after success, retain the existing explanation and add “Dit helpt bij …” to link the skill to its practical use and the next nearby skill.

Add a persistent, calm **“Waarom leren we dit?”** button to S0 and S1 exercise cards. It opens the same purpose card without changing the hint level or mastery evidence. Keep “Hint” for task-specific assistance.

## Content changes by current exercise family

| Skill family | Child-facing purpose | First S0 simplification | Guided action / explanation |
| --- | --- | --- | --- |
| Place value (`PV.DHTE.Decompose`) | “Zo zie je hoeveel een getal echt waard is, bijvoorbeeld bij geld of grote aantallen.” | Begin with two-digit H/T/E-free examples such as 34, then three digits; defer a zero position until the child succeeds with clear digits. | Tap or drag each digit into its named place. Explain that moving a digit changes its value: 3 tens is 30, not 3. |
| Number-line addition (`ADD.JUMP.*`) | “Sprongen helpen je zien hoeveel er bij komt zonder alles opnieuw te tellen.” | Start with a two-digit start and one tens jump, then add a ones jump; do not introduce hundreds in the first S0 item. | Animate one jump after the child predicts the landing point. State that the endpoint is the new total. |
| Column addition (`ADD.COLUMN.*`) | “Kolommen houden eenheden, tientallen en honderden netjes bij elkaar.” | Start with two-digit no-carry sums, then one carry in the ones column; defer three-digit sums and chained carries. | Highlight one column at a time. For a carry, visibly exchange 10 ones for 1 ten before asking what is written and what is carried. |
| Ruler reading (`MEAS.RULER.*`) | “Met een liniaal vind je hoe lang iets is, ook als het niet bij nul begint.” | Begin at zero with whole-centimetre lengths and labelled centimetres; introduce 5 mm marks, then offsets. | Place a bracket from start to end and count the spaces together. Say explicitly that the end number is a position; the distance is end minus start. |
| Division with remainder (`DIV.REMAINDER.*`) | “Eerlijk delen laat zien hoeveel iedereen krijgt en wat er overblijft.” | Start with eight to fifteen objects divided among two or three groups; teach a numeric remainder before a bus/box story. | Drag items into equal groups, then point to leftovers. For contexts, show a two-choice picture: “overblijven” versus “nog één doos nodig.” |
| Dutch clock phrases (`TIME.READ.*`) | “Klokwoorden helpen mensen precies af te spreken wanneer iets gebeurt.” | Start with whole hours and “kwart over”; teach “half” on a clock before asking the child to translate the phrase to digits. | First match phrase ↔ highlighted clock, then clock ↔ digital time, then phrase ↔ digital time. Keep one relationship per first item. |
| Change (`MONEY.CHANGE.Complement`) | “Met wisselgeld kun je controleren of je het juiste bedrag terugkrijgt.” | Use whole-euro prices paid with €2 or €5 before introducing cents and comma input. | Let the child count up with visible coins from price to paid. Explain that the counted-up amount is the change. |
| Unit conversion (`MEAS.*.Convert`) | “Een andere maatnaam vertelt dezelfde lengte, gewicht of inhoud op een handige manier.” | Start with a single familiar anchor (1 m = 100 cm; 1 L = 1000 mL) and values 1–5. Defer reverse direction, kg/g, km/m, and mixed units. | Show the same object or container with two labels; ask which quantity stays the same before asking for the converted number. |

Use Dutch-only child-facing copy in the product, and have a Dutch-speaking adult read it aloud before it ships.

## Implementation plan

### Phase 1 — establish a reusable explanation pattern

1. Extend `GeneratedExercise` with optional, structured S0 teaching data rather than overloading `instructionNl`: `purposeNl`, `microExampleNl`, `guidedActionNl`, and `connectionNl`.
2. In `src/components/ExerciseView.tsx`, render the purpose card for a newly encountered S0 skill and add the on-demand “Waarom leren we dit?” panel for S0/S1. Store “seen” status per learner and skill so it is not repeated on every item.
3. Extend widgets in `src/components/widgets.tsx` only where a visible highlight or one small manipulation is needed. Provide equivalent keyboard controls and text descriptions.
4. Keep the existing hint ladder separate. Purpose-card viewing and the non-scored tiny try must not increase `hintLevel`, reduce evidence weight, or affect promotion.

### Phase 2 — make the easiest generators genuinely easier

1. Add an explicit **S0 starter profile** to each of the eight generator families above. Select it only for fresh/exposure-stage S0 work; existing S1–S3 and review behaviour remain unchanged.
2. Constrain starter numbers and representations as listed in the table. Move to the current `easier` settings after two successful meaningful S0 starter items on different examples.
3. Make the first prompt identify one observable action, not a full calculation. For example: “Where does this jump land?” before “Calculate 46 + 23.”
4. Ensure every correct and incorrect feedback message refers to the immediate visual action and then the rule in no more than two short sentences.
5. Preserve current critical variations, but introduce them later in the bundle: zero positions, bridges, offsets, half-hour direction, remainder interpretation, reverse conversions, and carries must not appear in the very first exposure item.

### Phase 3 — author, test, and calibrate

1. Write a small Dutch copy guide: sentence length, familiar vocabulary, one idea per sentence, no unexplained abbreviations before their first use, and no blame-oriented wording.
2. Create two representative S0 examples per supported skill, including purpose text, a tiny try, expected widget state, feedback, and post-solve connection.
3. Add generator tests for starter constraints and UI tests for the purpose panel, skip/seen behaviour, keyboard access, and evidence neutrality.
4. Run short observed sessions with the daughter (with parent notes, not scored performance targets). Ask after each first item: “Waarvoor zou je dit kunnen gebruiken?” and “Wat veranderde er in de tekening?”
5. Revise wording and starter thresholds based on where she hesitates; do not treat a wrong answer alone as proof that the concept copy failed.

## Acceptance criteria

- A first-time S0 learner sees a brief, skippable Dutch purpose explanation before the first scored item for that skill.
- The first S0 exercise asks no more than one new mathematical idea and one answer action at a time.
- Every supported generator has documented starter bounds that are strictly gentler than its current `easier` cases where needed.
- The child can reopen “Waarom leren we dit?” without affecting hints, correctness records, support tier, or mastery evidence.
- Every guided visual action has keyboard access and a text alternative.
- Existing S1–S3 generation, hint progression, and evidence rules continue to pass their current tests.
- In a small parent-observed trial, the child can give a plausible purpose or visual rule after most first exposures; notes identify remaining unclear concepts for iteration.

## Order and effort

Start with the four most concrete, high-value families: place value, number-line addition, ruler reading, and change. They make the “why” easy to see and establish the reusable UI pattern. Next add clocks and division, then conversions and column addition, where an animated exchange or anchor is especially important.

Do not add a separate global “easy mode” until the starter profile is validated. The existing S0 tier plus the `easier` band already provide the right adaptive hooks; this work should improve their first-exposure content rather than create a parallel progression system.
