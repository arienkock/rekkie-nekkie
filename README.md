## 🚀 Deployment (GitHub Pages)

The rendered static site is published automatically on every push to `master` by
[`.github/workflows/pages.yml`](.github/workflows/pages.yml): it runs `npm ci` → tests
→ `npm run build`, uploads `dist/` as a Pages artifact, and deploys it with the
official GitHub Pages actions.

- **Live URL**: <https://arienkock.github.io/rekkie-nekkie/>
- **One-time setup** (if the first deploy fails): repo *Settings → Pages* → set
  *Build source* to **GitHub Actions**. Normally the first workflow run enables
  this automatically.
- `vite.config.ts` sets `base: '/rekkie-nekkie/'` so built asset URLs match the
  GitHub Pages subpath — keep this in sync with the repo name.

---

# Rekkie Nekkie - Dutch Primary School Math Webapp

Rekkie Nekkie is an interactive, client-side math learning and practice application for the Dutch Grade 5/6 mathematics curriculum (groep 5/6).

---

## 📚 Curriculum Documentation & Analysis

The full curriculum for the four thematic units has been analyzed and cataloged:

1. **[Curriculum Analysis](docs/curriculum-analysis.md)**:
   - Full pedagogical breakdown of the four themes:
     - **Optellen en aftrekken** (Addition & Subtraction, DHTE place value to 10,000, Number line *rijgen*, Columnar *cijferen*).
     - **Meten** (Length mm/cm/dm/m, Mass mg/g/kg, Capacity mL/cL/dL/L, Ruler/Scale/Beaker reading).
     - **Vermenigvuldigen en delen** (Powers of 10, Split multiplication, Columnar multiplication, Division with remainders & context floor/ceil).
     - **Tijd en geld** (Analog/digital clocks to 5-minute Dutch natural phrasing, Elapsed time, Schedules, Calendar, Euro banknotes/coins, Greedy change).
   - Complete unit progression mapping table.

2. **[Exercise Archetypes & Generator Specifications](docs/exercise-archetypes-and-generators.md)**:
   - Detailed technical specifications for every exercise format.
   - Algorithmic parameters, data schemas, validation rules, and scaffolding mechanics.
   - Word problem 4-step protocol (*Vaste Stappenplan*).

3. **[Webapp Architecture Specification](docs/webapp-architecture-spec.md)**:
   - System design for the interactive client-side practice webapp.
   - Visual manipulative component catalog (SVG Analog/Digital Clock, Open Number Line with jump arcs, DHTE Grid, Columnar Cijferen working grid, Graduated Beakers, Rulers, Euro Cash Register).
   - Generator architecture and practice modes (*Curriculum Progression*, *Infinite Skill Drill*, *Wat kun je nu? Mastery Assessment*).
