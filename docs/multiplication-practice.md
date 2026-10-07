# Multiplication practice

Multiplication facts are a separate child-selected practice route on Vandaag. The
existing mined curriculum remains the default route and never serves table drills.
Tables 6–9 are selected initially; children can choose any combination of tables
1–10. The choice persists with the profile and is included in exports. Active
sessions keep their original selection when the home picker changes.

## Shared learning loop

The existing MUL.FACT.T1–T10 graph nodes now have a seeded generator. Sessions use
the existing selector, eight-item length, scaffold fading, first-response evidence,
hint ladder, spaced reviews, summary and persistence. Progress has a separate table
section. Readiness continues to refer to the existing array prerequisite; a child
can start these sessions immediately through the selector's teach-first fallback.

S0 offers an array of equal rows. S1 replaces the full array with a strategy
prompt (a five-row split or repeated addition), with the array available through Hint. Arrays over five rows have a visible gap and
second colour after row five, linked to an equation such as 5 × 7 + 3 × 7.
S2 mixes recall with simple equal-groups word problems, without a visible array;
requesting a hint shows the array and reduces evidence weight. Both symbolic and
story representations are available before Level 2, avoiding a progression cycle
where the required second representation would be locked behind that level.
S3 uses word problems and missing-factor questions.
Independent tiers include missing-factor questions, without an array that would
reveal the unknown row count. Completed product questions show the array again to
connect feedback with the representation. There is no countdown.

Coverage records the actual multiplier of each independent success. The variation
gate requires all ten multipliers plus missing-factor evidence, rather than giving
an “all multipliers” tag to a single successful item. Adaptation and review are
currently **per table**, not per individual fact; multiplier selection is seeded
random sampling with the shared recent-fingerprint exclusion. A future fact-level
scheduler could preferentially revisit facts such as 7 × 8 without changing the
practice route or evidence UI. Stars measure the existing accuracy/variation and
retention rules; they should not be described as a direct measure of recall speed.

## Evidence and limits

- [WWC, Assisting Students Struggling with Mathematics (2021), recommendations 3–4](https://ies.ed.gov/ncee/wwc/practiceguide/26)
  rates well-chosen representations and number lines as supported by strong
  evidence in elementary interventions. This supports connecting arrays to the
  multiplication notation; it does not establish that this particular colour,
  five-row split or app is effective. We chose a single representation for a
  coherent first version rather than adding several competing visuals.
- [WWC, Organizing Instruction and Study to Improve Student Learning (2007)](https://ies.ed.gov/ncee/WWC/PracticeGuide/1)
  recommends spacing, combining graphics with words, connecting concrete and
  abstract representations, and repeated retrieval. This motivates support
  fading and reuse of the app's review scheduling.
- [Ophuis-Cox, Catrysse & Camp (2023), Applied Cognitive Psychology](https://doi.org/10.1002/acp.4141)
  compared multiplication retrieval practice with restudy in an elementary school
  setting and found stronger short- and long-term fluency gains with retrieval
  practice. This supports answering from memory after understanding; it does not
  validate our particular scheduler or imply pictures alone improve memorization.

No effectiveness claim is made for this implementation. The next useful validation
is observing whether children connect rows to factors, use the five-row anchor,
and move successfully from supported answers to independent recall across days.


## Navigation

Draft answers, solved steps, current step, feedback and visible hints belong to the
in-memory exercise session, rather than the mounted React view. Visiting Vandaag,
Voortgang or Instellingen and returning resumes the same work. New exercises start
with fresh work state. This does not add restoration of sessions after a page reload.
The paused-session card names its tables; picker changes explicitly apply to a new
session and never alter the current one.
