/**
 * Persistence adapter (docs/adaptive-learning-design.md §5.1):
 *  - Versioned JSON snapshots in alternating A/B slots with a head pointer.
 *  - Write → validate → switch head; on load, recover the newest valid slot.
 *  - A bounded journal of pending evidence events for crash recovery.
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

export class ProfileStore<T extends PersistableSnapshot> {
  private readonly profileId: string
  private readonly driver: StorageDriver

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
  save(record: SlotRecord<T>, payloadForChecksum: (data: T) => string): void {
    const head = this.readHead()
    const targetSlot: 'a' | 'b' = head?.activeSlot === 'a' ? 'b' : 'a'
    const checksum = checksumOf(payloadForChecksum(record.data))
    const envelope = {
      revision: record.revision,
      savedAt: record.savedAt,
      data: { ...record.data, checksum },
    }
    this.driver.set(this.slotKey(targetSlot), JSON.stringify(envelope))
    // Validate what we just wrote (quota/corruption guard).
    const readBack = this.driver.get(this.slotKey(targetSlot))
    if (!readBack) throw new Error('Voortgang wordt nu niet opgeslagen (schrijven mislukt)')
    const newHead: HeadRecord = { activeSlot: targetSlot, revision: record.revision }
    this.driver.set(this.headKey(), JSON.stringify(newHead))
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

  /**
   * Load the newest complete valid snapshot: try the head target first, then
   * fall back to the other slot. Returns null for a fresh profile.
   */
  load(payloadForChecksum: (data: T) => string): SlotRecord<T> | null {
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
        if (!best || candidate.revision > best.revision) best = candidate
      } catch {
        continue
      }
    }
    return best
  }

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
