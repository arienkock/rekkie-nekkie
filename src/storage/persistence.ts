/**
 * Persistence adapter (docs/adaptive-learning-design.md §5.1):
 *  - Versioned JSON snapshots in alternating A/B slots with a head pointer.
 *  - Write → validate → switch head; on load, recover the newest valid slot.
 *  - Legacy journal helpers; the runtime now checkpoints evidence and current
 *    work together in the complete snapshot.
 *  - LocalStorage only; no network telemetry.
 */

export interface StorageDriver {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export class LocalStorageDriver implements StorageDriver {
  get(key: string): string | null {
    return localStorage.getItem(key)
  }
  set(key: string, value: string): void {
    localStorage.setItem(key, value)
  }
  remove(key: string): void {
    localStorage.removeItem(key)
  }
}

/** In-memory driver for tests and SSR fallback. */
export class MemoryDriver implements StorageDriver {
  private map = new Map<string, string>()
  get(key: string): string | null {
    return this.map.get(key) ?? null
  }
  set(key: string, value: string): void {
    this.map.set(key, value)
  }
  remove(key: string): void {
    this.map.delete(key)
  }
}

/** FNV-1a 32-bit checksum over a canonical string. */
export function checksumOf(payload: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Canonical JSON: recursively sorted object keys, stable serialization. */
export function canonicalStringify(value: unknown): string {
  const json = JSON.stringify(sortKeysDeep(value))
  return json
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([k]) => k !== 'checksum')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    const out: Record<string, unknown> = {}
    for (const [k, v] of entries) out[k] = sortKeysDeep(v)
    return out
  }
  return value
}

export interface PersistableSnapshot {
  checksum?: string
}

export interface SlotRecord<T> {
  revision: number
  savedAt: string
  data: T
}

export interface HeadRecord {
  activeSlot: 'a' | 'b'
  revision: number
}

/** A stale tab must not overwrite progress saved by another tab. */
export class StorageConflictError extends Error {}

export class ProfileBudgetError extends Error {}

export class ProfileStore<T extends PersistableSnapshot> {
  private readonly profileId: string
  private readonly driver: StorageDriver
  private protectedSlot: 'a' | 'b' | null = null
  private observedHead: string | null | undefined

  constructor(profileId: string, driver: StorageDriver) {
    this.profileId = profileId
    this.driver = driver
  }

  private headKey(): string {
    return `rn:profile:${this.profileId}:head`
  }
  private slotKey(slot: 'a' | 'b'): string {
    return `rn:profile:${this.profileId}:snapshot:${slot}`
  }
  private journalKey(): string {
    return `rn:profile:${this.profileId}:journal`
  }

  /** Write the snapshot into the INACTIVE slot, validate it, then switch head. */
  save(record: SlotRecord<T>, payloadForChecksum: (data: T) => string, budgetBytes?: number, checkForConflicts = false): void {
    const rawHead = this.driver.get(this.headKey())
    if (checkForConflicts && this.observedHead !== undefined && rawHead !== this.observedHead) {
      throw new StorageConflictError('Progress changed in another tab')
    }
    const head = this.readHead()
    const currentSlot = this.protectedSlot ?? head?.activeSlot
    const targetSlot: 'a' | 'b' = currentSlot === 'a' ? 'b' : 'a'
    const checksum = checksumOf(payloadForChecksum(record.data))
    const envelope = {
      revision: record.revision,
      savedAt: record.savedAt,
      data: { ...record.data, checksum },
    }
    const serialized = JSON.stringify(envelope)
    const estimated = this.estimateEnvelopeBytes(serialized, targetSlot, record.revision)
    if (budgetBytes !== undefined && estimated > budgetBytes) {
      const other = targetSlot === 'a' ? 'b' : 'a'
      const previous = this.driver.get(this.slotKey(targetSlot))
      const protectedCopy = this.driver.get(this.slotKey(other))
      // A legacy profile can already exceed the new budget. Allow a smaller
      // replacement to migrate it over two successful saves, preserving the
      // last valid copy until each new checkpoint has been verified.
      const shrinkingLegacy = protectedCopy && serialized.length < protectedCopy.length
        && (!previous || serialized.length <= previous.length)
      if (!shrinkingLegacy) throw new ProfileBudgetError('Profile budget exceeded')
    }
    this.driver.set(this.slotKey(targetSlot), serialized)
    // Validate what we just wrote (quota/corruption guard).
    const readBack = this.driver.get(this.slotKey(targetSlot))
    if (readBack !== serialized) throw new Error('Voortgang wordt nu niet opgeslagen (schrijven mislukt)')
    this.protectedSlot = targetSlot
    const newHead: HeadRecord = { activeSlot: targetSlot, revision: record.revision }
    this.driver.set(this.headKey(), JSON.stringify(newHead))
    this.observedHead = JSON.stringify(newHead)
  }

  readHead(): HeadRecord | null {
    const raw = this.driver.get(this.headKey())
    if (!raw) return null
    try {
      const h = JSON.parse(raw) as HeadRecord
      if (h.activeSlot !== 'a' && h.activeSlot !== 'b') return null
      if (typeof h.revision !== 'number') return null
      return h
    } catch {
      return null
    }
  }

  /** Conservative UTF-16 estimate of the actual two-slot write, including the
   * head and any existing journal. It is a budget, not a browser quota probe. */
  estimateSaveBytes(record: SlotRecord<T>): number {
    const head = this.readHead()
    const target: 'a' | 'b' = (this.protectedSlot ?? head?.activeSlot) === 'a' ? 'b' : 'a'
    const candidate = JSON.stringify({ ...record, data: { ...record.data, checksum: '00000000' } })
    return this.estimateEnvelopeBytes(candidate, target, record.revision)
  }

  private estimateEnvelopeBytes(candidate: string, target: 'a' | 'b', revision: number): number {
    const other: 'a' | 'b' = target === 'a' ? 'b' : 'a'
    const entries = [
      [this.slotKey(target), candidate],
      [this.slotKey(other), this.driver.get(this.slotKey(other)) ?? ''],
      [this.headKey(), JSON.stringify({ activeSlot: target, revision })],
      [this.journalKey(), this.driver.get(this.journalKey()) ?? ''],
    ]
    return entries.reduce((sum, [key, value]) => sum + (value ? 2 * (key.length + value.length) : 0), 0)
  }

  /**
   * Load the newest complete valid snapshot: try the head target first, then
   * fall back to the other slot. Returns null for a fresh profile.
   */
  load(payloadForChecksum: (data: T) => string): SlotRecord<T> | null {
    this.observedHead = this.driver.get(this.headKey())
    const head = this.readHead()
    const slots: Array<'a' | 'b'> = head ? [head.activeSlot, head.activeSlot === 'a' ? 'b' : 'a'] : ['a', 'b']
    let best: SlotRecord<T> | null = null
    for (const slot of slots) {
      const raw = this.driver.get(this.slotKey(slot))
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as { revision: number; savedAt: string; data: T & { checksum: string } }
        if (typeof parsed.revision !== 'number') continue
        const expected = checksumOf(payloadForChecksum(parsed.data))
        if (parsed.data.checksum !== expected) continue
        const candidate: SlotRecord<T> = { revision: parsed.revision, savedAt: parsed.savedAt, data: parsed.data }
        if (!best || candidate.revision > best.revision) {
          best = candidate
          this.protectedSlot = slot
        }
      } catch {
        continue
      }
    }
    return best
  }

  hasStoredData(): boolean {
    return ['a', 'b'].some((slot) => this.driver.get(this.slotKey(slot as 'a' | 'b')) !== null)
      || this.driver.get(this.headKey()) !== null || this.driver.get(this.journalKey()) !== null
  }

  recoveryJson(): string {
    return JSON.stringify({ profileId: this.profileId, recovery: {
      head: this.driver.get(this.headKey()), a: this.driver.get(this.slotKey('a')),
      b: this.driver.get(this.slotKey('b')), journal: this.readJournalRaw(),
    } }, null, 2)
  }

  readJournalRaw(): string | null { return this.driver.get(this.journalKey()) }

  // ---- Journal (pending evidence events for crash recovery) ----

  appendJournal(entry: unknown): void {
    const raw = this.driver.get(this.journalKey())
    let list: unknown[] = []
    if (raw) {
      try {
        list = JSON.parse(raw) as unknown[]
      } catch {
        list = []
      }
    }
    list.push(entry)
    this.driver.set(this.journalKey(), JSON.stringify(list))
  }

  readJournal(): unknown[] {
    const raw = this.driver.get(this.journalKey())
    if (!raw) return []
    try {
      const list = JSON.parse(raw) as unknown[]
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  }

  clearJournal(): void {
    this.driver.remove(this.journalKey())
  }

  deleteAll(): void {
    this.driver.remove(this.headKey())
    this.driver.remove(this.slotKey('a'))
    this.driver.remove(this.slotKey('b'))
    this.driver.remove(this.journalKey())
  }
}
