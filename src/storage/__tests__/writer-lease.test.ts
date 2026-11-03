import { describe, expect, it, vi } from 'vitest'
import { acquireWriterLease } from '../writer-lease'

function manager() {
  let held = false
  const request = vi.fn(async (name: string, _options: LockOptions, callback: LockGrantedCallback<unknown>) => {
    if (held) { await callback(null); return }
    held = true
    try { await callback({ name, mode: 'exclusive' } as Lock) }
    finally { held = false }
  })
  return { request } as unknown as Pick<LockManager, 'request'>
}

describe('browser profile writer lease', () => {
  it('allows one writer and reports a second tab as unavailable', async () => {
    const locks = manager()
    const first = vi.fn()
    const blocked = vi.fn()
    const releaseFirst = acquireWriterLease(locks, 'profile', first, vi.fn())
    await Promise.resolve()
    const releaseSecond = acquireWriterLease(locks, 'profile', vi.fn(), blocked)
    await Promise.resolve()
    expect(first).toHaveBeenCalledOnce()
    expect(blocked).toHaveBeenCalledOnce()
    releaseFirst()
    releaseSecond()
    await Promise.resolve()
  })

  it('cancels StrictMode setup/cleanup before attempting to acquire the discarded lease', async () => {
    const locks = manager()
    const discarded = vi.fn()
    const cancel = acquireWriterLease(locks, 'profile', discarded, vi.fn())
    cancel()
    const acquired = vi.fn()
    const blocked = vi.fn()
    const release = acquireWriterLease(locks, 'profile', acquired, blocked)
    await Promise.resolve()
    expect(discarded).not.toHaveBeenCalled()
    expect(acquired).toHaveBeenCalledOnce()
    expect(blocked).not.toHaveBeenCalled()
    release()
    await Promise.resolve()
  })

  it('releases a held lease so a later document can become the writer', async () => {
    const locks = manager()
    const release = acquireWriterLease(locks, 'profile', vi.fn(), vi.fn())
    await Promise.resolve()
    release()
    await Promise.resolve()
    const next = vi.fn()
    const releaseNext = acquireWriterLease(locks, 'profile', next, vi.fn())
    await Promise.resolve()
    expect(next).toHaveBeenCalledOnce()
    releaseNext()
    await Promise.resolve()
  })
})
