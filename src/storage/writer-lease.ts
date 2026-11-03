/** Hold one browser writer for a profile. Deferred acquisition allows React's
 * StrictMode setup/cleanup/setup cycle to cancel the first request safely. */
export function acquireWriterLease(
  locks: Pick<LockManager, 'request'>,
  profileId: string,
  acquired: () => void,
  unavailable: () => void,
): () => void {
  let disposed = false
  let release: (() => void) | undefined
  queueMicrotask(() => {
    if (disposed) return
    void locks.request(`rn:profile:${profileId}:writer`, { ifAvailable: true }, async (lock) => {
      if (disposed) return
      if (!lock) { unavailable(); return }
      // Establish the release function before a callback can cause cleanup.
      const held = new Promise<void>((resolve) => { release = resolve })
      acquired()
      await held
    }).catch(() => { if (!disposed) unavailable() })
  })
  return () => { disposed = true; release?.() }
}
