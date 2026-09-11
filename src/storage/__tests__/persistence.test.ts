import { describe, expect, it } from 'vitest'
import { MemoryDriver } from '../persistence'
import { ProfileStore, canonicalStringify, checksumOf } from '../persistence'

/** Snapshot payload for tests: T is the *data*, not the slot record. */
interface TestData {
  checksum?: string
  name: string
  level: number
  nested: { a: number }
}

describe('ProfileStore (A/B snapshots, head switch, checksum)', () => {
  it('round-trips a snapshot and validates its checksum', () => {
    const store = new ProfileStore<TestData>('p1', new MemoryDriver())
    store.save(
      { revision: 1, savedAt: 'now', data: { name: 'Noor', level: 2, nested: { a: 42 } } },
      (d) => canonicalStringify(d),
    )
    const loaded = store.load((d) => canonicalStringify(d))
    expect(loaded?.revision).toBe(1)
    expect(loaded?.data.name).toBe('Noor')
  })

  it('alternates slots on save (write → validate → switch head)', () => {
    const driver = new MemoryDriver()
    const store = new ProfileStore<TestData>('p1', driver)
    store.save({ revision: 1, savedAt: 'a', data: { name: 'x', level: 0, nested: { a: 1 } } }, (d) => canonicalStringify(d))
    expect(store.readHead()?.activeSlot).toBe('a')
    store.save({ revision: 2, savedAt: 'b', data: { name: 'x', level: 1, nested: { a: 1 } } }, (d) => canonicalStringify(d))
    expect(store.readHead()?.activeSlot).toBe('b')
    expect(store.readHead()?.revision).toBe(2)
  })

  it('recovers the newest valid snapshot when the head target is corrupt', () => {
    const driver = new MemoryDriver()
    const store = new ProfileStore<TestData>('p1', driver)
    store.save({ revision: 1, savedAt: 'a', data: { name: 'x', level: 0, nested: { a: 1 } } }, (d) => canonicalStringify(d))
    store.save({ revision: 2, savedAt: 'b', data: { name: 'x', level: 5, nested: { a: 1 } } }, (d) => canonicalStringify(d))
    // Corrupt the ACTIVE slot (slot b, revision 2).
    const key = 'rn:profile:p1:snapshot:b'
    driver.set(key, '{corrupted')
    const loaded = store.load((d) => canonicalStringify(d))
    expect(loaded?.revision).toBe(1)
    expect(loaded?.data.level).toBe(0)
  })

  it('detects tampered payload via checksum mismatch', () => {
    const driver = new MemoryDriver()
    const store = new ProfileStore<TestData>('p1', driver)
    store.save({ revision: 1, savedAt: 'a', data: { name: 'x', level: 0, nested: { a: 1 } } }, (d) => canonicalStringify(d))
    // Tamper with the stored snapshot body, keeping the old checksum.
    const key = 'rn:profile:p1:snapshot:a'
    const raw = JSON.parse(driver.get(key)!) as {
      revision: number
      savedAt: string
      data: TestData & { checksum: string }
    }
    raw.data.level = 99
    driver.set(key, JSON.stringify(raw))
    const loaded = store.load((d) => canonicalStringify(d))
    expect(loaded).toBeNull()
  })

  it('journal append/read/clear supports crash recovery', () => {
    const store = new ProfileStore<TestData>('p1', new MemoryDriver())
    store.appendJournal({ kind: 'observation', data: { id: 'obs-1' } })
    store.appendJournal({ kind: 'observation', data: { id: 'obs-2' } })
    expect(store.readJournal().length).toBe(2)
    store.clearJournal()
    expect(store.readJournal().length).toBe(0)
  })

  it('deleteAll removes every profile record', () => {
    const driver = new MemoryDriver()
    const store = new ProfileStore<TestData>('p1', driver)
    store.save({ revision: 1, savedAt: 'a', data: { name: 'x', level: 0, nested: { a: 1 } } }, (d) => canonicalStringify(d))
    store.deleteAll()
    expect(store.load((d) => canonicalStringify(d))).toBeNull()
    expect(store.readJournal()).toEqual([])
  })

  it('canonical serialization ignores the checksum field and sorts keys', () => {
    expect(canonicalStringify({ b: 1, checksum: 'x', a: 2 })).toBe('{"a":2,"b":1}')
    expect(checksumOf('rekkie')).toBe(checksumOf('rekkie'))
    expect(checksumOf('rekkie')).not.toBe(checksumOf('nekkie'))
  })
})
