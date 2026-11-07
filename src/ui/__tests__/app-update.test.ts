import { describe, expect, it } from 'vitest'
import { RETRY_AFTER_MS, createUpdateChecker, parseVersionFile, updatesEnabled } from '../../app-update'

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

function setup(deployed: string | null | Error, running = 'aaa111') {
  let now = 1_000_000
  const reloads: string[] = []
  const checker = createUpdateChecker({
    running,
    fetchDeployed: async () => { if (deployed instanceof Error) throw deployed; return deployed },
    reload: (v) => reloads.push(v),
    storage: memoryStorage(),
    now: () => now,
  })
  return { checker, reloads, advance: (ms: number) => { now += ms } }
}

describe('self-update', () => {
  it('reads the version file and ignores broken ones', () => {
    expect(parseVersionFile('{"version":"abc123"}')).toBe('abc123')
    expect(parseVersionFile('<html>404</html>')).toBeNull()
    expect(parseVersionFile('{"version":""}')).toBeNull()
    expect(parseVersionFile('{}')).toBeNull()
  })

  it('never updates a local development build', async () => {
    expect(updatesEnabled('development')).toBe(false)
    const { checker, reloads } = setup('bbb222', 'development')
    await checker.check(true)
    expect(reloads).toEqual([])
  })

  it('reloads at rest when a newer version is live', async () => {
    const { checker, reloads } = setup('bbb222')
    await checker.check(true)
    expect(reloads).toEqual(['bbb222'])
  })

  it('does nothing when the live version is the running one, or unknown', async () => {
    for (const deployed of ['aaa111', null, new Error('offline')]) {
      const { checker, reloads } = setup(deployed)
      await checker.check(true)
      expect(reloads).toEqual([])
      expect(checker.pending()).toBeNull()
    }
  })

  it('waits during an exercise and reloads once she is back on Vandaag', async () => {
    const { checker, reloads } = setup('bbb222')
    await checker.check(false)
    expect(reloads).toEqual([])
    expect(checker.pending()).toBe('bbb222')
    checker.becameSafe()
    expect(reloads).toEqual(['bbb222'])
  })

  it('does not reload in a loop when the reload still serves the old copy', async () => {
    const { checker, reloads, advance } = setup('bbb222')
    await checker.check(true)
    await checker.check(true)
    checker.becameSafe()
    expect(reloads).toEqual(['bbb222'])
    advance(RETRY_AFTER_MS + 1)
    await checker.check(true)
    expect(reloads).toEqual(['bbb222', 'bbb222'])
  })
})
