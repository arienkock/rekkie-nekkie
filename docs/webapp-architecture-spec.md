# Client-Side Practice Webapp: Architecture & Implementation Spec

## 1. Executive Summary & Goals
The objective is to build a responsive, client-side web application (*"Rekkie Nekkie"*) that teaches the Dutch Grade 5/6 math curriculum (Optellen & Aftrekken, Meten, Vermenigvuldigen & Delen, Tijd & Geld). The app must offer infinite procedurally generated practice, authentic pedagogical scaffolding (e.g. Rijgen vs Cijferen, 4-step word problem stappenplan), rich interactive manipulatives (clocks, number lines, rulers, beakers, currency register), and instant feedback.

---

## 2. Tech Stack & Engineering Principles

### Recommended Stack
- **Framework**: Modern frontend framework (React / Vue / Svelte or Vanilla TypeScript with Vite).
- **Styling**: Tailwind CSS + custom SVG styling for crisp pedagogical manipulatives.
- **State Management**: Lightweight client-side store (Zustand / signals / LocalStorage for progress tracking).
- **Rendering**: Pure SVG for mathematical manipulatives (clocks, number lines, graduated cylinders, rulers, coins/banknotes).
- **Zero Backend Required**: 100% client-side execution, offline-capable (PWA ready), deterministic seedable generators for shareable worksheets or assessments.

---

## 3. Core Domain Data Model

```ts
// Theme & Unit Definition
export type ThemeId = 'optellen-aftrekken' | 'meten' | 'vermenigvuldigen-delen' | 'tijd-geld';
export type LessonStage = 'voorbereiden' | 'oefenen' | 'toepassen' | 'evaluatie';

export interface ExerciseDefinition<TState = unknown, TAnswer = unknown> {
  id: string;
  theme: ThemeId;
  unitId: string; // e.g. "unit-2"
  title: string;
  instruction: string;
  stage: LessonStage;
  archetypeId: string;
  
  // Scaffolding & Didactic mode
  didacticStrategy?: 'rijgen' | 'cijferen' | 'splitsen' | 'schatten' | 'stappenplan';
  
  // Data payload for rendering
  data: TState;
  
  // Validation
  validate: (userSubmission: TAnswer) => ValidationResult;
  solution: TAnswer;
  explanationSteps?: string[];
}

export interface ValidationResult {
  isCorrect: boolean;
  score: number; // 0.0 to 1.0
  feedback?: string;
  stepFeedback?: Record<string, { isCorrect: boolean; message?: string }>;
}
```

---

## 4. Interactive Manipulatives Catalog

### 4.1. `InteractiveClock` (Analog & Digital)
- **Props**:
  - `mode`: `'read' | 'set-hands' | 'step-sequence' | 'duration-diff'`
  - `time`: `{ hours: number; minutes: number }`
  - `interactiveHands`: `'both' | 'minute-only' | 'none'`
  - `snapStep`: `5` (minutes)
  - `showDutchLabel`: boolean (e.g., "10 voor half 9")
  - `showDigitalDisplay`: boolean

### 4.2. `OpenNumberLine` (Getallenlijn)
- **Props**:
  - `range`: `[min, max]`
  - `ticks`: `number[]` or `stepInterval`
  - `jumps`: Array of `{ from: number; to: number; label: string; direction: '+' | '-' }`
  - `interactiveMode`: `'draw-jumps' | 'place-flag' | 'read-tick'`

### 4.3. `ColumnarGrid` (Cijferen / Onder Elkaar)
- **Props**:
  - `operation`: `'+' | '-' | 'x'`
  - `operands`: `number[]`
  - `showCarryCells`: boolean
  - `showBorrowCrossouts`: boolean
  - `showEstimationInput`: boolean

### 4.4. `MeasurementRuler` & `GraduatedBeaker`
- **Ruler**:
  - `lengthCm`: 15 | 30
  - `item`: `{ id: string; name: string; widthMm: number; startMm: number; svgIcon: string }`
  - `draggable`: boolean
- **Beaker / Cylinder**:
  - `capacityMl`: 1000 | 500 | 250 | 100
  - `tickStepMl`: 100 | 50 | 25 | 10
  - `currentLevelMl`: number
  - `targetLevelMl`?: number
  - `interactiveFill`: boolean

### 4.5. `EuroCashRegister` (Munten & Biljetten)
- **Props**:
  - `targetAmount`: number (e.g., 28.75)
  - `mode`: `'pay-greedy' | 'pay-exact' | 'calculate-change' | 'count-total'`
  - `availableDenominations`: `[500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01]`
  - `traySelection`: Record<number, number>

### 4.6. `StappenplanWordProblem`
- **Props**:
  - `story`: string
  - `storyIllustrationUrl`?: string
  - `step1Visual`: `'number-line' | 'bar-model' | 'money-breakdown' | 'custom-sketch'`
  - `step2EquationPrompt`: string
  - `step3Unit`: string (e.g., "euro", "km", "bussen", "minuten")
  - `step4VerificationType`: `'estimate' | 'inverse-operation'`

---

## 5. Generator Architecture

Each archetype has a procedural generator function with strict constraint checking:

```
src/generators/
├── addition-subtraction/
│   ├── dhte-decomposition.gen.ts
│   ├── number-line-jumps.gen.ts
│   ├── columnar-addition.gen.ts
│   ├── columnar-subtraction.gen.ts
│   └── addition-pyramids.gen.ts
├── measurement/
│   ├── unit-conversions.gen.ts
│   ├── ruler-reading.gen.ts
│   ├── beaker-volume.gen.ts
│   └── scale-reading.gen.ts
├── multiplication-division/
│   ├── powers-of-ten.gen.ts
│   ├── split-multiplication.gen.ts
│   ├── division-remainders.gen.ts
│   └── remainder-word-problems.gen.ts
└── time-money/
    ├── clock-reading.gen.ts
    ├── elapsed-time.gen.ts
    ├── timetable-parsing.gen.ts
    ├── calendar-navigation.gen.ts
    ├── greedy-money.gen.ts
    └── change-calculation.gen.ts
```

---

## 6. App Navigation & Practice Modes

1. **Curriculum Mode**:
   - Structured path through the four thematic units.
   - Diagnostic gatekeeping (Voorbereiden $\rightarrow$ Oefenen $\rightarrow$ Toepassen).
2. **Infinite Skill Drill Mode**:
   - Free-practice trainer focused on individual skills (e.g. "Klokkijken tot 5 min", "Splitsend vermenigvuldigen", "Delen met rest", "Meten en eenheden omrekenen").
3. **Assessment Mode ("Wat kun je nu?")**:
   - Timed or untimed comprehensive review test covering all four themes.
   - Generates personalized mastery breakdown and recommends specific follow-up drills.
