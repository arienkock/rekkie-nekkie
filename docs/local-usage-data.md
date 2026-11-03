# Local usage data and JSON exports

Use **Instellingen → Exporteren (bestand)** to download the existing
`rekkie-nekkie-voortgang.json`. It includes learning progress, recent exercise
details, usage summaries, and the current unfinished activity. There is no parent
dashboard, analytics SDK, account, or telemetry upload. Share the downloaded file
with an analysis session when desired. The Settings text describes its contents.

The profile schema remains version 1 so old exports still import. The optional
`usage` section has its own `version: 1`; `collectedSince` identifies when real
tracking began. Existing progress is preserved. Historical observation durations
were placeholders: they are retained as `legacyActiveTimeMs`, with
`activeTimeMs: null` and `timingMeasured: false`. Do not use those old placeholder
minutes in timing totals. Existing preferences, achievements, learning counters,
review state, evidence windows and unknown extension fields are preserved.
`usageDefinitions` in the export explains the units, histogram bins, overlapping
summaries and interpretation limits even when the repository is not available.

## What to analyze

| Question | Export fields |
| --- | --- |
| Where does she hesitate or get stuck? | Exercise and step timing, `firstActionMs`, `firstSubmitMs`, edit episodes, submissions, last outcome, stop/skip position |
| Does help get her moving again? | Hint/reveal events and levels; per-step `hintRequests`, `hintLevelAtSuccess`, `succeededAfterHint`; `siblingOf` links a revealed problem to its fresh “Nu jij” follow-up |
| Is the interface causing trouble? | Blank, invalid-format and unchanged-answer submissions; step selection/focus and app-screen events |
| Is selection suitable? | Skill, archetype, difficulty, scaffold, representation, purpose, selection reason, mode, lesson/test, session position, seed/fingerprint, catalog/model/app version |
| What happens after mistakes or interruptions? | First versus last outcomes and submitted answers; `correctedAfterError`; hidden/visible/restored events; finished, skipped, stopped, replaced and interrupted outcomes |

`usage.activeExercise` is unfinished; `usage.exercises` contains finalized
exercises. One exercise can have several learning observations, so **use usage
records for time and exercise totals**, rather than summing skill observations.
A test-format block is one exercise with per-line `steps`. Its pass/fail uses the
existing 80% rule; the individual line outcomes remain available in the usage
record. `practiceId` links exercises to a practice session; `position` is one-based.
`usage.currentPractice` describes running/paused practice and `usage.sessions`
describes finalized sessions, including their targets and completed/skipped counts.
Finishing an eight-item session can include skips; inspect both counts.

`firstAttemptCorrect` is the learning loop's first-response aggregate, not the
last corrected response. It is null for unassessed, skipped or stopped exercises.
The first parseable committed response remains the learning evidence even after
correction. In each usage step, `firstAnswer` is the first **submitted** value,
including blank/invalid input, whereas `firstOutcome` is the first **committed
math** outcome. A blocked block-check records interface events, but does not
commit any step's math outcome until the whole page can be checked. Error-pattern
IDs are validator suggestions, not diagnoses.

`succeededAfterHint` means the step had a hint request followed by a correct
submission before the answer was revealed. It does not establish that the hint
caused success. Corrections after a reveal can be distinguished using `revealed`
and `hintLevelAtSuccess`.

Only submitted answer values enter the action timeline, limited to 160 characters
per string and 16 fields per structured answer; truncation is labelled. Raw
keystrokes and pointer paths are not recorded. Consecutive edits within 1.5 seconds
on the same field are one edit episode. Submitting or requesting help ends that
episode. Focus events also include programmatic movement between test fields;
they are field transitions, not a count of deliberate clicks.

## Timing and interruptions

All durations and event offsets are milliseconds. Live durations use a monotonic
clock, with these mutually exclusive categories:

- `activeMs`: the exercise screen is visible and input occurred within 60 seconds.
  Opening/returning to an exercise also starts that allowance. This is an estimate
  of interaction time, not proof of attention.
- `idleMs`: the exercise is visible but no input occurred within 60 seconds. The
  child could still be thinking or working on paper; this does not lower mastery.
- `hiddenMs`: the browser reported the page hidden. This does not identify another
  site/app or explain why she left.
- `otherScreenMs`: the page is visible but an app screen such as Settings or the
  learning path is open.
- `unobservedMs`: time between the last saved checkpoint and restoring the page.
  It is never guessed to be active or hidden time. Restored traces have
  `timingReliable: false` and are excluded from the active-time histogram.

Exercise `firstActionMs`/`firstSubmitMs` are active-time offsets since presentation;
the equivalent step fields use active time accumulated on that step. A step's
time follows the active field/step; it cannot establish which question she was
reading on a page of several questions. Event `offsetMs` includes all time
categories, so gaps and returns can be placed on a single timeline. Calendar
timestamps are UTC. Dates in summaries are UTC too.

Work autosaves after edits (within 500 ms), after submissions/help/navigation,
every ten seconds while the page is visible, and at page-hiding boundaries.
Reload restores the generator recipe, answers, first attempts, help and feedback.
Validators are regenerated from bundled code and checked against an exercise
signature; executable functions are never imported from JSON. If an update makes
the original exercise impossible to regenerate, its usage record is marked
interrupted, its draft/feedback is kept in `unrestorablePractice` on that trace,
and no negative learning evidence is created. Time after the last
checkpoint can remain unobserved if the process is killed.
Learning observations retain the original first committed response date (the
earliest primary-step response for an aggregate). Completing yesterday's saved
answer today does not count as a fresh delayed retrieval.

## Roll-ups and retention

Finalizing an exercise updates `lifetime`, daily, monthly, skill and exercise-format
summaries in the same snapshot as learning progress. Reloading, exporting, pruning
and retrying a save never aggregate that exercise again. These are overlapping
views of the same data: **do not add them together**. The current unfinished
exercise has not contributed to these totals yet.

- Detailed exercises: latest 100, at most 30 days old.
- Events: at most 60 per exercise, preserving the first 10 and most recent events.
  `droppedEvents` records omissions; action counters are still exact.
- Finalized session summaries: latest 100, at most 30 days old.
- Daily totals: up to 90 UTC dates. Monthly totals: up to 24 calendar months.
- Lifetime counters and bounded per-skill/per-format summaries survive detail
  pruning. `byFormat` groups archetype + scaffold + mode (at most 200 groups);
  `bySkill` retains at most 150 groups; retention counters flag removed groups.
  `sessionCounts` tracks finished/stopped/
  replaced/interrupted practice sessions; paused tests are still current sessions.
- Counts include denominators (`assessed`, `stepsSubmitted`, `timingSamples`).
  `activeTimeBuckets` has six bins: ≤15s, ≤30s, ≤1m, ≤2m, ≤5m, and >5m. Only completed
  traces with reliable timing contribute; reloads are excluded. Their mean is
  `timedActiveMs / timingSamples`; `activeMs` includes every finalized trace.
  A null `timedActiveMs` means an imported older export lacks that sum.
  Keep sums/counts or these buckets when comparing periods; do not average daily averages.

The conservative target is 768 KiB per snapshot and 2 MiB for both alternating
snapshots, the head and journal. Estimates count two bytes per UTF-16 code unit,
including keys/envelopes; actual browser quota accounting can differ. Older
learning observations and model-transition detail are capped at 200 each.

Byte pressure can prune recent details sooner: remove action timelines, then old
exercise/session detail, older daily totals, and optional format/skill/period
summaries before learning-history detail. Retention counters report removed details. Skill state,
gate windows, current work, the current trace, and lifetime totals are preserved.
Quota errors trigger a smaller-history retry. If essential state still cannot be
saved, the existing save-failure banner remains visible and manual export still
includes the in-memory progress. No telemetry is sent anywhere to work around a
storage limit. A failed save does not prune the in-memory history or manual export.
Oversized legacy profiles can temporarily exceed the new budget while two verified
checkpoints replace their old copies with smaller retained snapshots.

Loading never writes a fresh profile over unreadable or unsupported data. It
pauses saving and keeps the original data exportable for recovery. Legacy journal
bytes are copied into `recoveredLegacyJournals` before the old journal key is
cleared; unknown pending events are not silently turned into mastery updates.
An explicit import gets a revision newer than both saved slots so importing an
older backup cannot revert on the next reload.

Browsers with Web Locks allow one writer per profile; another app tab pauses
practice/saving and offers export or reload guidance. A head check and cross-tab
notifications also reject stale writes. Browsers without Web Locks use those
fallback checks; avoid simultaneous same-profile practice in those browsers.

App version is the GitHub commit SHA in deployed builds and `development` locally.
No behavioral data is used to change the learning model; the existing answer/help
rules continue to control learning evidence.
