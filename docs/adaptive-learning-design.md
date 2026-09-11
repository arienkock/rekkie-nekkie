# Rekkie Nekkie: Adaptive, Intuition-First Learning Design

**Status:** Proposed design; no application implementation.  
**Scope:** Dutch Groep 5/6, client-side and offline-capable.  
**Audience:** Curriculum authors, product/design, and future TypeScript implementers.

### Contents

- [Design decisions and scope](#0-design-decisions-and-relationship-to-the-existing-documents)
- [1. Knowledge graph and mastery](#1-fine-grained-knowledge-graph-and-mastery-taxonomy)
- [2. Adaptive engine and scaffolding](#2-adaptive-engine-and-dynamic-scaffolding)
- [3. CPA, variation, and misconceptions](#3-didactic-framework-intuition-variation-and-misconceptions)
- [4. UX, feedback, and assessment](#4-interactive-ux-didactic-loops-and-feedback)
- [5. Local data architecture and TypeScript contracts](#5-client-side-data-architecture-and-typescript-contracts)
- [6. End-to-end examples](#6-end-to-end-examples)
- [7. Validation and acceptance criteria](#7-design-validation-and-future-implementation-acceptance-criteria)

## 0. Design decisions and relationship to the existing documents

This document executes the [adaptive-learning design brief](design-brief-adaptive-learning.md). It builds on the [curriculum analysis](curriculum-analysis.md), [exercise archetypes and generators](exercise-archetypes-and-generators.md), and [webapp architecture specification](webapp-architecture-spec.md). Those documents remain the content and component baseline; this proposal adds the learning policy, evidence model, interactions, and persistence contracts.

### Core decisions

1. **Teach relationships, not answer patterns.** Each skill has a meaning-making model, an observable action, and an independent/transfer check. A correct answer after a hint is useful learning, but not evidence of independent mastery.
2. **Use a small, interpretable Bayesian Knowledge Tracing (BKT) engine**, supplemented by a separate memory-availability model and explicit mastery gates. Run everything locally; no LLM, server, or cloud analytics is needed.
3. **Separate three axes:** conceptual mastery, task difficulty, and amount of support. A learner can understand a concept but need help reading a story; a fluent calculator can still misunderstand the story.
4. **Use a prerequisite DAG to recommend, not imprison.** Placement probes can bypass already-known foundations. Children may explore any island; unsupported work is offered with a preview or help, not a padlock.
5. **Diagnose using observable evidence and small probes.** An answer signature suggests a misconception; it does not prove one. Do not label a child from one wrong answer.
6. **Retain achievements while refreshing memory.** A long absence creates invitations to review, not lost stars or punitive streak resets.
7. **Keep instructional logic outside SVG widgets.** Widgets report semantic actions; validators interpret them; the adaptive policy chooses the next learning experience.

### Clarifications and deliberate refinements

- The brief calls the mastery scale “4-tier” but lists **five states, Levels 0–4**. Use all five as specified. There are separately **four scaffolding tiers, S0–S3**; their numbering does not correspond to mastery levels.
- On-screen manipulatives are a **digital approximation of concrete experience**, not a claim that dragging SVG blocks equals handling physical objects. Offer optional offline actions with real coins, a ruler, or cups; do not require a camera or upload.
- Scope bounds remain authoritative: four-column DHTE through 9,999, with 10,000 usable as a number-line boundary rather than squeezed into four digit cells; ordinary addition/subtraction principally to 1,000; multiplication facts 1–10 and single-digit by two-digit work; time to five minutes. Two-scaled-factor products are a documented pattern extension, not a requirement to teach general two-digit long multiplication.
- A year is **12 months = 4 quarters**, but **52 weeks + 1 day** in an ordinary year, or **+2 days** in a leap year. “52 weeks” is approximate, not an exact date-arithmetic rule. Calendar items use an explicit year and real month lengths.
- Adjacent *displayed* measurement units do not always differ by ten: m↔km and g↔kg differ by 1,000. Never implement a universal “one position = one zero” ladder for the abbreviated unit lists.
- Arithmetic for money uses **integer cents**, and measurements use integer base units or exact rational quantities. Decimal-comma display is a presentation concern. No binary-floating-point equality tests for answers.
- The existing four-step *Stappenplan* remains the instructional model. Its visible prompts fade with competence; experienced children need not perform four compulsory UI rituals on every story.

### Non-goals

No implementation, backend, teacher surveillance, diagnostic claims about learning disabilities, psychometrically standardized test scores, public leaderboards, or fixed age-based ability labels. Numerical engine settings below are **initial, testable product hypotheses**, not calibrated educational norms.

---

## 1. Fine-grained knowledge graph and mastery taxonomy

### 1.1 What a knowledge component represents

A knowledge component (KC) is an assessable relationship or action that can be isolated in a short task. A widget, a practice screen, and an exercise format are not KCs. For example, a pyramid may assess inverse addition, not a separate “pyramid ability.”

Every item identifies:

- One **primary KC**, whose new learning or retrieval is the purpose.
- Supporting KCs needed by the item, with separate scored steps where feasible.
- Its representation, difficulty dimensions, support policy, and source archetype.
- Which observations can identify a skill independently and which are inseparable composites.

A table-fact family has its own node: knowing the twos must not imply knowing the sevens. Item difficulty retains within-family differences such as `7 × 8` versus `7 × 1`; per-fact coverage prevents repeatedly choosing only easy members. Broader KCs may later be split only if validation shows reliably different learning trajectories.

### 1.2 Edge semantics and readiness

The tables below form the **complete initial prerequisite edge list**. Each listed parent produces a directed edge `parent → child`. Nodes are listed in topological order within and across tables. `—` means no in-scope prerequisite; it does not claim no prior life experience is needed.

- All listed edges are **required-for-instruction** edges, with a default threshold of **Level 1** and current availability of at least **0.55**. Level 2 parents are preferred, not universally required: insisting on fluent facts before showing a multiplication array would obstruct conceptual learning.
- If a required parent is unknown, offer a two-item placement probe or teach the parent, while permitting supported exploration of the child. A recent independent parent success can establish provisional readiness while its full level gates remain unmet.
- Every declared parent is required; there are no implicit OR edges. Alternative calculation strategies are deliberately not prerequisites for each other.
- “Related to,” “inverse of,” and cross-representation teaching links are undirected metadata, **not edges in the DAG**. Thus inverse problems never create cycles.
- Supporting item KCs do not silently become permanent graph prerequisites. A money story can provide an arithmetic subtotal to isolate interpretation without assessing column subtraction.
- A downstream success does not automatically promote all ancestors. An upstream lapse does not erase descendants. Instead, request the smallest relevant check.

**Table convention:** “Observable check” describes the independent KC-specific rubric. The common mastery gates in §1.4 apply to **every** node below. Generated tasks also use the progression dimensions in §2.4.

### 1.3 Initial KC inventory

The initial graph contains **89 KCs and 149 prerequisite edges**, including shared foundations and all four themes.

#### A. Shared number sense and problem-solving foundations

| KC ID | Meaning / observable check | Direct prerequisites |
|---|---|---|
| `FND.COUNT.Group` | Count equal groups and explain that regrouping preserves the total. | — |
| `FND.FACT.AddWithin20` | Compose sums within 20, including crossing ten. | `FND.COUNT.Group` |
| `FND.FACT.SubWithin20` | Find a difference within 20, including crossing ten. | `FND.FACT.AddWithin20` |
| `PV.DHTE.Identify` | Identify the value, not just name, of a digit in D/H/T/E. | `FND.COUNT.Group` |
| `PV.DHTE.Decompose` | Express 5307 as 5000 + 300 + 0 + 7 without losing zero positions. | `PV.DHTE.Identify` |
| `PV.DHTE.Compose` | Reconstruct a numeral from shuffled place-value quantities. | `PV.DHTE.Decompose` |
| `PV.DHTE.Exchange` | Exchange 1 H for 10 T or 1 T for 10 E without changing value. | `PV.DHTE.Compose` |
| `PV.SCALE.TenHundred` | Explain ×10/×100 and inverse scaling by unit value, including zero digits. | `PV.DHTE.Exchange` |
| `NUM.LINE.Interval` | Derive a tick interval from two labels and the number of spaces. | `FND.COUNT.Group` |
| `NUM.LINE.Position` | Locate or read values using an established scale. | `NUM.LINE.Interval`, `PV.DHTE.Compose` |
| `NUM.ROUND.Ten` | Round to the nearest ten using neighboring multiples. | `NUM.LINE.Position` |
| `NUM.ROUND.Hundred` | Round to the nearest hundred, including halfway cases. | `NUM.ROUND.Ten` |
| `REL.ADD.Inverse` | Connect a + b = c with c − a = b. | `FND.FACT.AddWithin20`, `FND.FACT.SubWithin20` |
| `META.MODEL.Quantity` | Identify known quantities and the unknown in a bar, sketch, or grouping model. | `FND.COUNT.Group` |
| `META.EQUATION.Select` | Match a quantity relationship to an equation, not a keyword. | `META.MODEL.Quantity`, `REL.ADD.Inverse` |
| `META.ANSWER.Unit` | State what the numerical answer counts or measures. | `META.MODEL.Quantity` |
| `META.CHECK.EstimateInverse` | Use an estimate or an inverse relation to test plausibility; explain the check. | `NUM.ROUND.Ten`, `REL.ADD.Inverse`, `META.ANSWER.Unit` |

`META.EQUATION.Select` is introduced with additive stories, then checked across operations. Its Level 3 variation gate must include at least two operation families. Operation-specific child tasks provide evidence only for their observed relationship; one additive story cannot establish general modeling mastery.

#### B. Optellen en aftrekken

| KC ID | Meaning / observable check | Direct prerequisites |
|---|---|---|
| `ADD.JUMP.NoBridge` | Partition an addend into H/T/E and accumulate correct endpoints without a bridge. | `PV.DHTE.Decompose`, `NUM.LINE.Position`, `FND.FACT.AddWithin20` |
| `ADD.JUMP.TenBridge` | Cross a ten boundary while preserving the total jump. | `ADD.JUMP.NoBridge`, `PV.DHTE.Exchange` |
| `ADD.JUMP.HundredBridge` | Cross a hundred boundary; e.g. 547 + 70 = 617. | `ADD.JUMP.TenBridge` |
| `SUB.JUMP.NoBridge` | Subtract successive place-value parts in the correct direction. | `PV.DHTE.Decompose`, `NUM.LINE.Position`, `FND.FACT.SubWithin20` |
| `SUB.JUMP.TenBridge` | Subtract across a ten using an equivalent partition or bridge. | `SUB.JUMP.NoBridge`, `PV.DHTE.Exchange` |
| `SUB.JUMP.HundredBridge` | Subtract across a hundred and check the endpoint. | `SUB.JUMP.TenBridge` |
| `ADD.COLUMN.Align` | Align H/T/E and add columns without regrouping. | `PV.DHTE.Compose`, `FND.FACT.AddWithin20` |
| `ADD.COLUMN.Carry` | Regroup ten units into the next column, including a chained carry. | `ADD.COLUMN.Align`, `PV.DHTE.Exchange` |
| `SUB.COLUMN.Align` | Align minuend/subtrahend and subtract without regrouping. | `PV.DHTE.Compose`, `FND.FACT.SubWithin20` |
| `SUB.COLUMN.BorrowCrossout` | Exchange from a nonzero neighboring column and update both columns. | `SUB.COLUMN.Align`, `PV.DHTE.Exchange` |
| `SUB.COLUMN.BorrowAcrossZero` | Regroup across a zero column while conserving the minuend. | `SUB.COLUMN.BorrowCrossout` |
| `REL.ADD.MissingPart` | Solve a missing addend/part in a pyramid or equation and verify it. | `REL.ADD.Inverse`, `ADD.JUMP.TenBridge`, `SUB.JUMP.TenBridge` |

An item requiring a particular column notation assesses that method. An unconstrained arithmetic story accepts any mathematically valid strategy and does not mark *rijgen* wrong because a sample solution uses *cijferen*.

#### C. Meten

| KC ID | Meaning / observable check | Direct prerequisites |
|---|---|---|
| `MEAS.UNIT.Select` | Choose a plausible length, mass, or capacity unit for an object. | `META.ANSWER.Unit` |
| `MEAS.LENGTH.Anchor` | Establish mm/cm/dm/m/km relationships using reference lengths. | `MEAS.UNIT.Select`, `PV.SCALE.TenHundred` |
| `MEAS.LENGTH.Convert` | Convert length by the actual unit ratio, including m↔km. | `MEAS.LENGTH.Anchor` |
| `MEAS.MASS.Anchor` | Establish kg↔g↔mg and half/quarter-kilogram anchors. | `MEAS.UNIT.Select`, `PV.SCALE.TenHundred` |
| `MEAS.MASS.Convert` | Convert by 1,000 and combine/split mass quantities. | `MEAS.MASS.Anchor` |
| `MEAS.CAPACITY.Anchor` | Establish L/dL/cL/mL, including half and quarter liter. | `MEAS.UNIT.Select`, `PV.SCALE.TenHundred` |
| `MEAS.CAPACITY.Convert` | Convert capacity by the actual ratio, in both directions. | `MEAS.CAPACITY.Anchor` |
| `MEAS.MIXED.ComposeSplit` | Convert 4 m 25 cm to 425 cm and invert the representation. | `MEAS.LENGTH.Convert`, `PV.DHTE.Decompose`, `REL.ADD.Inverse` |
| `MEAS.COMPARE.Normalize` | Choose a common unit before comparing differently written quantities. | `MEAS.LENGTH.Convert`, `NUM.LINE.Position` |
| `MEAS.RULER.ZeroStart` | Read endpoint distance from zero, including millimeter subdivisions. | `NUM.LINE.Position`, `MEAS.LENGTH.Anchor` |
| `MEAS.RULER.Offset` | Compute end − start; distinguish position from length. | `MEAS.RULER.ZeroStart`, `SUB.JUMP.TenBridge` |
| `MEAS.SCALE.Interval` | Infer the size of an unlabeled graduation from labeled bounds. | `NUM.LINE.Interval`, `MEAS.UNIT.Select` |
| `MEAS.BEAKER.Read` | Read a level using the beaker's scale, not a memorized picture height. | `MEAS.SCALE.Interval`, `MEAS.CAPACITY.Anchor` |
| `MEAS.MASS.ReadScale` | Read a dial/digital mass scale and supply its unit. | `MEAS.SCALE.Interval`, `MEAS.MASS.Anchor` |
| `MEAS.CONTEXT.CombineLimit` | Normalize, combine quantities, and compare with a recipe or weight limit. | `MEAS.MIXED.ComposeSplit`, `MEAS.COMPARE.Normalize`, `META.EQUATION.Select`, `ADD.JUMP.HundredBridge` |

Mixed-unit, comparison, and context KCs start in length; Level 3 must include length, mass, and capacity. Item-specific supporting tags add the relevant mass/capacity conversion KC. Unknown mass anchors trigger a supplied conversion or a foundation item, not a misdiagnosis of comparison. This makes the generalization requirement explicit without making all three unit families prerequisites for a first mixed-length task.

#### D. Vermenigvuldigen en delen

| KC ID | Meaning / observable check | Direct prerequisites |
|---|---|---|
| `MUL.GROUP.Array` | Connect equal groups, repeated addition, and array rows/columns. | `FND.COUNT.Group`, `FND.FACT.AddWithin20` |
| `MUL.FACT.T1` | Retrieve/derive the ones facts, including missing-factor questions. | `MUL.GROUP.Array` |
| `MUL.FACT.T2` | Retrieve/derive the twos facts. | `MUL.GROUP.Array` |
| `MUL.FACT.T3` | Retrieve/derive the threes facts. | `MUL.GROUP.Array` |
| `MUL.FACT.T4` | Retrieve/derive the fours facts. | `MUL.GROUP.Array` |
| `MUL.FACT.T5` | Retrieve/derive the fives facts. | `MUL.GROUP.Array` |
| `MUL.FACT.T6` | Retrieve/derive the sixes facts. | `MUL.GROUP.Array` |
| `MUL.FACT.T7` | Retrieve/derive the sevens facts. | `MUL.GROUP.Array` |
| `MUL.FACT.T8` | Retrieve/derive the eights facts. | `MUL.GROUP.Array` |
| `MUL.FACT.T9` | Retrieve/derive the nines facts. | `MUL.GROUP.Array` |
| `MUL.FACT.T10` | Retrieve/derive the tens facts. | `MUL.GROUP.Array` |
| `MUL.SCALE.OneFactor` | Relate 4 × 3, 4 × 30, and 4 × 300 by value. | `MUL.GROUP.Array`, `PV.SCALE.TenHundred` |
| `MUL.SCALE.TwoFactors` | Explain the combined scaling in 40 × 30. | `MUL.SCALE.OneFactor` |
| `MUL.SPLIT.Distribute` | Partition 7 × 47 as 7 × 40 + 7 × 7 and recombine. | `MUL.SCALE.OneFactor`, `ADD.JUMP.HundredBridge` |
| `MUL.COLUMN.PartialProducts` | Align partial products with their place values. | `MUL.SPLIT.Distribute`, `ADD.COLUMN.Align` |
| `MUL.COLUMN.Carry` | Relate compressed carrying to the full partial products. | `MUL.COLUMN.PartialProducts`, `ADD.COLUMN.Carry` |
| `DIV.GROUP.EqualShare` | Distinguish number of groups from size of each group. | `MUL.GROUP.Array`, `REL.ADD.Inverse` |
| `DIV.FACT.Inverse` | Use q × d = N to solve exact division and missing-factor questions. | `DIV.GROUP.EqualShare` |
| `DIV.SCALE.CancelFactor` | Explain why scaling both dividend and divisor equally preserves quotient. | `DIV.FACT.Inverse`, `MUL.SCALE.OneFactor` |
| `DIV.REMAINDER.Compute` | Produce q and r with N = qd + r and 0 ≤ r < d. | `DIV.FACT.Inverse`, `SUB.JUMP.TenBridge` |
| `DIV.REMAINDER.CeilContext` | Count enough containers when any leftover requires another one. | `DIV.REMAINDER.Compute`, `META.EQUATION.Select`, `META.ANSWER.Unit` |
| `DIV.REMAINDER.FloorContext` | Count affordable/complete groups without spending or using the remainder. | `DIV.REMAINDER.Compute`, `META.EQUATION.Select`, `META.ANSWER.Unit` |
| `DIV.REMAINDER.LeftoverUnit` | Interpret the remainder in original units and check its bound. | `DIV.REMAINDER.Compute`, `META.ANSWER.Unit` |

Fact nodes are parallel, not a compulsory 1→10 ladder. A seven-times split item tags `MUL.FACT.T7` as supporting evidence; provided partial products can isolate distributive reasoning even when retrieval is not fluent.

#### E. Tijd en geld

| KC ID | Meaning / observable check | Direct prerequisites |
|---|---|---|
| `TIME.UNIT.HourMinute` | Treat one hour as 60 minutes, not 100. | `FND.COUNT.Group` |
| `TIME.READ.MinuteFive` | Read the long hand in five-minute groups. | `NUM.LINE.Interval`, `TIME.UNIT.HourMinute` |
| `TIME.READ.HourProgress` | Read the short hand between numerals as the hour progresses. | `TIME.READ.MinuteFive` |
| `TIME.READ.Digital24` | Connect 12-hour time to morning/afternoon in 24-hour notation. | `TIME.READ.HourProgress` |
| `TIME.READ.DutchHourQuarter` | Interpret uur, kwart over, and kwart voor. | `TIME.READ.HourProgress` |
| `TIME.READ.DutchHourOffset` | Interpret 5/10 over the current hour and 5/10 voor the next hour. | `TIME.READ.DutchHourQuarter`, `FND.FACT.SubWithin20` |
| `TIME.READ.DutchHalfNextHour` | Interpret half 9 as 08:30 or 20:30 with context. | `TIME.READ.DutchHourQuarter` |
| `TIME.READ.DutchPhrasingHalfHourOffset` | Interpret voor/over half around the upcoming named hour. | `TIME.READ.DutchHalfNextHour`, `FND.FACT.SubWithin20` |
| `TIME.CALC.Offset` | Move ±10/15/30/45 minutes across an hour boundary. | `TIME.READ.Digital24`, `TIME.UNIT.HourMinute`, `ADD.JUMP.TenBridge`, `SUB.JUMP.TenBridge` |
| `TIME.CALC.Elapsed` | Find duration by bridging to the next hour; handle an explicit next day. | `TIME.CALC.Offset`, `REL.ADD.Inverse` |
| `TIME.SCHEDULE.SelectInterval` | Select relevant departure/arrival rows before calculating duration. | `TIME.CALC.Elapsed`, `META.EQUATION.Select` |
| `CAL.UNIT.MonthQuarterYear` | Relate months/quarters/years; distinguish exact and approximate week counts. | `FND.COUNT.Group` |
| `CAL.DATE.MonthLength` | Use an explicit year's month lengths, including February when shown. | `CAL.UNIT.MonthQuarterYear` |
| `CAL.DATE.Navigate` | Move dates/weekdays across month and year boundaries. | `CAL.DATE.MonthLength`, `FND.FACT.AddWithin20`, `FND.FACT.SubWithin20` |
| `MONEY.VALUE.Denomination` | Recognize coin/note value independent of physical size or quantity. | `PV.DHTE.Compose` |
| `MONEY.NOTATION.EuroCent` | Connect 475 cent and €4,75; preserve the two cent places. | `MONEY.VALUE.Denomination`, `PV.SCALE.TenHundred` |
| `MONEY.PAY.Exact` | Build and verify an exact amount using available denominations. | `MONEY.NOTATION.EuroCent`, `ADD.JUMP.TenBridge` |
| `MONEY.PAY.Minimal` | Exchange equal-value collections to minimize item count under stated availability. | `MONEY.PAY.Exact` |
| `MONEY.CALC.Add` | Add amounts with cent-to-euro regrouping. | `MONEY.NOTATION.EuroCent`, `ADD.COLUMN.Carry` |
| `MONEY.CALC.Subtract` | Subtract amounts with euro-to-cent regrouping. | `MONEY.NOTATION.EuroCent`, `SUB.COLUMN.BorrowCrossout` |
| `MONEY.CHANGE.Complement` | Count up from price to payment and verify price + change = paid. | `MONEY.PAY.Exact`, `REL.ADD.MissingPart` |
| `MONEY.CONTEXT.DiscountShortfall` | Distinguish price, discount, amount available, shortfall, and change. | `MONEY.CALC.Subtract`, `META.EQUATION.Select`, `META.ANSWER.Unit` |

Recognition may include all euro denominations. Everyday practice defaults to common notes/coins; unusual notes are not implied to be commonly accepted. Minimum-item tasks explicitly state whether supply is unlimited. Greedy validation is permissible only for a verified denomination/supply configuration; arbitrary limited trays need an exact bounded minimum solver in the future implementation. Do not conflate exact payment with minimum-item payment or apply cash rounding unless explicitly taught.

### Archetype and lesson coverage

| Existing content | Primary KC mapping / treatment |
|---|---|
| 1.1 DHTE; 1.2 number-line placement | `PV.DHTE.*`, `NUM.LINE.*` |
| 2.1 rijgen; 2.2 column work | `ADD.JUMP.*`, `SUB.JUMP.*`, `ADD.COLUMN.*`, `SUB.COLUMN.*`; estimate steps separately tag `NUM.ROUND.*` |
| 2.3 pyramids; 2.4 countdown ladders | `REL.ADD.MissingPart` plus observed arithmetic; ladders are sequences, not a global score |
| 3.1 conversion/mixed units/comparison | Family-specific `MEAS.*.Convert`, `MEAS.MIXED.ComposeSplit`, `MEAS.COMPARE.Normalize` |
| 3.2 ruler, beaker, dial/digital scale | Instrument-specific reading KCs plus `MEAS.SCALE.Interval` |
| 4.1 scaling; 4.2 split multiplication | `MUL.SCALE.*`, `DIV.SCALE.CancelFactor`, `MUL.SPLIT.Distribute`; column multiplication uses its own KCs |
| 4.3 remainder; 4.4 remainder stories | `DIV.REMAINDER.Compute`, then the appropriate interpretation KC |
| 5.1 clock; 5.2 time offsets/schedules | `TIME.READ.*`, `TIME.CALC.*`, `TIME.SCHEDULE.SelectInterval` |
| 5.3 calendar | `CAL.*` |
| 5.4 exact/minimal payment; 5.5 arithmetic/change | `MONEY.PAY.*`, `MONEY.CALC.*`, `MONEY.CHANGE.Complement` |
| Money magic squares | Money arithmetic plus additive missing-part reasoning; only use uniquely solvable masks |
| Word problems / *Stappenplan* | Domain KC + separately observed `META.*` steps |
| Curriculum units | Curriculum metadata selects corresponding nodes; unit order is a suggested route, not a second mastery system |

### 1.4 Five mastery states, with evidence gates

Maintain both **highest demonstrated level** and **current verified level**. Unexposed and exposed-but-novice are distinguishable through exposure counts, although both use Level 0. Levels are not percentages rounded into five bins.

A *qualifying independent opportunity* is a fresh, non-revealed item with an attributable first response, no instructional hint or prefilled solution steps, and valid accessible input. A self-created sketch or accessibility accommodation does not invalidate independence. Blank-paper modeling and copying supplied working are different evidence classes. Level 3 inherits Level 2's independence and visit-separation requirements; Level 4 requires an established Level 3, not just a high probability.

| Level | Meaning / child-facing label | Minimum initial promotion gate |
|---|---|---|
| **0 — Unexposed / Novice** | “Nog ontdekken” / “We beginnen samen.” | Default; insufficient reliable evidence. Do not show a failure percentage. |
| **1 — Scaffolded Understanding** | “Met hulp lukt het.” | At least 3 meaningful opportunities across 2 distinct items, including 2 successful learner-generated steps/actions and one prediction before a reveal. Current BKT p(L) ≥ 0.60. Watching an animation or dragging to the only enabled position does not qualify. |
| **2 — Independent Competency** | “Dit kan ik zelf.” | p(L) ≥ 0.85; at least 5 qualifying independent opportunities over at least 2 visits separated by 12 hours; at least 4 of the latest 5 correct; at least 2 task families/representations, one symbolic where appropriate; no unresolved repeated target misconception. |
| **3 — Mastered & Fluent** | “Ik kan ermee spelen.” | p(L) ≥ 0.93; at least 9 of the latest 10 qualifying independent opportunities correct across at least 3 visits; at least 2 unassisted transfer successes, including one inverse/missing-information task; KC-specific critical variation covered; efficient strategy evidence as described below. |
| **4 — Retained** | “Dit blijft bij me.” | Level 3 gates established, plus a continuing series of successful due, independent first-attempt reviews spanning ≥21 days. The series must contain three distinct checks with unrefreshed gaps of at least 1, 7, and 14 days, measured since the preceding meaningful practice/retrieval of that KC, with no intervening failed review. Latest p(L) ≥ 0.93; most recent delayed check includes a changed context or representation. |

**Critical variation** is node-specific: zero positions for DHTE, one and chained regroupings for column carrying, before/after half and 12-wrap for Dutch half-hour offsets, both directions for conversion, exact and non-exact division for rounding context. Fact-family Level 3 needs coverage of all ten multipliers and at least three missing-factor/inverse items, rather than ten repeats of one fact.

**Fluency without speed anxiety:** record active response time only within comparable item families, language load, and input mode. Use a learner's own recent independent median and strategy efficiency (e.g. a direct fact or deliberate derived fact, not recounting every object). Three efficient independent performances can satisfy the fluency rubric. If timing is unreliable or disabled, use observed efficient strategy instead. Never impose a universal seconds-per-answer gate, penalize slow motor input, or infer misunderstanding from reading time. Optional fact-fluency practice has no visible countdown by default.

An established learner may demonstrate Level 2 or 3 without first completing Level 1 activities; the highest fully satisfied gate wins. Placement data may contribute qualifying evidence but cannot fabricate multi-day retention.

**Reassessment policy:** one error opens a question, not a demotion. Two independent failures on the KC among the latest three comparable checks, followed by an isolating confirmation, may lower the current verified level to the highest supported level. Preserve the historical achievement. Mere elapsed time only changes freshness to `due`/`refresh`; it never decrements a level. A Level 4 lapse suspends current retained status after confirmation, restarts the delayed-success series, and retains “you have done this before.”

---

## 2. Adaptive engine and dynamic scaffolding

### 2.1 Architecture boundaries

```text
Versioned curriculum/KC graph + generator/rubric catalogs
                      ↓
Local learner state → Evidence & memory model → Candidate selector
                              ↑                       ↓
                        Evidence ledger        Exercise plan + seed
                              ↑                       ↓
                 Step validators/diagnostics ← Interaction controller
                              ↑                       ↓
                      Semantic actions ← SVG/input/accessibility views
```

- **Content catalog:** static nodes, prerequisites, variation plans, misconception rules, generators, and rubrics.
- **Evidence reducer:** deterministic updates from immutable observations; owns BKT, level gates, and review history.
- **Selector:** scores eligible plans; returns an explanation such as “review due” or “check clock reference hour.”
- **Scaffold controller:** chooses help within an exercise and records its effect on evidence eligibility.
- **Widgets:** render mathematical state and report actions such as `exchange 1T → 10E`; they do not award mastery.
- **Persistence adapter:** saves JSON snapshots and a bounded evidence journal. All modules operate without a network connection.

A seeded problem is deterministic. Adaptive selection is reproducible from a policy version, local state revision, selection seed, and stored decision summary; it is not reproducible from the exercise seed alone.

### 2.2 BKT with separate forgetting/availability

Use one BKT belief per KC. Start with shared defaults; allow versioned overrides only after classroom calibration.

| Parameter | Initial default | Meaning |
|---|---:|---|
| p(L₀) | 0.20 | Prior knowledge before observed evidence; no demographic prior. |
| p(T) | 0.08 | Chance of learning from one meaningful instructional episode. |
| p(G) | 0.10 | Correct without knowledge, for a standard open-response independent item. |
| p(S) | 0.10 | Incorrect despite knowledge, for that baseline item. |

Probabilities are clamped to `[0.01, 0.99]` when used in likelihood calculations. A stored belief is never interpreted as a standardized probability of school attainment.

#### Model task and support effects

For support S0/S1/S2/S3, initial `(g, s)` pairs are `(0.55, 0.03)`, `(0.30, 0.06)`, `(0.10, 0.10)`, `(0.06, 0.15)`. S0's high `g` explicitly represents the chance of succeeding through assistance without independent knowledge. S3 has more transfer load. These are starting priors, not measured constants.

Item difficulty has a bounded logit offset `b`: easier `−0.6`, standard `0`, harder `+0.6`, with curriculum dimensions supplying finer authored bands later. Define:

- `gᵢ = sigmoid(logit(g) − b)`
- `sᵢ = 1 − sigmoid(logit(1 − s) − b)`

Use item-specific guess rates for choice questions, no lower than chance under the actual distractor structure. Pure drag-to-only-valid-slot completion carries no assessment weight. Prefer production, prediction, explanation-by-model, and missing-part items to multiple choice.

#### Keep learning and memory distinct

Let:

- `p = p(Lₜ)`: stored conceptual-knowledge belief after previous observations.
- `Δ`: elapsed days since the last meaningful memory refresh, never negative.
- `S`: stability half-life in days.
- `R = 2^(−Δ/S)`: memory availability given learned knowledge; use `R = 1` before the first instructional exposure.
- `r = p × R`: currently available knowledge for selection/readiness.

The predicted first-attempt correctness of an isolated KC item is:

`P(correct) = r(1 − sᵢ) + (1 − r)gᵢ`.

Do not overwrite stored p(L) every day with `r`; that would repeatedly compound forgetting and erase learned knowledge. To use an observation without double-counting forgetting, set:

- `a = R(1 − sᵢ) + (1 − R)gᵢ`, the success likelihood given conceptual knowledge.
- For a correct response, `ℓL = a`, `ℓU = gᵢ`.
- For an incorrect response, `ℓL = 1 − a`, `ℓU = 1 − gᵢ`.
- `posterior = p × ℓL^w / [p × ℓL^w + (1 − p) × ℓU^w]`.

`w` is an evidence-tempering weight, not a fractional mark. Initial policy: independent isolated first response `1.0`; attributable first sub-step in a multi-skill task `0.6`; meaningful scaffolded prediction `0.35`; revealed, copied, or repeated same-item response `0`. Already-scaffolded likelihoods and tempering are deliberately conservative. Recalibrate them together, not by silently treating supported correctness as independent.

After **meaningful instruction with an active learner action**, at most once for the KC/item episode:

`p(next) = posterior + (1 − posterior) × p(T)`.

Otherwise `p(next) = posterior`. Unknown/unassessed observations have weight zero and do not supply correctness evidence. A displayed explanation alone is not a learning transition. Assessment before deferred feedback uses `p(T)=0`. Instruction can reset `lastMemoryRefreshAt` but **does not postpone the independent review due date**. An independent successful retrieval refreshes memory and may advance its interval.

**Worked update:** with fresh memory, p=.70, standard independent g=.10/s=.10, a correct response gives `.63/(.63+.03)=.955`; an incorrect response gives `.07/(.07+.27)=.206`. A subsequent meaningful intervention changes the latter to `.206 + .794×.08 = .269`, not back to mastery. Evidence-count gates prevent one lucky correct response from awarding Level 2. After a long absence, low R makes a failure less decisive about conceptual knowledge and more suggestive of a needed refresh.

#### Attribution and correlated observations

1. Save the first committed response for each scored step before giving a hint or revealing correctness.
2. A single item contributes at most **one observation update per KC**. Aggregate its rubric to one decisive attributable observation; do not count the answer, carries, and final check as three independent successes on the same KC.
3. Distinct isolated steps may update distinct KCs. Their weights are recorded so a story does not yield an inflated global score.
4. An unexplained wrong final answer on a composite task is `unknown` for causal attribution. Store the item failure, then probe. Do not penalize every tagged KC.
5. If intermediate arithmetic is correct but bus interpretation is wrong, apply the negative evidence to `DIV.REMAINDER.CeilContext`, not `DIV.REMAINDER.Compute`. The separately observed correct calculation may supply its own positive evidence.
6. Same-item retries teach but do not create new independent evidence. A fresh diagnostic is a new item with its own observation, never retroactive proof about unobserved earlier steps.
7. Corrections without instructional feedback before submission are normal working. A device/input failure can void evidence, with an auditable reason.
8. Observation updates and later learning transitions are separate ordered journal events. Before a practice item suspends for a child probe, apply its captured observations once; returning to the parent cannot replay them. A later learning transition acts on the latest belief, not a stale parent-item posterior. Stored before/after values are audit outputs, never commands that overwrite newer state.

### 2.3 Review scheduling and retention

After the first qualifying independent success, schedule an early check after **1 day**. Successful due first-attempt reviews advance the gap ladder **1, 3, 7, 14, 30, 60 days**; a new KC cannot jump to 60 days because of fast same-day drills. Before Level 3, cap at 14 days; keep variation/transfer work in acquisition sessions.

Convert each selected interval `I` to a half-life `S = I × ln(2) / −ln(0.85)`, so memory availability is about .85 at its due date if there has been no intervening refresh. The target concerns **R**, not p(L). Initialize exposed novice memory with `I=1` and its corresponding S even before an independent review is scheduled. Store the interval and stability consistently. Early practice can refresh availability but does not advance a review rung or move an existing due date later.

A review advances its rung only if it is due, independent, correct, and the **actual gap since the last meaningful memory refresh is at least the scheduled interval**. Otherwise it can still contribute competency evidence, but not spaced-retention credit. Maintain a separate `reviewNotBeforeAt = lastMemoryRefreshAt + intervalDays` after an early practice/help episode; the original due date remains visible, while this cooldown prevents repeatedly offering a just-refreshed review. The selector's review pool requires both dates to have arrived. Level 4 uses unrefreshed gaps too: daily hints followed by correct answers cannot masquerade as three spaced recalls.

- Failed due independent review: keep the observed evidence, mark `refresh`, return interval to one day, and offer a targeted lesson. Only a fresh subsequent success starts the new delayed-success series.
- Help requested during a review: finish it as supported practice, not a successful retrieval review. Keep it due and schedule a fresh independent check later, rather than immediately looping the same question.
- A severely overdue item can be previewed with a gentle reminder if predicted success is very low. That is teaching, followed by a later fresh retrieval check, not a “passed review.”
- Skipped review: no correctness update, no loss of achievement. Preserve the due date.
- Detect observable wall-clock discontinuities against monotonic elapsed time while running, and flag backward timestamps or implausible saved-date changes on resume; clamp negative elapsed time to zero. Suspect gaps cannot establish Level 4 automatically. A real long absence and a clock change while the app is closed are not always distinguishable: confirmation and later ordinary reviews are recovery options, not anti-cheat certification. No client-only system can certify elapsed time against deliberate tampering.

Review uses changed surface details and rotates representations. It must test the skill, not recognition of yesterday's seed. Level 4 is earned from actual qualifying gaps, not scheduled dates or merely reaching a review rung.

### 2.4 Problem difficulty and selection

Represent challenge as an authored vector rather than a single global “level”:

| Dimension | Example progression |
|---|---|
| Numerical range | Two-digit → three-digit; ordinary arithmetic stays within its scope. |
| Structural difficulty | No bridge → one ten bridge → hundred/chained bridge → zero crossing. |
| Representation | Familiar arrangement → changed layout → symbols → context/inverse. |
| Information load | All relevant facts adjacent → choose between relevant/irrelevant facts. |
| Language load | Short familiar sentence → schedule/story; optional narration never counts as a math hint. |
| Strategy choice | Named method → compare two methods → choose and justify. |
| Unit/context complexity | Same unit → conversion → context-dependent interpretation. |

During acquisition change **one critical dimension at a time**. During transfer deliberately combine already-established dimensions. A minimal-difference bundle usually has three items; item difficulty and scaffold level are not simultaneously increased after a success.

#### Session composition and algorithm

Default daily invitation: **8–12 minutes or 6–10 items**, with a stop/continue choice. Across a rolling window of ten fresh item starts, aim for **5 growth, 3 review, 2 transfer/mixed**. Diagnostic probes may replace those slots; they do not lengthen a child's commitment. Quotas are soft except for the anti-starvation protections below.

For every next item:

1. **Honor intent.** Resume saved work; respect chosen theme, available time, and accessibility settings. In free practice, suggest one due review outside the chosen skill, but do not silently hijack the session.
2. **Handle an active diagnostic branch**, maximum two short probes before returning to useful instruction. A confirmed parent issue selects the nearest failing relevant ancestor, not the beginning of the curriculum.
3. **Protect review.** In adaptive daily mode, if reviews are due and none occurred in the last three item starts, reserve the next slot. On a large backlog, cap review at half the session and distribute the remainder across future visits. All-due or all-mastered profiles may explicitly choose a review-only session.
4. **Construct pools:** due review KCs; ready frontier KCs with Level 0–2; Level 2–3 transfer KCs; current variation-bundle continuation. Cold-start candidates are isolated placement probes rather than all-new hard stories.
5. **Generate a small bounded candidate set** (e.g. at most 30 plans before generating full SVG payloads). For each, estimate success, prerequisite readiness, review urgency, evidence gaps, novelty, and continuity. Avoid the same exact seed or answer-pattern fingerprint from the recent 20 items.
6. **Target .70–.80 predicted success** for growth; accept .65–.85 if necessary. Review has a wider acceptable band of .70–.95; do not manufacture difficulty merely to push an easy review down to .75. For reference, the default model with p=.95, R=.85, g=.10, and s=.10 predicts .746, not .95: conceptual mastery and expected delayed performance are different quantities. Transfer targets roughly .65–.80 with an opt-out.
7. **Rank within the chosen pool** with the following interpretable score, all terms normalized to `[0,1]`:

   `score = .30×ZPDfit + .25×reviewUrgency + .20×evidenceNeed + .15×learnerIntent + .10×bundleContinuity − .20×repetitionPenalty`.

   `ZPDfit = max(0, 1 − abs(Pcorrect − .75)/.25)` for growth; use the pool-specific range for review. `reviewUrgency` is capped normalized overdue time relative to interval. `evidenceNeed` prioritizes uncertain/borderline KCs and missing rubric coverage, not just low scores. Use a seeded tie-break. Store the winning reason and prediction for local explainability.
8. **Choose support and one difficulty dimension** together from the permitted plans, then apply fading hysteresis (§2.5). If no growth candidate can reach .65, do not fake a .75 estimate: choose a simpler prerequisite or a worked-example/prediction lesson. If all candidates exceed .85, fade support or select variation/inverse work; do not inflate the number range beyond the curriculum.
9. After a three-item acquisition bundle, interleave another operation, unit, or review before another bundle on the same feature. Never block all practice on a single unsuccessful item.

For inseparable multi-KC tasks, use a weakest-link ranking heuristic: `rComposite = min(r of non-provided essential KCs)` with item-level g/s. This is not a proven lower bound on joint success and can overestimate success when several skills are shaky. Do not multiply marginal skill probabilities as if independent. Label the estimate low-confidence; prefer one extra support layer when several essential KCs are uncertain. Such multi-skill outcomes are not used for indiscriminate BKT updates. Prefer isolated probes when uncertainty matters.

**Cold start:** invite one preferred island, then up to six brief adaptive probes sampling place value, arithmetic, measurement, groups, clocks, and money over the first visits. Start moderate; raise/lower based on evidence, stop on fatigue, and allow “Ik weet het nog niet.” Unknown skills remain unknown. A small diagnostic does not assert coverage of the entire graph.

### 2.5 Four-tier scaffold controller

| Tier | Experience | Example / evidence policy |
|---|---|---|
| **S0 — Full** | Linked manipulative, explicit quantities, one actionable step, optional modeled example followed by a prediction. | Drag/exchange DHTE blocks; clock snap guides; number-line jump controls. Only meaningful unforced predictions contribute low-weight scaffolded evidence. |
| **S1 — Partial** | Representation and step structure remain; learner supplies intermediate values and explains a relation. | Fill 347 → 547 → 617 → 625, label +200/+70/+8; no auto-filled carries. Attributable first steps can supply evidence, but supplied structure does not establish abstract independence. |
| **S2 — Faded** | Symbolic task with optional expandable scratchpad; no revealed next step. | `347 + 278 = ?`; empty number line available. Independent eligibility depends on help actually used, not the fact a button exists. |
| **S3 — Challenge / Transfer** | New context, inverse task, or comparison; no provided instructional visual aids. | “The total is 625; one part is 347. What is the other?” Blank self-created drawing, keyboard entry, narration, and accessibility tools remain available. |

**Fading rules, per KC and representation:**

- Start at S0 for a genuinely unfamiliar relation, S1 for weak foundations, S2 for plausible prior competence, S3 only when independent/variation evidence supports it.
- Fade **one tier on the next fresh item**, after three meaningful first-attempt successes across at least two items, no additional conceptual hint beyond the planned tier in the last two, and at least one prediction or model-to-symbol explanation. For S1→S2 also require p(L)≥.75; S2→S3 requires Level 2 and at least one changed-representation success.
- Multiple correct substeps on one prompted problem do not satisfy the three-success rule. Forced S0 placements do not count.
- After fading, hold numerical/structural difficulty constant for at least two items. A transfer success may lead to a harder transfer, not automatic removal of every support everywhere.
- Offer help after a wrong submission or a learner's help request. Do not auto-reveal answers based on an idle timer. A single slip receives a local prompt; two attributable errors in the latest three comparable items or a confirmed misconception move one tier toward more support.
- Learner-requested support is always available. Within an item, expand one layer at a time: identify relationship → show model → demonstrate one step → worked example. Record which information became available and whether it reveals the answer.
- If help is opened during S3, reclassify the attempt's evidence by actual assistance. Finish positively; schedule a new transfer later. Never preserve “unassisted” status merely because the item started as a challenge.
- Once support is expanded, do not remove it mid-item. Success/failure streaks reset when support changes, preventing oscillation.

**Accessibility is not scaffolding:** a larger clock, high contrast, audio narration of the original prompt, switch controls, text descriptions of visible information, and extra time do not reduce evidence eligibility. An accessibility description must not disclose a hidden interval or the answer. A pre-labeled mathematical solution is instructional help, regardless of whether delivered visually or by speech.

---

## 3. Didactic framework: intuition, variation, and misconceptions

### 3.1 CPA bridges and the invariant each bridge preserves

Every bridge uses **predict → act → notice what stayed equal → write → reverse/check**. Models and notation share quantity identities and highlight links on selection, but never depend on color alone. Move both ways through CPA: abstract difficulty can reopen a model without presenting that as regression.

| Theme | Concrete / digital action | Pictorial model | Abstract bridge and transfer |
|---|---|---|---|
| Addition/subtraction | Bundle ten ones into a ten; exchange a hundred for tens. Optional physical counters. | DHTE table next to an open number line. | In 347 + 278, jumps +200/+70/+8 reach 625. DHTE regrouping separately shows 15 E → 1 T + 5 E and the next carry. The equality links both strategies; a jump is **not** claimed to be literally the same operation as a carry. Compare strategies, then solve a missing addend. |
| Subtraction/regrouping | Exchange 1 H into 10 T and 1 T into 10 E without changing the starting quantity. | Decomposition of 402 as 3 H + 9 T + 12 E beside a backward line. | `402 − 178 = 224`; crossouts record a new equivalent representation of 402, not arbitrary digit changes. Verify `224 + 178 = 402`. |
| Measurement | Move the same object along a ruler; fill identical 100 mL cups into a liter vessel. | Endpoint brackets, scaled ticks, tiled reference strips, linked unit table. | `length = end − start`; `8,5 cm = 85 mm`; `1 L = 10 dL = 1000 mL`. Quantity is invariant while numeral/unit changes. Transfer to an offset tool or a differently graduated beaker. |
| Multiplication | Arrange seven rows of 47 using bundles and units. | Area rectangle split into widths 40 and 7; dimensions explicitly labeled. | `7(40 + 7) = 280 + 49 = 329`. Column carrying compresses the same partial products. Compare 4×30 and 40×30 by scaling units, not by a detached zero-appending rule. |
| Division | Place 32 counters in six-seat vehicles, or buy €6 items from €32. | Group/bar model with five complete groups and two remaining original units. | `32 = 5×6 + 2`, `0≤2<6`. The arithmetic is identical; the question chooses six vehicles, five purchases, or two euros left. Ask for the original total given q, d, r. |
| Time | Move coupled clock hands; optionally turn a physical teaching clock. | Unwrap the minute ring to a 60-minute line, anchor half 9 at 08:30. | `08:30 − 10 min = 08:20`: “10 voor half 9.” Link hour movement continuously. Elapsed time becomes segment addition rather than subtracting base-100 clock strings. |
| Money | Exchange equal-value coin/note sets in a tray. | Cent/euro columns and a count-up change line. | `€1,80 + €0,20 = €2,00`; `100 cent = €1`. Minimum item count is an optimization **after** equality is satisfied. Invert price/payment/change roles. |
| Calendar | Move a date token on an actual month grid. | Consecutive date strips across the month boundary. | Count day offsets using the displayed year's month lengths; contrast “four weeks” with “one month.” |

The child should make a prediction before an explanatory animation. At least one later item removes the representation and another asks the child to select or construct an appropriate model. A perpetually animated app is not automatically a CPA app.

### 3.2 Minimal-difference and generalization sequences

A sequence has a declared **invariant**, exactly one initial changing dimension, an anticipated noticing statement, and a fresh transfer check. Do not reveal all answers before the learner predicts. Minimal contrasts come first; mixed retrieval comes later so children also learn to choose the right method.

| Sequence | Tasks in order | Intended noticing / subsequent transfer |
|---|---|---|
| Place value and zero | `5307 → 5370 → 5037`, then reconstruct `5D + 0H + 3T + 7E`. | Same digit set, different positions. Zero preserves the empty place. Transfer: diagnose an incorrectly composed number. |
| Carry boundary | `346+2=348`, `346+3=349`, `346+4=350`, `346+5=351`. | Only the addend changes by one; at ten ones an exchange is needed, not a new addition rule. Later compare `396+4` with `346+4` to introduce a second boundary. |
| Borrow versus digit difference | `54−21=33`, `54−22=32`, `54−23=31`, `54−24=30`, `54−25=29`. | Only the subtrahend changes; at the boundary, exchange preserves value. Later extend `402−178` as a separate zero-crossing dimension. |
| Scaling one factor, then another | `4×3=12 → 4×30=120 → 40×30=1200`. | First scale one factor by ten, then the other. Predict tenfold products with unit labels. Follow with `1200÷30=40`, then contrast `120÷3` and `1200÷30` to show quotient invariance. |
| Distribution | `7×40=280 → 7×41=287 → 7×42=294`, then `7×47=329`. | Each extra column adds seven, and splitting does not lose or duplicate area. Transfer: choose the correct split among `7×40+7`, `7×40+7×7`, and other modeled alternatives. |
| Remainder meaning | Same computation `32÷6=5 rest 2`; ask vehicles for 32 children, €6 books from €32, then money left. | Only the requested quantity/context changes: 6 vehicles, 5 books, €2 left. Contrast with `30÷6` to show that “vehicles means always add one” is false. |
| Ruler origin | Same 85 mm object at `[0,85]`, `[10,95]`, `[30,115]` mm. | Only origin changes; length stays 85 mm. Transfer to a cropped/broken ruler with no zero visible. Keep virtual scale clear; do not pretend screen centimeters are physically calibrated. |
| Instrument graduation | Same 500 mL maximum and 300 mL level; tick spacing 50, then 100 mL. | Liquid amount stays fixed, count of tick intervals changes. Then hold graduation fixed and change the level. Transfer to an unfamiliar but linearly scaled vessel. |
| Unit quantity versus numeral | `1 L = 10 dL = 100 cL = 1000 mL`; then compare `1 L` and `900 mL`. | Smaller unit implies more units for the same quantity. Contrast `1 kg = 1000 g` to prevent assuming every displayed neighbor differs by ten. |
| Dutch half-hour anchor | `half 9=08:30 → 5 voor half 9=08:25 → 10 voor half 9=08:20`; separately `half 9 → 5 over half 9 → 10 over half 9`. | First vary distance on one side of the fixed anchor. Then contrast voor/over with equal five-minute distance. Transfer to “10 voor half 1” and an explicitly evening context. |
| Elapsed hour boundary | Start 10:50; end 10:55, 11:00, 11:05, 11:10. | End advances in five-minute increments; the hour rollover is not a jump of 45 or 100 minutes. Transfer to a timetable with an irrelevant row. |
| Money regrouping | `€1,70+€0,20=€1,90 → €1,80+€0,20=€2,00 → €1,90+€0,20=€2,10`. | Hundred cents become a euro; comma columns preserve value. Transfer: give payment and change, ask for price. |
| Month boundary | On a calendar for an explicit non-leap year, move one day from 28, 29, 30 April, then 1 May. | Weekday succession continues even though the date resets. Later change only month to contrast April/May lengths. |

At the end ask an accessible “Wat veranderde? Wat bleef hetzelfde?” response: select a linked model/equality, complete a phrase, or give an optional spoken explanation to a nearby adult. The app does not pretend to score unrestricted speech or drawings. Automated evidence comes from structured relationships, not keyword matching a child's prose.

### 3.3 Misconception library and automated interventions

Each rule stores a signature, competing explanations, a short isolating probe, and an intervention. One signature is **suspected**. Two fresh consistent observations, including a discriminating probe, can make it **supported**. Contradictory evidence marks it uncertain or resolved; it is never a permanent identity label.

| ID / affected KC | Observable signature and discriminating probe | Targeted visual feedback and fresh exit check |
|---|---|---|
| `MC.PV.ZeroCollapse` / `PV.DHTE.Compose` | Writes 537 for 5D+3H+0T+7E. Ask to place each digit/value into a labeled DHTE table; distinguish a missing keystroke. | Keep an empty tens slot visibly present; slide quantities into positions with text value labels. Exit: compose 6042 from counters without labels. |
| `MC.ADD.CarryLost` / `ADD.COLUMN.Carry` | For 347+278 writes 515 or omits a recorded carry. Probe only 7E+8E and the exchanged quantity. | Gather ten of the fifteen ones into one ten; move it to T while retaining five E. Highlight both affected columns. Exit: a new sum with the carry in a different position. |
| `MC.SUB.AbsDigit` / `SUB.COLUMN.BorrowCrossout` | Gives 47 for 52−19 by subtracting the smaller digit from the larger in each column. Ask whether the answer can satisfy `19+?=52`, then probe `12−9`. | Show that two ones cannot supply nine; exchange one ten, then remove nine ones. Compare the learner's result with an inverse check. Exit: 63−28 with no exchange prompt. |
| `MC.SUB.ZeroChain` / `SUB.COLUMN.BorrowAcrossZero` | Changes 402 to 3H+10T+12E, increasing its value. Probe the value of their rewritten minuend before subtracting. | Make two explicit exchanges: 4H0T2E → 3H10T2E → 3H9T12E; a total-value label remains 402. Exit: a different subtraction across a zero. |
| `MC.LINE.EndpointNotJump` / `ADD.JUMP.HundredBridge` | Labels a +70 jump as +617, or makes 547+70 land on 607. Probe difference between two supplied endpoints. | Separate “where am I?” endpoint labels from “how far?” arc labels; animate a +70 distance and a bracket around the overshoot/shortfall. Exit: fill an unlabeled jump from fresh endpoints. |
| `MC.MEAS.OriginOne` / `MEAS.RULER.Offset` | Reports 115 mm rather than 85 mm for endpoints 30 and 115, or measures from 1 cm without compensation. Ask whether sliding the object changes its length. | Translate the ruler/object origin without stretching the object; maintain a length bracket and show `115−30=85`. Exit: read an offset on a cropped ruler. |
| `MC.MEAS.CountTicks` / `MEAS.SCALE.Interval` | Counts marks instead of spaces, or assumes every mark is one unit. Ask for the interval between 0 and 100 over four spaces. | Pulse the four **spaces**, place 25-unit segments, then recombine to 100. Exit: a scale with different endpoints and interval count. |
| `MC.MEAS.Direction` / family conversion KC | Converts 2 L to 0,002 mL or 2 kg to 20 g. Ask which container/count should be larger before calculation. | Fill the large unit with labeled equal smaller units; keep total quantity constant while the numeral changes. Show the actual ratio, including 1,000 where needed. Exit: reverse-direction conversion in that family. |
| `MC.MEAS.CompareNumerals` / `MEAS.COMPARE.Normalize` | Says 900 mL > 1 L because 900>1. Supply `1 L=1000 mL` to isolate comparison from anchor recall. | Overlay equal-scale bars normalized to mL. Ask for the comparison before displaying the sign. Exit: another quantity pair with opposing numeral order. |
| `MC.MUL.ZeroRule` / `MUL.SCALE.TwoFactors` | Gives 120 for 40×30, or cancels a zero from only one side of a division. Probe 4×30 first. | Relabel one dimension of an array in tens, then the other; 12 hundred-sized cells represent 1200. For division, scale both quantities visibly. Exit: reverse a scaled missing-factor relation. |
| `MC.MUL.DistributionLost` / `MUL.SPLIT.Distribute` | Uses 7×40+7 for 7×47. Ask the value of the seven-by-seven right-hand area alone. | Highlight the two areas and shared height seven; recombine 280 and 49 with no overlap. Exit: choose and complete a new decomposition. |
| `MC.DIV.RemainderTooLarge` / `DIV.REMAINDER.Compute` | Writes 53÷8=5 rest 13. Ask whether another complete group fits. | Move eight of thirteen remaining counters into one more group; five remain. Display `53=6×8+5` and `5<8`. Exit: compute a new q/r pair and check both invariants. |
| `MC.DIV.AlwaysRound` / ceil/floor KC | Chooses five buses for 32 children or six €6 books with €32; always adds one even for exact division. First supply correct q/r to isolate interpretation. | Place two children without seats, or show the sixth book exceeds the budget. Keep the same arithmetic on both cards. Exit: a new paired context, including an exact-division case. |
| `MC.DIV.RemainderUnit` / `DIV.REMAINDER.LeftoverUnit` | Calls the rest “2 buses” instead of two children/euros. Ask the unit of one original counter. | Color-and-label groups separately from individual leftover objects; original-unit labels remain attached to leftovers. Exit: answer a leftover question in another familiar context. |
| `MC.TIME.HalfReference` / `TIME.READ.DutchHalfNextHour` | Interprets half 9 as 09:30. Probe half 3 without offset wording. | Anchor the upcoming hour at 09:00 and move back half an hour; short hand stays between eight and nine. Exit: half 12, then an explicitly afternoon example. |
| `MC.TIME.HalfDirection` / `TIME.READ.DutchPhrasingHalfHourOffset` | Maps “10 voor half 9” to 08:40. First confirm half 9=08:30. | Place an anchor at 08:30, rewind ten minutes to 08:20, then contrast forward motion for “over.” Hour hand moves with minutes. Exit: “5 over half 7” with no reference label. |
| `MC.TIME.HourHandStatic` / `TIME.READ.HourProgress` | Puts the short hand exactly at eight for 08:55 or reads nine too early. Probe which hour has fully passed. | Sweep minute and hour hands together; hour angle advances continuously. Highlight “bijna negen, nog acht uur.” Exit: a different near-hour clock. |
| `MC.TIME.Base100` / `TIME.CALC.Elapsed` | Computes 10:55→11:10 as 55 minutes. Probe 10:55→11:00 separately. | Unwrap the clock into +5 then +10-minute segments; replace an invalid 100-minute hour with sixty ticks. Exit: a different hour crossing, then a schedule interval. |
| `MC.MONEY.DecimalPlace` / `MONEY.NOTATION.EuroCent` | Treats €4,5 as four euros five cents or writes 475 cents as €47,5. Ask for coins representing the fractional part. | Link €4,50 to 4 euros + 50 cents; make the tenths-of-euro/ten-cent relationship explicit. Exit: format 405 cents and compare €4,05 with €4,50. |
| `MC.MONEY.CountNotValue` / `MONEY.PAY.Minimal` | Assumes more coins means more money, or marks a valid exact tray wrong because it is not minimal. Probe equal totals with different coin counts. | Exchange five 20c coins for €1 while total stays fixed and item count decreases. Validate equality first, optimality second. Exit: build two equivalent trays and identify the smaller count. |
| `MC.CAL.FixedMonth` / `CAL.DATE.Navigate` | Adds 30 to every month, or treats four weeks as every month. Probe the last date on the displayed month. | Slide a continuous weekday strip over the actual month boundary; show unfilled extra days beyond four weeks. Exit: navigate a different month using an explicit year's calendar. |

When arithmetic, language, and tool use are all plausible causes, ask a simpler structured question instead of launching a confident animation about the wrong cause. Feedback says “Laten we de tientallen bekijken,” not “You have the borrowing misconception.”

---

## 4. Interactive UX, didactic loops, and feedback

### 4.1 Core learning state machine

| State | Entry/action | Exit / invariant |
|---|---|---|
| `selecting` | Select plan, validate generated item, save seed and policy decision. | To `presenting`; invalid generator output is discarded, never shown or scored. |
| `presenting` | Show concise Dutch prompt, required information, unit, and help affordance; optionally narrate. | To `working` on start/interaction; do not start active solve timing during navigation. |
| `working` | Accept symbolic inputs, scratchpad actions, and *Stappenplan* steps. Autosave committed semantic actions. | To `submitting`, `paused`, or `deferred`. Hints alter assistance provenance immediately. |
| `submitting` | Freeze first-response snapshot; normalize valid notation; run deterministic step rubrics. | To `feedback` or `diagnosing`. Invalid formatting remains in `working`, with no wrong-math evidence. |
| `diagnosing` | Match error signatures to observed steps; produce uncertain hypotheses, optionally queue a fresh probe. | To `feedback`; unresolved composite errors do not generate blanket KC penalties. |
| `feedback` | Affirm what is valid; locate one actionable discrepancy; offer retry, model, or explanation. | Correct → `reflecting`; incorrect → `retrying`, `remediating`, or `deferred`. No automatic answer reveal. |
| `retrying` | Keep the original item, preserve correct work, allow correction. | To `submitting`; retry is not a new independent observation. After two unsuccessful retries, offer remediation or another item. |
| `remediating` | Targeted model with prediction/action, optionally a separate diagnostic mini-item. Parent exercise is suspended while a child probe runs. | Back to `retrying`, to a fresh exit-check item, or to `deferred`. At most two probes per branch. |
| `reflecting` | Brief “why it works,” inverse check, or comparison of methods. Do not require an explanation on every routine review. | To `committing`. Any revealed check cannot become independent evidence. |
| `committing` | Commit one idempotent evidence batch, optional learning transitions, level gates, and review effects. | To `completed` after local save or a visible “not saved” recovery path. |
| `completed` | Show one specific accomplishment and offer next or stop. | Back to selector or session summary. |
| `paused` | Freeze active timing, persist working state, preserve assistance and response history. | Resume the prior state; never regenerate a different item under the same ID. |
| `deferred` | Learner skips/stops; preserve unfinished work and any already-submitted evidence. | To `committing` with a deferred outcome, or resume later. No answer is not an incorrect answer. |

There is no silent path from an unsubmitted answer to a negative mastery update. Submitted evidence survives a stop even if the remediation is unfinished. To avoid losing a first attempt on a crash, save a pending evidence event immediately; a checkpoint commit applies it exactly once. Before launching a child probe, flush the parent's earlier observations; the final `committing` state adds only unapplied events, learning transitions, and presentation-level progress changes. Resuming retries cannot overwrite a first-response event.

### 4.2 The *Stappenplan* as a fading reasoning workspace

| Step | Early experience | Later experience / evidence |
|---|---|---|
| 1. Maak een tekening van de vraag | Quantities and unknown slots in a bar, number line, groups, or money model. | Optional blank workspace. A structured model can be validated; unrestricted drawing is a scratchpad, not machine-scored proof. |
| 2. Wat moet je uitrekenen? | Equation builder with quantities tied to model parts. | Accept equivalent equations/strategies. Score relationship selection separately from calculation. |
| 3. Wat is je antwoord? | Result and unit fields; keep supplied intermediate facts distinct from child-generated ones. | Unit can be implicit where the UI already fixes it. Do not fail valid `€4,50` because a redundant unit dropdown was untouched. |
| 4. Klopt je antwoord? | Choose and complete an estimate or inverse relation. | Occasional prompted checks or self-initiated verification. No generic “yes” checkbox that falsely claims metacognition. |

Word problems can be narrated using the same wording. Familiar names and culturally neutral, plausible situations reduce irrelevant reading demands. A calculation-only companion probe distinguishes story interpretation from arithmetic when needed.

### 4.3 Visual feedback specifications

Animations begin from the learner's actual mathematical state. They preserve correct work, show **one invariant and one change**, and end in a static inspectable explanation. Prefer 300–700 ms per transition, at most three transitions before asking for action; no confetti covering working areas. Every animation has replay/step controls and a reduced-motion equivalent.

| Visualizer | Mistake visualization | Linked notation / interaction detail |
|---|---|---|
| Clock | Ghost the learner's setting; anchor the reference time; rewind/advance minutes to the comparison point. | Hour angle is `30h + 0.5m`, minute angle `6m` degrees. Coupled hand motion preserves time meaning; snap to five minutes on commit, not misleading static hour positions. Show original and reference labels, not just red/green hands. |
| Number line | Keep start and chosen endpoint; draw intended jump plus a bracket for overshoot/shortfall. | Arc distance and endpoint remain separate labeled objects. Do not visually stretch equal jumps inconsistently; an open non-proportional sketch must be explicitly treated as schematic. |
| DHTE/column grid | Move one higher-place token into ten lower-place tokens; update both source and destination counts together. | A persistent total confirms value conservation. Crossouts remain legible and keyboard-editable. Carry markers are justified quantities, not flashing instructions to “put 1 here.” |
| Ruler | Move origin while retaining a fixed-length bracket and endpoint readings. | Highlight spaces for scale, endpoint subtraction for offset. Screen zoom changes pixels, never the stored mathematical measurement. |
| Beaker/dial scale | Highlight adjacent labeled bounds and subdivide the interval; then connect level/needle to the tick. | Generator supplies a linear calibrated instrument; do not infer volume from the outline of an arbitrary tapered vessel. Needles/fill levels also have equivalent keyboard/text controls without supplying hidden answers. |
| Money tray | Exchange equal-value coins; show total value unchanged and coin count changed. | Exact sum feedback precedes minimum-count feedback. A count-up strip relates price, change, payment. No money is created/disappears during regrouping. |
| Division groups | Attempt to place remaining people/items; show a full container versus unused budget. | Label the quotient's unit and remainder's original unit separately. Ask what is being counted before revealing ceil/floor. |

Suggested feedback pattern:

1. **Notice:** “Je eerste sprong van 200 klopt.”
2. **Localize:** “Bij de sprong van 70 gaan we over 600.”
3. **Invite:** “Hoeveel is het van 547 naar 600?”
4. **Explain after action:** “53 en 17 zijn samen 70; daarom komen we op 617.”
5. **Transfer later:** A fresh endpoint or missing-jump task, without the highlighted bridge.

### 4.4 Dashboard and navigation

Use four mathematical **islands**, one per theme, with expandable constellations of concept clusters. Individual KCs appear on expansion, not as a wall of nearly one hundred labels. Shared foundations form bridges between islands; selecting a bridge explains a relationship in child-friendly language.

- A five-state legend uses icon shape plus text: seed/discover, helping hand, independent spark, flexible star, enduring star. Color is supplementary.
- Show the highest achievement and a separate small freshness ring: “Even opfrissen?” A due skill does not become an empty star.
- A KC card explains a specific capability: “Je leest half-uur-tijden zelf. Nu oefenen we met ‘voor half’.” No unexplained BKT percentages on the child dashboard.
- “Vandaag” offers **something familiar, something growing, and a puzzle**, with a modest item/time estimate. Learners can change theme, choose help, or stop.
- On demand, explain a recommendation: “Dit heb je een tijdje niet gebruikt” or “Dit helpt bij lenen over een nul.” Never show “weak child” rankings or percentiles.
- A parent/teacher-on-this-device view can show evidence counts, assisted versus independent work, delayed checks, and uncertainty. “Nog niet bekeken” is distinct from “heeft hulp nodig.” It is not a diagnostic report.
- Celebrate reasoning: a sensible estimate, a useful model, revising a strategy, and delayed recall. Do not reward speed alone or make hints cost points.
- No public leaderboard, streak loss, failure sound, compulsory timed test, or red cross covering the answer. A child may revisit an easy item for confidence without the engine farming mastery credit from it.

Navigation retains the existing three modes:

1. **Curriculum route:** the four thematic units as a recognizable path; offers a short check to skip known content and relevant detours when needed.
2. **Vrij oefenen:** learner-chosen skill or theme; adaptive support within that choice, with optional review invitations.
3. **Wat kun je nu?:** bounded assessment, untimed by default, followed by an understandable plan.

### 4.5 Assessment is not disguised teaching

- **Placement:** short adaptive isolated probes, no immediate instructional feedback. Uncertainty remains explicit; recommendations may be provisional.
- **Checkpoint:** default twelve core items, three per theme, with at most four additional isolating probes if the learner opts to continue. Rotate KC coverage across checkpoints; twelve items cannot verify the entire DAG.
- Fix the checkpoint coverage blueprint before starting, then select difficulty within it. Saved item seeds and first responses allow review. Report domain observations with sampled KCs and evidence sufficiency, not a false comprehensive mastery percentage.
- Submission is acknowledged neutrally; detailed corrections wait until completion to avoid contaminating related items. Help remains available, but labels that item as supported and excludes it from independent assessment scoring.
- Pausing is allowed and active time excludes the pause. Incomplete/omitted items are unassessed, not zero marks. A timed option is explicitly opt-in and never required for mastery. Before starting other practice on the same profile, finish or abandon the paused assessment; finalize already-submitted observations first, rather than later applying them over newer learning. Placement selection may use a temporary projection of pending observations without publishing mastery changes.
- At completion, commit independent observations with no learning transition, show “al zelf / samen oefenen / nog niet bekeken,” and offer feedback/remediation as separate learning episodes. Do not update the same evidence again when reviewing answers.
- A checkpoint can contribute to Levels 2–3 if its evidence meets all gates, but cannot establish Level 4 without actual spacing.

---

## 5. Client-side data architecture and TypeScript contracts

### 5.1 Persistence and versioning

Use versioned JSON in LocalStorage for a small number of local, pseudonymous profiles. The static curriculum catalog is bundled with the application, not duplicated per learner. Persist data, not validators, SVG DOM, closures, or `Map`/`Date` instances.

#### Resume where you left off

**Progress must persist between visits so learners can continue at the level they left, rather than start again.**

- **Autosave locally:** save committed answers and progress updates as they occur, including per-skill mastery, scaffold settings, review schedules, chosen theme, and unfinished exercise/assessment state. Save meaningful in-progress interactions too; do not rely solely on a browser-close event.
- **Restore before selecting work:** on startup, load and validate the selected learner profile's saved state before running placement or choosing a new problem. Never overwrite existing progress with novice defaults while loading.
- **Offer “Verder waar je was”:** resume an unfinished activity with the same problem, entered answers, and assistance history. If the previous activity was completed, choose the next task from the restored skill levels and support settings. Do not require returning learners to repeat onboarding or placement.
- **Refresh without resetting:** recalculate which reviews are due, but preserve demonstrated levels and achievements. Time away may prompt a refresher; it does not restart the curriculum.
- **Explain the storage boundary:** progress survives reloads and ordinary browser restarts on the same browser profile, device, and site origin. It does not automatically sync between devices, and private browsing or clearing site data may remove it. Offer JSON export/import for backup or transfer, and make save failures visible.

Suggested logical records:

- `rn:catalog-version`: installed graph/generator/rubric versions, not the catalog itself.
- `rn:profile:<id>:head`: active committed snapshot revision/slot.
- `rn:profile:<id>:snapshot:a|b`: alternating complete snapshots with revision and checksum.
- `rn:profile:<id>:journal`: bounded pending/applied evidence events for crash recovery.
- `rn:profile:<id>:backup`: optional last verified export metadata, never a hidden cloud backup.

LocalStorage has no multi-key transactions. Write the next snapshot into the inactive slot, read/validate it, then switch the small head record. On startup validate the head target; otherwise recover the newest complete valid slot and replay unapplied journal events. Checksums detect corruption, not malicious modification. Event IDs, revision checks, and the applied-event set prevent double updates. Compaction only discards journal entries already represented in a verified snapshot.

**Budget:** target at most 2 MiB per profile across both snapshots, journal, and metadata, with an origin-wide limit checked before adding profiles. Browser quotas vary and string storage may cost two bytes per character; measure the serialized storage estimate, not just object counts. Aim for ≤768 KiB per snapshot and ≤128 KiB for the journal. Detailed telemetry has upper bounds of 100 recent items or 30 days, whichever is smaller, **and is pruned earlier to fit the byte budget**. Full scored observations have a global cap of 200 per profile, not 200 per KC. Retain a compact latest-12 qualifying-outcome window per practiced KC, coverage aggregates, and small level/retention proof summaries even when full observations are archived. IDs of archived evidence resolve to a summary marked “detail pruned,” not a fabricated full event. Unfinished sessions and unapplied events are never pruned.

Compaction first removes old action traces and completed-session payloads, then summarizes old observations. Aggregate/window fields carry the policy version that created them; pruning must not change level gates or lose delayed-gap evidence. If essential state still exceeds the budget or writes fail, show a persistent “Voortgang wordt nu niet opgeslagen” message, retain in-memory work, and offer export. Never falsely claim a saved assessment. The implementation must stress-test this budget with mature profiles; browser capacity is not assumed infinite.

Only one tab may write a profile at a time. Use a browser lock where available plus revision checking and cross-tab notification; a secondary tab defaults to read-only/resume guidance. Do not last-write-wins merge two concurrent BKT histories. A future explicit merge must replay deduplicated observations in a declared order.

Exports are explicit JSON downloads, with a warning that they include learning history. Imports validate schema versions, numeric bounds, sizes, IDs, and graph migrations; imported strings are never executed as markup/code. A different catalog version needs an explicit migration map. KC splits do not copy mastery to every new child: preserve legacy history and request fresh discriminating evidence. Unrecognized future versions remain untouched and readable as an export, rather than overwritten.

No network telemetry by default. Store random local profile IDs, optional nicknames, and accessibility preferences; no date of birth, school identity, raw voice, or raw free-form keystroke log. Provide delete-profile and delete-all-data controls. Clearing browser storage loses progress unless the family exported it; communicate that clearly.

### 5.2 Schema conventions

The following are **design-time TypeScript interfaces**, included because the brief requests schemas; they are not implementation files. All types referenced below are declared here. Runtime validation is mandatory later: TypeScript aliases do not enforce probability bounds, valid units, graph acyclicity, or ISO timestamp validity.

- IDs are stable catalog identifiers. `SkillId` must resolve to one of §1.3's nodes at runtime.
- Timestamps are UTC ISO-8601 strings; elapsed active durations are monotonic millisecond measurements accumulated during visible interaction.
- `null` means explicitly absent/not yet known; optional properties represent genuinely optional metadata.
- Exact quantities are reduced rational numbers with positive denominator; currency uses integer cents. `count` units may specify `bussen`, `kinderen`, etc.
- Definitions store validator/generator IDs. The runtime resolves these to functions; no functions go into LocalStorage.

```ts
// ---- Shared vocabulary ----
type SkillId = string;
type ExerciseId = string;
type SessionId = string;
type StepId = string;
type EventId = string;
type ProfileId = string;
type ISODateTime = string;
type Probability = number; // finite, 0..1, validated at runtime

type ThemeId =
  | 'optellen-aftrekken'
  | 'meten'
  | 'vermenigvuldigen-delen'
  | 'tijd-geld';
type MasteryLevel = 0 | 1 | 2 | 3 | 4;
type ScaffoldTier = 'S0-full' | 'S1-partial' | 'S2-faded' | 'S3-transfer';
type Representation =
  | 'manipulative' | 'pictorial' | 'symbolic' | 'story' | 'table-calendar';
type PracticePurpose =
  | 'placement' | 'growth' | 'review' | 'diagnostic' | 'transfer' | 'free';
type Outcome = 'correct' | 'incorrect' | 'unknown' | 'unassessed';
type JsonValue =
  | null | boolean | number | string | JsonValue[]
  | { [key: string]: JsonValue };

interface ExactQuantity {
  numerator: number; // safe integer
  denominator: number; // positive safe integer
  unit: string; // catalog unit ID: mm, g, mL, min, count:bussen, etc.
}

type AnswerValue =
  | { kind: 'integer'; value: number }
  | { kind: 'quantity'; value: ExactQuantity }
  | { kind: 'money'; cents: number }
  | { kind: 'time'; minuteOfDay: number; dayOffset: number | null }
  | { kind: 'date'; year: number; month: number; day: number }
  | { kind: 'quotient-remainder'; quotient: number; remainder: number;
      quotientUnit: string | null; remainderUnit: string | null }
  | { kind: 'choice'; optionId: string }
  | { kind: 'equation'; ast: JsonValue }
  | { kind: 'structured-model'; modelType: string; state: JsonValue };

// ---- Static graph/catalog contracts ----
interface SkillDependency {
  id: string;
  prerequisiteId: SkillId;
  dependentId: SkillId;
  kind: 'required-for-instruction' | 'recommended';
  minimumLevel: MasteryLevel; // default 1 for table edges
  minimumAvailability: Probability; // default .55
  mayProbeToBypass: boolean;
  rationaleNl: string;
}

interface MasteryCriterion {
  level: MasteryLevel;
  rubricId: string; // shared level gate + KC-specific observable check
  minimumProbability: Probability | null;
  minimumIndependentOpportunities: number;
  minimumDistinctItems: number;
  minimumVisits: number;
  minimumVisitSeparationHours: number;
  recentWindowSize: number;
  minimumCorrectInWindow: number;
  requiredVariationTags: string[];
  requiredRepresentations: Representation[];
  minimumTransferSuccesses: number;
  requiresInverseSuccess: boolean;
  fluencyRubricId: string | null;
  retentionPolicyId: string | null;
}

interface KnowledgeGraphNode {
  id: SkillId;
  catalogVersion: string;
  themeIds: ThemeId[]; // multiple themes for shared foundations
  clusterId: string;
  titleNl: string;
  learnerCanNl: string;
  description: string;
  observableCheck: string;
  lessonIds: string[];
  archetypeIds: string[];
  prerequisiteDependencyIds: string[];
  relatedSkillIds: SkillId[]; // not DAG edges
  difficultyDimensionIds: string[];
  criticalVariationTags: string[];
  misconceptionIds: string[];
  cpaBridgeId: string;
  defaultBkt: BktParameters;
  masteryCriteria: MasteryCriterion[]; // exactly one for each level 0..4
  status: 'active' | 'deprecated';
  replacedByIds: SkillId[];
}

interface BktParameters {
  pL0: Probability;
  pT: Probability;
  pG: Probability;
  pS: Probability;
  parameterVersion: string;
}

interface DifficultyProfile {
  band: 'easier' | 'standard' | 'harder';
  logitOffset: number;
  numberRangeMax: number;
  regrouping: 'none' | 'ten' | 'hundred' | 'chain' | 'across-zero';
  representation: Representation;
  languageLoad: 'low' | 'medium' | 'high';
  informationSteps: number;
  strategyChoice: 'specified' | 'compare' | 'choose';
  unitComplexity: 'none' | 'same' | 'convert' | 'interpret';
  variationTags: string[];
}

interface SkillTarget {
  skillId: SkillId;
  role: 'primary' | 'supporting';
  stepIds: StepId[];
  attribution: 'isolated' | 'separate-step' | 'inseparable';
  providedToLearner: boolean; // e.g. subtotal given to isolate interpretation
}

interface ExercisePlan {
  exerciseId: ExerciseId;
  archetypeId: string;
  generatorId: string;
  generatorVersion: string;
  rubricId: string;
  rubricVersion: string;
  seed: string;
  constraints: { [key: string]: JsonValue };
  purpose: PracticePurpose;
  targets: SkillTarget[]; // exactly one primary
  difficulty: DifficultyProfile;
  initialScaffold: ScaffoldTier;
  variationBundleId: string | null;
  variationIndex: number | null;
  fingerprint: string; // canonical recent-pattern exclusion key
  decision: SelectionDecision;
}

interface SelectionDecision {
  policyVersion: string;
  stateRevision: number;
  selectionSeed: string;
  selectedAt: ISODateTime;
  predictedCorrect: Probability;
  predictionConfidence: 'low' | 'medium' | 'high';
  reason: 'learner-choice' | 'zpd-growth' | 'review-due'
    | 'diagnostic-parent' | 'variation-continuation' | 'transfer-gap'
    | 'placement' | 'teach-first';
  explanationNl: string;
  candidateCount: number;
  scoreTerms: { [term: string]: number };
}

// ---- Evidence and per-KC learner state ----
interface EvidenceEligibility {
  independent: boolean;
  firstCommittedResponse: boolean;
  attributable: boolean;
  answerRevealed: boolean;
  countsForReview: boolean;
  countsForTransfer: boolean;
  exclusionReasons: string[]; // empty if fully eligible
  weight: number; // 0..1; rule-derived, not a UI mark
}

interface MisconceptionState {
  misconceptionId: string;
  status: 'suspected' | 'supported' | 'uncertain' | 'resolved';
  supportingEvidenceIds: EventId[];
  counterEvidenceIds: EventId[];
  firstSeenAt: ISODateTime;
  lastSeenAt: ISODateTime;
  lastProbeExerciseId: ExerciseId | null;
  nextProbeArchetypeId: string | null;
}

interface SkillObservation {
  id: EventId;
  skillId: SkillId;
  exerciseId: ExerciseId;
  sessionId: SessionId;
  visitId: string; // time-separated visit; not every page reload
  observedAt: ISODateTime;
  stepIds: StepId[];
  outcome: Outcome;
  eligibility: EvidenceEligibility;
  effectiveScaffold: ScaffoldTier;
  representation: Representation;
  variationTags: string[];
  archetypeId: string;
  factCoverageKey: string | null; // e.g. T7:8
  isInverse: boolean;
  efficientStrategyObserved: boolean;
  activeTimeMs: number;
  effectiveGuess: Probability;
  effectiveSlip: Probability;
  memoryAvailabilityAtObservation: Probability;
  beliefBefore: Probability;
  beliefAfterObservation: Probability;
  modelVersion: string;
  voidedReason: string | null;
}

interface LearningTransitionEvent {
  id: EventId;
  skillId: SkillId;
  exerciseId: ExerciseId;
  sessionId: SessionId;
  occurredAt: ISODateTime;
  activeLearnerActionIds: EventId[];
  effectiveLearnProbability: Probability;
  beliefBefore: Probability;
  beliefAfter: Probability;
  modelVersion: string;
}

type ProgressJournalEvent =
  | { sequence: number; kind: 'observation'; data: SkillObservation }
  | { sequence: number; kind: 'learning-transition'; data: LearningTransitionEvent };

interface GateWindowEntry {
  evidenceId: EventId;
  exerciseId: ExerciseId;
  visitId: string;
  at: ISODateTime;
  correct: boolean;
  transfer: boolean;
  inverse: boolean;
  efficientStrategy: boolean;
  representation: Representation;
  variationTags: string[];
}

interface CoverageCounter {
  key: string; // representation, variation, inverse/fact family, etc.
  opportunities: number;
  independentSuccesses: number;
  lastSuccessAt: ISODateTime | null;
}

interface ReviewRecord {
  exerciseId: ExerciseId;
  evidenceId: EventId;
  dueAt: ISODateTime;
  attemptedAt: ISODateTime;
  actualGapDays: number; // since preceding qualifying independent review
  gapSinceMemoryRefreshDays: number; // used for rung/retention eligibility
  intervalRequiredDays: number;
  wasIndependent: boolean;
  wasDue: boolean;
  outcome: Outcome;
  changedRepresentationOrContext: boolean;
  clockTrust: 'ordinary' | 'suspect' | 'confirmed';
}

interface LevelMilestone {
  at: ISODateTime;
  from: MasteryLevel;
  to: MasteryLevel;
  reason: 'evidence-gates' | 'confirmed-lapse' | 'migration-review';
  evidenceIds: EventId[];
  gatePolicyVersion: string;
}

interface LearnerSkillState {
  skillId: SkillId;
  parameters: BktParameters; // p(L0), p(T), p(G), p(S)
  currentMasteryProbability: Probability; // stored p(Lt), not time-decayed r
  currentVerifiedLevel: MasteryLevel;
  highestDemonstratedLevel: MasteryLevel;
  levelMilestones: LevelMilestone[];
  firstExposedAt: ISODateTime | null;
  lastPracticedAt: ISODateTime | null;
  lastIndependentAttemptAt: ISODateTime | null;
  lastIndependentSuccessAt: ISODateTime | null;
  lastMemoryRefreshAt: ISODateTime | null;
  lastUpdatedAt: ISODateTime;
  exposureCount: number;
  meaningfulOpportunityCount: number;
  independentOpportunityCount: number;
  independentSuccessCount: number;
  scaffoldedSuccessCount: number;
  distinctVisitIds: string[]; // bounded recent gate window
  recentObservationIds: EventId[];
  independentGateWindow: GateWindowEntry[]; // latest 12 qualifying opportunities
  aggregatePolicyVersion: string;
  coverage: CoverageCounter[];
  memory: {
    stabilityHalfLifeDays: number;
    intervalDays: number;
    intervalRung: number; // index in versioned 1,3,7,14,30,60 ladder
    reviewDueAt: ISODateTime | null;
    reviewNotBeforeAt: ISODateTime | null; // early-refresh/help cooldown
    lastQualifyingReviewAt: ISODateTime | null;
    delayedSuccessSeriesStartedAt: ISODateTime | null;
    delayedSuccessSeries: ReviewRecord[];
    freshness: 'new' | 'fresh' | 'due' | 'refresh'; // derived on load
    lapseCount: number;
    policyVersion: string;
  };
  scaffolding: {
    preferredTierByRepresentation: Partial<Record<Representation, ScaffoldTier>>;
    currentTier: ScaffoldTier;
    qualifyingSuccessStreak: number;
    recentComparableFailures: number;
    distinctStreakExerciseIds: ExerciseId[];
    holdDifficultyForItems: number;
    lastChangeAt: ISODateTime | null;
  };
  fluency: {
    comparableFamilyId: string | null;
    activeTimeMedianMs: number | null;
    comparableSampleCount: number;
    efficientStrategySuccesses: number;
    timingExcluded: boolean;
  };
  misconceptions: MisconceptionState[];
  pendingConfirmation: boolean;
  modelVersion: string;
  revision: number;
}

// ---- Interaction and exercise lifecycle ----
type ExercisePhase =
  | 'selecting' | 'presenting' | 'working' | 'submitting' | 'diagnosing'
  | 'feedback' | 'retrying' | 'remediating' | 'reflecting' | 'committing'
  | 'completed' | 'paused' | 'deferred';

type SemanticAction =
  | 'place-value-exchange' | 'place-value-place'
  | 'number-line-jump' | 'clock-set' | 'ruler-move'
  | 'beaker-fill' | 'scale-read' | 'money-add' | 'money-exchange'
  | 'group-items' | 'model-edit' | 'equation-edit'
  | 'hint-open' | 'scratchpad-open' | 'submit' | 'pause' | 'resume';

interface InteractionEvent {
  id: EventId;
  exerciseId: ExerciseId;
  stepId: StepId | null;
  at: ISODateTime;
  activeOffsetMs: number;
  action: SemanticAction;
  modality: 'pointer' | 'touch' | 'keyboard' | 'switch' | 'programmatic';
  payload: { [key: string]: JsonValue }; // bounded, semantic, not raw pointer paths
  source: 'learner' | 'instruction' | 'system';
}

interface HintUse {
  hintId: string;
  stepId: StepId | null;
  openedAt: ISODateTime;
  kind: 'attention-cue' | 'relationship' | 'model' | 'worked-step' | 'solution';
  revealsAnswer: boolean;
  suppliedInformationTags: string[];
  scaffoldAfter: ScaffoldTier;
}

interface ErrorPatternObservation {
  misconceptionId: string;
  stepId: StepId | null;
  observedAt: ISODateTime;
  signatureRuleId: string;
  confidence: 'suspected' | 'supported';
  alternativeExplanationIds: string[];
  evidenceEventIds: EventId[];
}

interface StepTelemetry {
  stepId: StepId;
  activeTimeMs: number;
  inactiveTimeMs: number;
  timeToFirstActionMs: number | null;
  manipulativeInteractionCount: number; // learner semantic actions only
  inputRevisionCount: number; // aggregate; not keystroke contents
  submissionCount: number;
  hintIdsUsed: string[];
  errorPatternIds: string[];
}

interface InteractionTelemetry {
  exerciseId: ExerciseId;
  startedAt: ISODateTime;
  endedAt: ISODateTime | null;
  activeTimeMs: number;
  inactiveTimeMs: number;
  visibilityPauseMs: number;
  manipulativeInteractionCount: number;
  interactionsByAction: Partial<Record<SemanticAction, number>>;
  hintsUsed: HintUse[];
  errorPatterns: ErrorPatternObservation[];
  steps: StepTelemetry[];
  events: InteractionEvent[]; // bounded recent semantic event list
  inputModalities: Array<InteractionEvent['modality']>;
  accessibilityAccommodations: string[];
  timingReliable: boolean;
  timingExclusionReasons: string[];
}

interface StepResponse {
  stepId: StepId;
  firstAnswer: AnswerValue | null;
  firstSubmittedAt: ISODateTime | null;
  currentAnswer: AnswerValue | null;
  outcome: Outcome;
  feedbackShown: boolean;
  suppliedByInstruction: boolean;
}

interface SubmissionSnapshot {
  id: EventId;
  submittedAt: ISODateTime;
  attemptIndex: number;
  answers: Array<{ stepId: StepId; answer: AnswerValue }>;
  outcome: Outcome;
  stepOutcomes: Array<{ stepId: StepId; outcome: Outcome; rubricRuleId: string }>;
  assistanceAtSubmission: HintUse[];
  evidenceIds: EventId[];
  formatValid: boolean;
}

interface DiagnosticBranchState {
  branchId: string;
  originExerciseId: ExerciseId;
  suspectedMisconceptionIds: string[];
  candidateSkillIds: SkillId[];
  probeExerciseIds: ExerciseId[];
  maxProbes: number; // default 2
  status: 'suspected' | 'probing' | 'supported' | 'inconclusive' | 'resolved';
  returnPlan: 'retry-origin' | 'teach-parent' | 'fresh-exit-check' | 'defer';
}

interface ExerciseSessionState {
  id: SessionId;
  profileId: ProfileId;
  visitId: string;
  parentAssessmentId: SessionId | null;
  parentExerciseId: ExerciseId | null; // diagnostic/remediation child item
  plan: ExercisePlan;
  phase: ExercisePhase;
  resumePhase: ExercisePhase | null;
  presentedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  currentStepId: StepId | null;
  currentScaffold: ScaffoldTier;
  highestAssistanceUsed: ScaffoldTier;
  steps: StepResponse[];
  submissions: SubmissionSnapshot[];
  manipulativeState: { [widgetId: string]: JsonValue };
  scratchpadState: JsonValue | null;
  revealedStepIds: StepId[];
  diagnosticBranch: DiagnosticBranchState | null;
  telemetry: InteractionTelemetry;
  pendingObservationIds: EventId[];
  appliedObservationIds: EventId[];
  learningTransitionSkillIds: SkillId[]; // at most once per KC/episode
  completion: 'solved' | 'supported-solved' | 'deferred' | 'in-progress';
  lastSavedAt: ISODateTime | null;
  saveStatus: 'saved' | 'pending' | 'failed';
  revision: number;
}

// ---- Assessment lifecycle ----
interface AssessmentBlueprintSlot {
  id: string;
  theme: ThemeId;
  primarySkillId: SkillId;
  archetypeIds: string[];
  requiredRepresentation: Representation | null;
  isOptionalProbe: boolean;
  selectionReason: string;
}

interface AssessmentItemRecord {
  slotId: string;
  exerciseSessionId: SessionId;
  exerciseId: ExerciseId;
  seed: string;
  status: 'queued' | 'working' | 'submitted' | 'omitted' | 'voided';
  independentEligible: boolean;
  supportUsed: boolean;
  evidenceIds: EventId[];
  submittedAt: ISODateTime | null;
}

interface AssessmentSkillSummary {
  skillId: SkillId;
  independentObserved: number;
  independentCorrect: number;
  supportedObserved: number;
  omitted: number;
  evidenceSufficiency: 'not-sampled' | 'insufficient' | 'provisional' | 'supported';
  evidenceIds: EventId[];
  suggestedNextPurpose: PracticePurpose | null;
  explanationNl: string;
}

interface AssessmentSessionState {
  id: SessionId;
  profileId: ProfileId;
  visitId: string;
  mode: 'placement' | 'checkpoint';
  status: 'planned' | 'in-progress' | 'paused' | 'completed' | 'abandoned';
  blueprintVersion: string;
  policyVersion: string;
  selectionSeed: string;
  catalogVersion: string;
  startedAt: ISODateTime | null;
  endedAt: ISODateTime | null;
  activeTimeMs: number;
  timing: 'untimed' | 'opt-in-timed';
  timeLimitMs: number | null;
  feedbackPolicy: 'deferred';
  maxCoreItems: number;
  maxOptionalProbes: number;
  optionalProbesAccepted: boolean;
  blueprint: AssessmentBlueprintSlot[];
  items: AssessmentItemRecord[];
  currentSlotId: string | null;
  startingSkillRevisions: Record<SkillId, number>;
  pendingObservationIds: EventId[];
  appliedObservationIds: EventId[];
  summary: AssessmentSkillSummary[];
  recommendedSkillIds: SkillId[];
  lastSavedAt: ISODateTime | null;
  saveStatus: 'saved' | 'pending' | 'failed';
  revision: number;
}

// ---- Local snapshot envelope ----
interface LearnerPreferences {
  locale: 'nl-NL';
  nickname: string | null;
  reducedMotion: boolean;
  highContrast: boolean;
  narrationEnabled: boolean;
  timingOptOut: boolean;
  inputMode: 'auto' | 'keyboard' | 'switch';
  chosenTheme: ThemeId | null;
}

interface LearnerSnapshot {
  schemaVersion: number;
  catalogVersion: string;
  modelVersion: string;
  profileId: ProfileId;
  revision: number;
  savedAt: ISODateTime;
  checksum: string; // computed over canonical payload excluding this field
  preferences: LearnerPreferences;
  skills: Record<SkillId, LearnerSkillState>;
  observations: SkillObservation[];
  learningTransitions: LearningTransitionEvent[];
  exerciseSessions: ExerciseSessionState[];
  assessmentSessions: AssessmentSessionState[];
  recentExerciseFingerprints: string[];
  appliedEventIds: EventId[]; // retained through safe journal compaction
  pendingEvents: ProgressJournalEvent[];
  lastAppliedSequence: number;
  deviceClockStatus: 'ordinary' | 'suspect' | 'confirmed';
}
```

### 5.3 Validation and integration rules

1. **Graph validation:** unique IDs; every dependency resolves; no self-edges/cycles; topological sort succeeds; all 0–4 level criteria present; all rubric/generator/misconception references resolve. Recommended edges, if introduced later, must also preserve acyclicity.
2. **Generator validity:** respect numeric bounds; prevent negative subtraction where outside scope; assert q/r invariants; use actual unit ratios; make clock day context explicit; validate real dates; ensure solvable and sufficiently constrained pyramid/magic-square masks. Reject bad items before display.
3. **Answer equivalence:** accept decimal comma and normalized equivalent quantities; `€4,5` means €4,50, not €4,05. Clock-only items without day context accept equivalent morning/evening readings, or ask a 12-hour answer rather than inventing AM/PM. Use structured equation equivalence within a restricted arithmetic grammar; never `eval` learner input.
4. **Evidence integrity:** a first response is immutable; updates are deduplicated by event and KC/item; revealed answers never count as independent; meaningful-learning transitions occur at most once per KC/episode. In an assessment, durable pending observations are not applied until finalization/abandonment, and use `p(T)=0` before feedback.
5. **Derived state:** recalculate freshness/readiness on load using the clock policy. Store p(L), stability, and timestamps, not an endlessly re-decayed belief. Recompute summary counters from retained events plus explicitly versioned aggregates where needed.
6. **Source-spec integration:** existing `ExerciseDefinition` stays a runtime composition boundary. Add the plan/targets/rubric IDs as metadata; replace a single global `score` as the learning signal with attributable step observations. Component props may still use display values, but the domain's monetary source of truth is cents.
7. **Telemetry restraint:** count semantic learner actions, not every pointer movement or frame of animation. Exclude hidden-tab/inactivity periods from fluency; default inactivity threshold is 60 seconds with a continue prompt, adjustable by accessibility settings. Raw time alone never triggers a mathematical diagnosis.
8. **Local-only limitation:** versioning and checksums protect consistency, not assessment security. A technically knowledgeable user can inspect solutions in a client application. Design assessment for learning guidance, not high-stakes certification.

---

## 6. End-to-end examples

### 6.1 Clock knowledge is present; Dutch wording is not yet secure

1. Noor correctly reads a bare 08:20 analog clock in an independent item. `TIME.READ.MinuteFive` and hour progress have prior attributable evidence; the app does not assume Dutch phrasing from this.
2. On an S2 phrasing item, she enters 08:40 for “10 voor half 9.” The engine records a first-attempt failure for the wording KC and suspects `MC.TIME.HalfDirection`; a typo and a wrong half-hour anchor remain alternatives.
3. One fresh probe asks for “half 9.” Noor enters 08:30. The reference-hour skill is evidenced; there is no reason to repeat all clock basics.
4. A paired probe distinguishes five minutes before versus after 08:30. Consistent reversal supports the direction hypothesis. Stop probing after the branch's two-item maximum.
5. At S1, Noor predicts where moving ten minutes backward from 08:30 will land. The clock and line rewind together; the app names the relation after her action.
6. The original corrected answer does not earn independent credit. A fresh later item asks “5 over half 7.” If solved unaided, it contributes new evidence; further independent and variation gates still apply.
7. Tomorrow's review uses “10 voor half 1” in an explicitly daytime context. The dashboard says “Je weet waar half is; we oefenen voor en over,” not “clock level failed.”

### 6.2 Correct division, incorrect interpretation

1. Sam solves `32÷6=5 rest 2` correctly, then answers “5 bussen.” Separate step rubrics identify calculation success and interpretation failure.
2. The engine updates `DIV.REMAINDER.Compute` from its calculation step and `DIV.REMAINDER.CeilContext` from the answer/unit step. It does not lower his multiplication facts or floor-context skill.
3. A model places 30 children into five six-seat buses and leaves two without seats. Sam chooses what must change and adds a sixth bus.
4. The next minimal contrast keeps 32 and 6 but asks how many €6 books €32 can buy. Then an exact-division bus item prevents learning “bus = always add one.”
5. After an unrelated measurement review, a fresh transfer asks for containers in a new plausible setting. His delayed review series begins only with eligible independent retrieval, not completion of the animated packing exercise.

### 6.3 A fluent learner returns after a month

1. Mila previously established Level 3 column addition. Her achievement remains visible, while its review ring is due and predicted availability has fallen.
2. The first daily session offers one gentle independent retrieval among other chosen work, not thirty overdue tasks.
3. If correct, memory is refreshed and the next review interval advances by one rung; the one-month gap counts only as an actual qualifying observation, not thirty daily successes.
4. If incorrect, the engine uses the forgetting-aware likelihood, investigates the observed carry step, and offers a refresh. It does not infer all addition knowledge vanished.
5. Only repeated attributable failures with confirmation change the current verified level. Historical mastery remains visible; a new delayed-success series can re-establish retained status.

---

## 7. Design validation and future implementation acceptance criteria

These are requirements for the later build, not claims that an engine has already been implemented or tested.

### Mathematical and catalog checks

- Every KC in §1.3 is reachable from an in-scope root; graph validation detects an intentionally inserted cycle or missing parent.
- Every existing archetype and theme has a mapped primary/supporting KC strategy; no format is counted as mastery merely because the interface was completed.
- Property checks verify `a+b−b=a`, value-conserving exchanges, `N=qd+r` with `0≤r<d`, exact unit ratios, all 12 five-minute Dutch phrase cases including 12-wrap, real calendar boundaries, and exact cent totals.
- Mask generation proves unique solutions where a unique numeric response is required. Alternative valid methods and equivalent answers are accepted.

### Adaptive/evidence checks

- Repeating one revealed item 100 times cannot establish independent competency or retention.
- A multi-skill wrong final answer with no intermediate evidence does not lower every supporting KC.
- Opening help during transfer prevents unassisted transfer credit but does not delete earlier genuine independent steps.
- A correct q/r plus wrong bus count branches to interpretation, while a wrong table fact branches to the relevant fact/grouping probe.
- When eligible plans exist, simulated growth selections concentrate in the .70–.80 predicted band; fallback plans explicitly say teach-first when none can reach it.
- Review anti-starvation and backlog caps hold; a learner can stop, skip, and resume without a forced failure.
- No Level 4 is possible through same-day repetition or recently refreshed answers counted as spaced recalls. An observable clock anomaly cannot grant retained status automatically; unobservable offline clock tampering remains outside the trust model.
- Time passage updates availability without repeatedly reducing stored p(L); a resumed event cannot double-apply BKT or p(T).
- A single mistake does not erase a level. A confirmed lapse follows the documented reassessment policy and preserves highest achievement.

### UX, accessibility, and persistence checks

- All mathematical actions have keyboard/switch alternatives; reduced motion retains the same explanation and quantities.
- Narration and extra time do not lower mastery credit; revealing mathematical structure does, and the distinction is visible in event provenance.
- A saved paused clock or column-grid exercise resumes with the same seed, first response, and assistance history.
- Refresh/crash between journal write and snapshot commit yields exactly one evidence application.
- Quota failures, disabled storage, corrupt snapshots, schema migrations, and simultaneous tabs have explicit recovery paths, with no silent progress-loss claim.
- Profile export/import preserves achievement evidence; deletion removes all profile records. No raw child interaction data leaves the device by default.

### Classroom validation before tuning thresholds

Start with educator-reviewed worked examples and small observed sessions across Groep 5/6 reading/motor needs. Test whether children can explain an invariant, choose a useful representation, solve a fresh inverse task, and retrieve it after a delay—not just whether they finish more items.

With explicit consent, evaluate de-identified exports for prediction calibration (predicted-success bins versus independent first-attempt outcomes), false misconception diagnoses, excessive support toggling, review burden, transfer success, and delayed retention. Compare help usage and active time across input modes without ranking children. Teacher judgments of reasoning and observed confusion take precedence over optimizing engagement or minimizing hints.

**Open decisions to validate:** KC granularity for mixed-unit transfer and individual multiplication facts; whether default BKT/scaffold likelihoods are calibrated; suitable interval growth for this age/content; child-friendly naming of the five states; and how much structured explanation feels useful rather than repetitive. Keep these versioned policy choices, not hard-coded truths.

### Suggested later delivery order

1. Validate the graph, rubrics, exact arithmetic rules, and evidence reducer contracts using authored examples.
2. Prove one vertical learning loop each for column regrouping, offset measurement, contextual remainders, and Dutch half-hour wording.
3. Add independent/transfer gates, review scheduling, and the child dashboard; simulate evidence and persistence edge cases.
4. Extend coverage across all archetypes, then add checkpoint assessment and local export/import.
5. Pilot with educators/learners before adjusting priors or claiming measured learning benefits.

The intended result is not a longer drill ladder. It is a locally explainable system that continually asks: **What relationship does this learner understand, what evidence supports that judgment, what small experience would help next, and will the understanding still be available later?**
