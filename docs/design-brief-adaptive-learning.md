# Design Exercise Brief: Adaptive, Intuition-First Architecture for Rekkie Nekkie

## Context
You are tasked with designing the educational mechanics, adaptive progression engine, and UX architecture for **Rekkie Nekkie** — a client-side web application teaching primary school mathematics (Dutch Grade 5/6, Groep 5/6 standard).

The repository contains a full curriculum breakdown:
- `docs/curriculum-analysis.md`: Detailed thematic breakdown (Optellen/Aftrekken, Meten, Vermenigvuldigen/Delen, Tijd/Geld, plus the 4-step *Stappenplan*).
- `docs/exercise-archetypes-and-generators.md`: All exercise types, mathematical rules, schemas, and Dutch natural time algorithms.
- `docs/webapp-architecture-spec.md`: Component specifications for interactive manipulatives (SVG clocks, number lines, DHTE tables, graduated beakers, rulers, money registers).

---

## The Core Challenge
Traditional digital math apps often fall into the trap of **rote drill execution** (superficial multiple-choice or blind formula repetition) and **rigid linear progression** (forcing kids through fixed levels regardless of prior mastery or specific weaknesses).

Your goal is to design an architecture that:
1. **Builds Deep Mathematical Intuition and Generalised Problem-Solving Capabilities** (moving from concrete manipulatives to visual models to abstract symbolic reasoning using the Concrete-Pictorial-Abstract / CPA framework and Variation Theory).
2. **Dynamically Adapts to the Learner's Real-Time Capability** (tracking fine-grained micro-concepts, adjusting challenge levels, and dynamically modulating scaffolding).
3. **Diagnoses Misconceptions rather than just scoring correctness** (identifying *why* an error occurred and providing targeted didactic interventions).
4. **Maintains Long-Term Retention** through spaced interleaving and mastery decay modeling.

---

## Key Design Requirements & Deliverables

Please produce a comprehensive design document covering the following 5 areas:

### 1. Fine-Grained Concept Knowledge Graph & Mastery Taxonomy
- Define a Directed Acyclic Graph (DAG) of **Micro-Skills / Knowledge Components (KCs)** across all four themes (e.g., `PV.DHTE.Decompose`, `ADD.JUMP.HundredBridge`, `SUB.COLUMN.BorrowCrossout`, `TIME.READ.DutchPhrasingHalfHourOffset`, `DIV.REMAINDER.CeilContext`).
- Map out explicit prerequisite dependencies between nodes.
- Define a 4-tier Mastery Scale for each node:
  - `Level 0: Unexposed / Novice`
  - `Level 1: Scaffolded Understanding` (needs visual manipulatives/hints)
  - `Level 2: Independent Competency` (unscaffolded procedural accuracy)
  - `Level 3: Mastered & Fluent` (speed, resilience to variation, inverse problem solving)
  - `Level 4: Retained` (verified over spaced time intervals).

### 2. Adaptive Engine & Dynamic Scaffolding Fading Algorithm
- **Proficiency Estimation Model**: Specify a lightweight, 100% client-side adaptive engine (e.g., Bayesian Knowledge Tracing (BKT), Elo-based skill rating, or Glicko-2) that runs entirely in TypeScript/LocalStorage.
- **Dynamic Problem Selector**: Specify how the next question is chosen based on:
  - Zone of Proximal Development (ZPD) targeting (~70–80% success probability).
  - Spaced repetition & review queue (interleaving previously mastered skills to prevent decay).
  - Diagnostic branch triggers (when a learner fails a prerequisite sub-skill).
- **Scaffolding Fading Engine**: Detail how scaffolding is dynamically provided and removed across 4 tiers:
  - *Full Scaffolding*: Direct manipulative manipulation (e.g., dragging hands on an analog clock with snap guides, interactive jump arcs on a number line).
  - *Partial Scaffolding*: Sub-step entry (e.g., fill in intermediate jumps $347 \rightarrow 547 \rightarrow 617 \rightarrow 625$).
  - *Faded Scaffolding*: Symbolic equation with visual manipulative available as an on-demand expandable scratchpad.
  - *Challenge / Transfer*: Word problem or inverted problem with no visual aids.

### 3. Didactic Framework: Intuition Building & Variation Theory
- **CPA (Concrete $\rightarrow$ Pictorial $\rightarrow$ Abstract) Bridges**: Explain how visual models connect directly to abstract notation for each theme (e.g., how number line jumps visually justify columnar carrying/borrowing).
- **Variation Theory Sequences (Minimal Difference Tasks)**: Design task sequences that isolate single mathematical dimensions to build intuition (e.g., $4 \times 3 = 12 \rightarrow 4 \times 30 = 120 \rightarrow 40 \times 30 = 1200$; or comparing remainder interpretation between taxi passenger packing vs. budget allocation).
- **Common Misconceptions Library & Targeted Interventions**: Catalog at least 8 specific Grade 5/6 misconceptions (e.g., Dutch clock *"10 voor half 9"* confused with 08:40 vs 08:20; subtracting smaller digit from larger in columnar subtraction regardless of position; forgetting remainder units; ruler measurement starting from $1\text{ cm}$ instead of $0\text{ cm}$) and specify the automated remedial visual feedback for each.

### 4. Interactive UX, Didactic Loops & Feedback Architecture
- **The Core Learning Loop**: Step-by-step state machine for:
  - Problem presentation $\rightarrow$ Scratchpad / manipulative interaction $\rightarrow$ Answer submission $\rightarrow$ Intelligent error breakdown $\rightarrow$ Retry / remediation $\rightarrow$ Mastery update.
- **Visual Feedback & "Why It Works" Explanations**: Visual animation specs for showing mistakes (e.g., visual clock hand rewind, number line overshoot correction, coin tray regrouping animation).
- **Learner Dashboard & Progress Visualization**:
  - Concept Tree / Skill Radar map showing the learner their personal mathematical "constellation" or "island map".
  - Transparent progress tracking (clear mastery progress without anxiety-inducing failure states).

### 5. Client-Side Data Architecture & TypeScript Schemas
- Define full TypeScript interfaces for:
  - `KnowledgeGraphNode` and `SkillDependency`.
  - `LearnerSkillState` (BKT parameters: $p(L_0)$, $p(T)$, $p(G)$, $p(S)$, current mastery probability $p(L_t)$, last practiced timestamp, stability/interval).
  - `ExerciseSessionState` and `AssessmentSessionState`.
  - `InteractionTelemetry` (time spent on step, manipulative interactions count, hints used, error patterns).
