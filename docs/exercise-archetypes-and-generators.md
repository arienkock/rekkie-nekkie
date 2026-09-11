# Exercise Archetypes & Generator Specifications

This document catalogs every distinct exercise archetype in the Grade 5/6 curriculum, complete with data structures, generation algorithms, interactive widget requirements, and validation rules.

---

## 1. Number Sense & Place Value Archetypes

### Archetype 1.1: DHTE Place Value Decomposition
- **Concepts**: Thousands (Duizendtallen - D), Hundreds (Honderdtallen - H), Tens (Tientallen - T), Ones (Eenheden - E).
- **Generator Parameters**:
  - `range`: [1000, 9999] or [100, 999]
  - `allowZeroDigits`: boolean (e.g. 5307 has 0 Tientallen)
- **Schema**:
  ```ts
  interface PlaceValueExercise {
    number: number; // e.g. 5307
    d: number; // 5
    h: number; // 3
    t: number; // 0
    e: number; // 7
    expandedForm: string; // "5000 + 300 + 7"
    hasTens: boolean; // false
  }
  ```
- **UI Widget**: Interactive DHTE Grid with digit inputs or base-10 block/counter stamps.

---

### Archetype 1.2: Number Line Interval Placement & Reading
- **Concepts**: Scale calibration, proportional positioning, skip counting by 10, 25, 50, 100, 500, 1000.
- **Generator Parameters**:
  - `start`: e.g. 0, 1000, 2500
  - `end`: e.g. 1000, 2000, 10000
  - `tickStep`: interval between major markings (e.g. 100)
  - `targets`: array of numbers to place or read (e.g. [1250, 1500, 1750])
- **UI Widget**: Open or graduated SVG Number Line with snap/flag placement markers or label input boxes below designated tick arrows.

---

## 2. Addition & Subtraction Archetypes

### Archetype 2.1: Rijgen op de Getallenlijn (Sequential Jumps)
- **Concepts**: Mental addition / subtraction by jumping hundreds, tens, then ones.
- **Generator Rules**:
  - Addition: $a + b$ where $a \in [100, 700]$, $b \in [100, 400]$, with bridging across ten/hundred.
  - Subtraction: $a - b$ where $a \in [300, 999]$, $b \in [100, 400]$, with borrowing across ten/hundred.
- **Steps Scaffolding**:
  - Addition: $a \xrightarrow{+b_h} (a + b_h) \xrightarrow{+b_t} (a + b_h + b_t) \xrightarrow{+b_e} \text{final}$.
  - Subtraction: $a \xrightarrow{-b_h} (a - b_h) \xrightarrow{-b_t} (a - b_h - b_t) \xrightarrow{-b_e} \text{final}$.
- **UI Widget**: Animated step-by-step jump arcs on an open number line with intermediate value inputs.

---

### Archetype 2.2: Cijferen (Columnar Addition & Subtraction)
- **Concepts**: Vertical stacking, place-value alignment, carrying (*onthouden*), borrowing (*lenen*).
- **Scaffolding**:
  - Step 0: Pre-estimation (*Schatten*): Round both terms to nearest 10 or 100 before computing.
  - Step 1: Interactive 3x3 or 4x4 math grid with carry/borrow notation cells above top row.
- **Validation**:
  - Validates carry bits (e.g. 1 above tens column when $7 + 8 = 15$).
  - Validates strike-through borrow changes (e.g. 7 crossed to 6, 5 becomes 15).

---

### Archetype 2.3: Rekenpiramides (Addition Pyramids)
- **Concepts**: Additive relations, inverse subtraction.
- **Topology**: 3-level (6 blocks) or 4-level (10 blocks).
- **Rule**: $B_{i, j} = B_{i+1, j} + B_{i+1, j+1}$.
- **Generator**: Generates base level integers, computes upper levels, masks 40–60% of blocks.

---

### Archetype 2.4: Rekenladders (Countdown Ladders)
- **Concepts**: Sequential multi-step subtraction chain.
- **Topology**: Top value $V_0$, 4–5 steps descending with individual subtrahends $-s_1, -s_2, \dots$.

---

## 3. Measurement & Units Archetypes

### Archetype 3.1: Unit Conversion Matrix
- **Families**:
  - Length: `mm` $\leftrightarrow$ `cm` $\leftrightarrow$ `dm` $\leftrightarrow$ `m` $\leftrightarrow$ `km`
  - Mass: `mg` $\leftrightarrow$ `g` $\leftrightarrow$ `kg`
  - Capacity: `mL` $\leftrightarrow$ `cL` $\leftrightarrow$ `dL` $\leftrightarrow$ `L`
- **Question Varieties**:
  1. Equivalence: $4\text{ m } 25\text{ cm} = \dots\text{ cm}$
  2. Split: $3450\text{ mL} = \dots\text{ L } + \dots\text{ mL}$
  3. Relational multiplier: $1\text{ L} \xrightarrow{\times 10} \dots\text{ dL} \xrightarrow{\times 10} \dots\text{ cL}$
  4. Comparison ($<, >, =$): $1.2\text{ kg } \bigcirc\ 1150\text{ g}$

---

### Archetype 3.2: Instrument Reading
- **Widgets**:
  - **Ruler**: Visual centimeter ruler with millimeter tick lines. Object placed with start/end indicators (tests calculating $\text{end} - \text{start}$).
  - **Measuring Cylinder / Beaker**: Graduated container with colored fluid level and tick marks ($10\text{ mL}, 50\text{ mL}, 100\text{ mL}, 250\text{ mL}$).
  - **Dial Scale**: Circular analog gauge with rotating pointer needle and kg/g markings.

---

## 4. Multiplication & Division Archetypes

### Archetype 4.1: Powers of 10 Patterns (De Nulregel)
- **Pattern Chains**:
  - $4 \times 3 = 12$
  - $4 \times 30 = 120$
  - $4 \times 300 = 1200$
  - $40 \times 30 = 1200$
  - $1200 \div 30 = 40$

---

### Archetype 4.2: Split Multiplication (Splitsend Vermenigvuldigen)
- **Concepts**: $(a \times 10 + b) \times c = (a \times 10 \times c) + (b \times c)$.
- **Example**: $7 \times 47 = (7 \times 40) + (7 \times 7) = 280 + 49 = 329$.
- **UI Widget**: Area model rectangle or tree branches with sub-term entry fields.

---

### Archetype 4.3: Division with Remainder (Delen met Rest)
- **Representation**: $N \div d = q \text{ rest } r$ where $0 \le r < d$ and $N = q \cdot d + r$.
- **Number Line Model**: Backward skip counting from $N$ landing on remainder $r$ at the final hop.

---

### Archetype 4.4: Contextual Remainder Word Problems
- **Ceiling Interpretation**: Items/people packed into containers/buses $\implies \lceil N / d \rceil$.
- **Floor Interpretation**: Budget/material constraints $\implies \lfloor N / d \rfloor$.
- **Leftover Interpretation**: What remains unused $\implies N \bmod d$.

---

## 5. Time & Money Archetypes

### Archetype 5.1: Analog to Digital & Dutch Verbal Clock
- **Time Resolutions**: 5-minute multiples ($:00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55$).
- **Dutch Phrasing Engine**:
  ```ts
  function toDutchVerbalTime(hours: number, minutes: number): string {
    const nextH = (hours % 12) + 1;
    const curH = hours % 12 === 0 ? 12 : hours % 12;
    switch (minutes) {
      case 0:  return `${curH} uur`;
      case 5:  return `5 over ${curH}`;
      case 10: return `10 over ${curH}`;
      case 15: return `kwart over ${curH}`;
      case 20: return `10 voor half ${nextH}`;
      case 25: return `5 voor half ${nextH}`;
      case 30: return `half ${nextH}`;
      case 35: return `5 over half ${nextH}`;
      case 40: return `10 over half ${nextH}`;
      case 45: return `kwart voor ${nextH}`;
      case 50: return `10 voor ${nextH}`;
      case 55: return `5 voor ${nextH}`;
    }
  }
  ```
- **UI Widgets**:
  - Interactive SVG Analog Clock with smooth/snapped draggable hour and minute hands.
  - Digital 7-segment / LED display `HH:MM`.

---

### Archetype 5.2: Elapsed Time & Time Offsets
- **Modes**:
  1. Offset Table: $[t - 10\text{ min}] \leftrightarrow [t] \leftrightarrow [t + 10\text{ min}]$
  2. Duration Interval: Start time + End time $\rightarrow$ Duration in minutes/hours.
  3. Step Sequences: Advance/regress by 15 min (*kwartier*), 30 min (*half uur*), or 45 min (*drie kwartier*).
  4. Schedule / Timetable parsing: Calculating match lengths, interval breaks, travel time across transit stops.

---

### Archetype 5.3: Calendar Date Navigation
- **Calculations**:
  - Current day of week + date $\rightarrow$ Target date day of week (accounting for 28/30/31 days in months).
  - Units equivalence: $1\text{ kwartaal} = 3\text{ maanden}$, $1\text{ jaar} = 52\text{ weken} = 12\text{ maanden}$.

---

### Archetype 5.4: Currency Greedy Breakdown (Betaal Gepast)
- **Denominations**: €500, €200, €100, €50, €20, €10, €5, €2, €1, 50c, 20c, 10c, 5c, 2c, 1c.
- **Rule**: Minimum total items count matching exact total.
- **UI Widget**: Coin & Bill counter grid where user assigns quantities for each currency denomination.

---

### Archetype 5.5: Currency Arithmetic & Change (Wisselgeld)
- **Operations**:
  - Decimal addition/subtraction: €14,50 + €2,70 = €17,20.
  - Change from round payment (€2, €10, €20, €50): Price €1,80 paid with €2,00 $\rightarrow$ €0,20 change (1x 20c).
- **Magic Square Currency**: $3 \times 3$ grid using euro amounts summing to equal totals along all rows, columns, diagonals.

---

## 6. The Standard 4-Step Word Problem Engine (Stappenplan)

For applied context problems, every exercise follows this rigorous 4-step template:

```
+-------------------------------------------------------------------+
| VASTE STAPPENPLAN VOOR REDACTIESOMMEN                             |
+-------------------------------------------------------------------+
| Stap 1: Maak een tekening van de vraag                            |
|         [Interactive sketch pad, bar model, or number line model] |
+-------------------------------------------------------------------+
| Stap 2: Wat moet je uitrekenen?                                   |
|         [Equation builder / input, e.g. "€ 12,50 - € 10,00 = "]   |
+-------------------------------------------------------------------+
| Stap 3: Wat is je antwoord?                                       |
|         [Number input + Unit selector / text, e.g. "5 munten"]    |
+-------------------------------------------------------------------+
| Stap 4: Klopt je antwoord?                                        |
|         [Verification step: check via estimation or inverse sum]  |
+-------------------------------------------------------------------+
```
