import legacyFixture from '../../storage/__tests__/fixtures/legacy-v1.json?raw'
import { describe, expect, it, vi } from 'vitest'
import { LearnerStore } from '../learner-store'
import type { LearnerSnapshot } from '../../domain/types'
import { canonicalStringify, ProfileStore, type StorageDriver } from '../../storage/persistence'
import { newUsage, PROFILE_BUDGET_BYTES, type UsageClock } from '../../analytics/usage'

const fixture = JSON.parse(legacyFixture) as {
  profileId: string; records: Record<string, string>
}
const id = fixture.profileId
const prefix = `rn:profile:${id}:`
const head = JSON.parse(fixture.records[`${prefix}head`]!) as { activeSlot: 'a' | 'b' }
const legacy = JSON.parse(fixture.records[`${prefix}snapshot:${head.activeSlot}`]!).data as LearnerSnapshot & { legacyExtension: unknown }

class InspectDriver implements StorageDriver {
  records: Map<string, string>
  writes = 0
  fail: 'none' | 'quota' | 'read' = 'none'
  constructor(entries: Record<string, string> = fixture.records) { this.records = new Map(Object.entries(entries)) }
  get(key: string) {
    if (this.fail === 'read') throw new Error('Storage access temporarily denied')
    return this.records.get(key) ?? null
  }
  set(key: string, value: string) {
    if (this.fail === 'quota') throw Object.assign(new Error('Storage quota reached'), { name: 'QuotaExceededError' })
    this.writes += 1
    this.records.set(key, value)
  }
  remove(key: string) { this.records.delete(key) }
  bytes() { return [...this.records].reduce((sum, [key, value]) => sum + 2 * (key.length + value.length), 0) }
}

const clock: UsageClock = { now: () => Date.parse(legacy.savedAt) + 3_600_000, monotonic: () => 0 }

function stored(driver: InspectDriver): LearnerSnapshot {
  return new ProfileStore<LearnerSnapshot>(id, driver).load(canonicalStringify)!.data
}

function saveFixture(driver: InspectDriver, data: LearnerSnapshot) {
  new ProfileStore<LearnerSnapshot>(id, driver).save({ revision: data.revision, savedAt: data.savedAt, data }, canonicalStringify)
}

describe('compatibility with snapshots written by the previous implementation', () => {
  it('loads original checksummed A/B data without writing, resetting achievements, or inventing usage history', () => {
    const driver = new InspectDriver()
    const before = Object.fromEntries(driver.records)
    const store = new LearnerStore(id, driver, clock)
    expect(store.storageIssue).toBeNull()
    expect(driver.writes).toBe(0)
    expect(Object.fromEntries(driver.records)).toEqual(before)
    expect(store.snapshot.preferences).toEqual(legacy.preferences)
    expect(store.snapshot.totalExercisesCompleted).toBe(legacy.totalExercisesCompleted)
    expect(store.snapshot.learningTransitions).toEqual(legacy.learningTransitions)
    expect(store.snapshot.focusSkills).toEqual(legacy.focusSkills)
    expect(store.snapshot.recentExerciseFingerprints).toEqual(legacy.recentExerciseFingerprints)
    expect((store.snapshot as typeof legacy).legacyExtension).toEqual(legacy.legacyExtension)
    for (const [skillId, state] of Object.entries(legacy.skills)) {
      expect(store.skillState(skillId)).toEqual({ ...state, memory: { ...state.memory, freshness: store.skillState(skillId).memory.freshness } })
    }
    for (const [i, observation] of legacy.observations.entries()) {
      expect(store.snapshot.observations[i]).toEqual({ ...observation, activeTimeMs: null, timingMeasured: false, legacyActiveTimeMs: observation.activeTimeMs })
    }
    expect(store.usage.lifetime.exercises).toBe(0)
    expect(store.currentSession).toBeNull()
  })

  it('preserves legacy progress and unknown fields through a new save, reload, export and import', () => {
    const driver = new InspectDriver()
    const store = new LearnerStore(id, driver, clock)
    store.persist()
    const reloaded = new LearnerStore(id, driver, clock)
    expect(reloaded.snapshot.totalExercisesCompleted).toBe(4)
    expect(reloaded.skillState('MUL.FACT.T7').highestDemonstratedLevel).toBe(3)
    expect(reloaded.snapshot.observations).toHaveLength(legacy.observations.length)
    expect(reloaded.snapshot.observations[0]!.legacyActiveTimeMs).toBe(60_000)
    const otherDriver = new InspectDriver({})
    const other = new LearnerStore(id, otherDriver, clock)
    expect(other.importJson(reloaded.exportJson())).toBe(true)
    const imported = new LearnerStore(id, otherDriver, clock)
    expect(imported.snapshot.preferences).toEqual(legacy.preferences)
    expect(imported.snapshot.skills).toEqual(reloaded.snapshot.skills)
    expect(imported.snapshot.learningTransitions).toEqual(legacy.learningTransitions)
    expect((imported.snapshot as typeof legacy).legacyExtension).toEqual(legacy.legacyExtension)
    expect(imported.snapshot.observations).toEqual(reloaded.snapshot.observations)
  })

  it('makes an older imported export outrank newer A/B revisions so it survives the next reload', () => {
    const driver = new InspectDriver()
    const store = new LearnerStore(id, driver, clock)
    for (let i = 0; i < 8; i++) store.savePreferences({ nickname: `newer ${i}` })
    const previousRevision = store.snapshot.revision
    expect(store.importJson(JSON.stringify(legacy))).toBe(true)
    expect(store.snapshot.revision).toBeGreaterThan(previousRevision)
    const reloaded = new LearnerStore(id, driver, clock)
    expect(reloaded.snapshot.preferences).toEqual(legacy.preferences)
    expect(reloaded.snapshot.totalExercisesCompleted).toBe(legacy.totalExercisesCompleted)
  })

  it('defers writes until the browser grants a writer lease', () => {
    const driver = new InspectDriver()
    const store = new LearnerStore(id, driver, clock)
    store.requireWriterLease()
    store.savePreferences({ nickname: 'waiting for writer lease' })
    expect(driver.writes).toBe(0)
    store.grantWriterLease()
    expect(store.saveFailed).toBe(false)
    expect(stored(driver).preferences.nickname).toBe('waiting for writer lease')
  })

  it('preserves legacy pending journal bytes before clearing the old journal key', () => {
    const driver = new InspectDriver()
    const journal = JSON.stringify([{ ...legacy.observations[0], id: 'unapplied-legacy-event' }])
    driver.records.set(`${prefix}journal`, journal)
    const store = new LearnerStore(id, driver, clock)
    expect(store.snapshot.recoveredLegacyJournals).toEqual([journal])
    expect(driver.get(`${prefix}journal`)).toBe(journal)
    store.persist()
    expect(driver.get(`${prefix}journal`)).toBeNull()
    expect(stored(driver).recoveredLegacyJournals).toEqual([journal])
    // Preserving an unknown pending event is not inventing a mastery update.
    expect(store.snapshot.totalExercisesCompleted).toBe(legacy.totalExercisesCompleted)
  })

  it('migrates an already oversized legacy profile across two verified saves without a budget deadlock', () => {
    const driver = new InspectDriver({})
    const large = structuredClone(legacy)
    large.learningTransitions = Array.from({ length: 6_000 }, (_, i) => ({
      ...legacy.learningTransitions[0]!, id: `legacy-transition-${i}-${'x'.repeat(40)}`,
    }))
    const persistence = new ProfileStore<LearnerSnapshot>(id, driver)
    persistence.save({ revision: large.revision, savedAt: large.savedAt, data: large }, canonicalStringify)
    persistence.save({ revision: large.revision, savedAt: large.savedAt, data: large }, canonicalStringify)
    expect(driver.bytes()).toBeGreaterThan(PROFILE_BUDGET_BYTES)
    const store = new LearnerStore(id, driver, clock)
    expect(store.snapshot.learningTransitions).toHaveLength(6_000)
    store.persist()
    expect(store.saveFailed).toBe(false)
    store.persist()
    expect(store.saveFailed).toBe(false)
    expect(driver.bytes()).toBeLessThanOrEqual(PROFILE_BUDGET_BYTES)
    expect(stored(driver).totalExercisesCompleted).toBe(legacy.totalExercisesCompleted)
    expect(stored(driver).skills['MUL.FACT.T7']!.highestDemonstratedLevel).toBe(3)
  })
})

describe('non-destructive recovery', () => {
  it('does not prune the live history or its export when quota errors persist', () => {
    const driver = new InspectDriver()
    const store = new LearnerStore(id, driver, clock)
    const session = store.startSession('tables', [7])!
    store.submitStepAnswer(session.exercise.steps[0]!.id, session.exercise.steps[0]!.expected)
    store.completeExercise()
    const observations = structuredClone(store.snapshot.observations)
    const transitions = structuredClone(store.snapshot.learningTransitions)
    const traces = structuredClone(store.usage.exercises)
    const beforeDisk = Object.fromEntries(driver.records)
    driver.fail = 'quota'
    store.persist()
    expect(store.saveFailed).toBe(true)
    expect(store.snapshot.observations).toEqual(observations)
    expect(store.snapshot.learningTransitions).toEqual(transitions)
    expect(store.usage.exercises).toEqual(traces)
    const exported = JSON.parse(store.exportJson()) as LearnerSnapshot
    expect(exported.observations).toEqual(observations)
    expect(exported.learningTransitions).toEqual(transitions)
    expect(exported.usage!.exercises).toEqual(traces)
    expect(Object.fromEntries(driver.records)).toEqual(beforeDisk)
  })

  it.each(['future-profile', 'future-usage', 'malformed-usage'] as const)('protects %s data from automatic replacement and keeps it exportable', (kind) => {
    const driver = new InspectDriver({})
    const data = structuredClone(legacy)
    if (kind === 'future-profile') data.schemaVersion = 999
    else {
      data.usage = newUsage(clock.now())
      if (kind === 'future-usage') (data.usage as { version: number }).version = 999
      else (data.usage as unknown as { exercises: null }).exercises = null
    }
    saveFixture(driver, data)
    const expected = stored(driver)
    const before = Object.fromEntries(driver.records)
    const store = new LearnerStore(id, driver, clock)
    expect(store.storageIssue).not.toBeNull()
    expect(store.saveFailed).toBe(true)
    if (kind !== 'future-profile') expect(store.snapshot.totalExercisesCompleted).toBe(legacy.totalExercisesCompleted)
    store.persist()
    store.savePreferences({ nickname: 'must not overwrite protected data' })
    expect(store.startSession()).toBeNull()
    expect(JSON.parse(store.exportJson())).toEqual(expected)
    expect(Object.fromEntries(driver.records)).toEqual(before)
  })

  it('preserves both raw copies when neither checksum can be recovered', () => {
    const driver = new InspectDriver()
    driver.records.set(`${prefix}snapshot:a`, '{broken-a')
    driver.records.set(`${prefix}snapshot:b`, '{broken-b')
    const before = Object.fromEntries(driver.records)
    const store = new LearnerStore(id, driver, clock)
    store.persist()
    expect(store.storageIssue).not.toBeNull()
    expect(Object.fromEntries(driver.records)).toEqual(before)
    const recovery = JSON.parse(store.exportJson()).recovery
    expect(recovery.a).toBe('{broken-a')
    expect(recovery.b).toBe('{broken-b')
  })

  it('never interprets a temporary read failure as permission to overwrite an existing profile', () => {
    const driver = new InspectDriver()
    const before = Object.fromEntries(driver.records)
    driver.fail = 'read'
    const store = new LearnerStore(id, driver, clock)
    driver.fail = 'none'
    store.persist()
    expect(store.storageIssue).not.toBeNull()
    expect(Object.fromEntries(driver.records)).toEqual(before)
    expect(() => store.exportJson()).toThrow()
  })

  it('does not pretend browser storage is durable in memory when localStorage is blocked', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('Storage access denied') },
      setItem() { throw new Error('Storage access denied') },
    })
    try {
      const store = new LearnerStore('blocked-browser-storage')
      expect(store.storageIssue).not.toBeNull()
      expect(store.saveFailed).toBe(true)
    } finally { vi.unstubAllGlobals() }
  })

  it('retains drafts and feedback in the interrupted trace when generator compatibility fails', () => {
    const driver = new InspectDriver()
    const store = new LearnerStore(id, driver, clock)
    store.startSession('tables', [7])
    store.editAnswer(0, 'unfinished answer')
    const data = JSON.parse(store.exportJson()) as LearnerSnapshot
    data.practice!.exercise!.signature = 'old-generator'
    const other = new LearnerStore('other', new InspectDriver({}), clock)
    expect(other.importJson(JSON.stringify(data))).toBe(true)
    expect(other.usage.exercises.at(-1)!.unrestorablePractice!.exercise!.session.work.answers).toEqual(['unfinished answer'])
    expect(other.snapshot.totalExercisesCompleted).toBe(legacy.totalExercisesCompleted)
  })

  it('prevents a stale tab from overwriting another tab and preserves its own unsaved work for export', () => {
    const driver = new InspectDriver()
    const first = new LearnerStore(id, driver, clock)
    const second = new LearnerStore(id, driver, clock)
    first.savePreferences({ nickname: 'newest progress' })
    const before = Object.fromEntries(driver.records)
    second.startSession('tables', [8])
    expect(second.storageIssue).toContain('ander tabblad')
    expect(second.saveFailed).toBe(true)
    expect(Object.fromEntries(driver.records)).toEqual(before)
    expect(stored(driver).preferences.nickname).toBe('newest progress')
    expect(JSON.parse(second.exportJson()).practice.exercise).not.toBeNull()
  })
})
