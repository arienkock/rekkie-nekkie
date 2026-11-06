import { SCHEMA_VERSION, type LearnerSnapshot } from '../domain/types'
import { emptyTime, emptyTotals } from '../analytics/usage'

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function require(condition: unknown): asserts condition {
  if (!condition) throw new Error('Unsupported or incomplete saved profile')
}

function finite(value: unknown): boolean { return typeof value === 'number' && Number.isFinite(value) }

/** Validate the structures runtime code reads before mutating a loaded profile.
 * Unknown additional fields are preserved; unavailable old optional fields are
 * filled by normalization. Invalid/future data must never become fresh progress. */
export function validateSnapshot(value: unknown): asserts value is LearnerSnapshot {
  require(record(value) && value.schemaVersion === SCHEMA_VERSION)
  require(finite(value.revision) && Number(value.revision) >= 0 && record(value.preferences) && record(value.skills))
  for (const key of ['observations', 'learningTransitions', 'recentExerciseFingerprints']) require(Array.isArray(value[key]))
  for (const state of Object.values(value.skills)) {
    require(record(state) && record(state.memory) && record(state.scaffolding) && record(state.bkt))
    for (const key of ['masteryProbability', 'currentVerifiedLevel', 'highestDemonstratedLevel', 'exposureCount']) require(finite(state[key]))
    for (const key of ['independentGateWindow', 'distinctVisitIds', 'coverage']) require(Array.isArray(state[key]))
    require(Array.isArray(state.scaffolding.streakExerciseIds))
    require(state.memory.delayedSuccessGapsDays === undefined || Array.isArray(state.memory.delayedSuccessGapsDays))
  }
  for (const observation of value.observations as unknown[]) require(record(observation))
  if (value.usage !== undefined) {
    const usage = value.usage
    require(record(usage) && usage.version === 1 && record(usage.retention) && record(usage.sessionCounts))
    const groups = ['daily', 'monthly', 'bySkill', 'byFormat'] as const
    for (const key of [...groups, 'sessions', 'exercises']) require(Array.isArray(usage[key]))
    const totals = [usage.lifetime, ...groups.flatMap((key) => (usage[key] as unknown[]).map((b) => {
      require(record(b)); return b.totals
    }))]
    for (const total of totals) {
      require(record(total) && Array.isArray(total.activeTimeBuckets) && total.activeTimeBuckets.length === 6)
      for (const key of Object.keys(emptyTotals())) {
        if (key !== 'timedActiveMs' && key !== 'activeTimeBuckets') require(finite(total[key]))
      }
      require(total.activeTimeBuckets.every(finite))
      for (const [key, count] of Object.entries(total)) {
        if (key === 'skipReasons') require(record(count) && Object.values(count).every(finite))
        else if (key !== 'activeTimeBuckets') require(finite(count) || (key === 'timedActiveMs' && count === null))
      }
    }
    require(usage.currentPractice === null || record(usage.currentPractice))
    require(usage.activeExercise === null || record(usage.activeExercise))
    for (const trace of [...usage.exercises as unknown[], ...(usage.activeExercise ? [usage.activeExercise] : [])]) {
      require(record(trace) && Array.isArray(trace.steps) && Array.isArray(trace.events) && record(trace.actionCounts))
      for (const key of [...Object.keys(emptyTime()), 'hints', 'reloads', 'droppedEvents']) require(finite(trace[key]) && Number(trace[key]) >= 0)
      for (const step of trace.steps) {
        require(record(step) && Array.isArray(step.errorPatterns))
        for (const key of [...Object.keys(emptyTime()), 'editEpisodes', 'submissions', 'invalidSubmissions', 'blankSubmissions', 'repeatedSubmissions']) {
          require(finite(step[key]) && Number(step[key]) >= 0)
        }
      }
    }
  }
  if (value.practice != null) {
    const practice = value.practice
    require(record(practice) && ['curriculum', 'tables', 'lesson', 'proeftoets'].includes(String(practice.mode)))
    for (const key of ['selectedTables', 'proeftoetsResults', 'itemPurposes', 'results', 'recentSkills']) require(Array.isArray(practice[key]))
    require(finite(practice.itemsDone) && Number(practice.itemsDone) >= 0)
    if (practice.exercise != null) {
      const exercise = practice.exercise
      require(record(exercise) && record(exercise.recipe) && record(exercise.session))
      const session = exercise.session
      require(Array.isArray(session.steps) && record(session.work))
      require(Array.isArray(session.work.answers) && Array.isArray(session.work.solved) && finite(session.work.stepIndex))
      for (const step of session.steps) {
        require(record(step) && (step.firstSubmittedAt === undefined || (typeof step.firstSubmittedAt === 'string' && Number.isFinite(Date.parse(step.firstSubmittedAt)))))
      }
    }
  }
}
