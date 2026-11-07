/**
 * Self-update. A tablet can keep the same tab open for days, so a new
 * deploy never reaches the child unless something reloads the page. The
 * build writes `version.json` next to index.html; the app compares it with
 * its own version and reloads itself only on the home screen (Vandaag), when
 * no exercise is on screen. Work is saved first and every session resumes
 * after a reload.
 *
 * Kept free of React and the DOM so it can be tested with fakes.
 */

/** Never try the same new version twice within this time (stale caches). */
export const RETRY_AFTER_MS = 15 * 60_000
/** How often an open, visible page asks whether a new version is live. */
export const CHECK_EVERY_MS = 15 * 60_000
const ATTEMPT_KEY = 'rn:update-attempt'

export interface UpdateDeps {
  /** Version this page is running (the GitHub commit in a deployed build). */
  running: string
  /** The version that is live now, or null when that cannot be read. */
  fetchDeployed: () => Promise<string | null>
  /** Save, then load the new version. */
  reload: (version: string) => void
  /** sessionStorage-like; may be missing or throw. */
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  now: () => number
}

export interface UpdateChecker {
  /** Ask for the live version; reload at once if `safe` (on the home screen). */
  check: (safe: boolean) => Promise<void>
  /** The page is now in a safe place: reload if a new version is waiting. */
  becameSafe: () => void
  /** A newer version was found and is waiting for a safe moment. */
  pending: () => string | null
}

/** Only real deployed builds update themselves, never local development. */
export function updatesEnabled(running: string): boolean {
  return running !== 'development' && running.length > 0
}

export function parseVersionFile(text: string): string | null {
  try {
    const data: unknown = JSON.parse(text)
    if (data && typeof data === 'object' && typeof (data as { version?: unknown }).version === 'string') {
      const version = (data as { version: string }).version.trim()
      return version.length > 0 && version.length <= 100 ? version : null
    }
  } catch { /* A broken or missing file means "no update known". */ }
  return null
}

export function createUpdateChecker(deps: UpdateDeps): UpdateChecker {
  let waiting: string | null = null

  const recentlyTried = (version: string): boolean => {
    try {
      const raw = deps.storage?.getItem(ATTEMPT_KEY)
      if (!raw) return false
      const [tried, at] = raw.split('@')
      return tried === version && deps.now() - Number(at) < RETRY_AFTER_MS
    } catch {
      return false
    }
  }

  const reloadNow = (version: string) => {
    // A reload that still serves the old copy (a cached page) must not
    // reload again and again: try each new version once per quarter hour.
    if (recentlyTried(version)) return
    try { deps.storage?.setItem(ATTEMPT_KEY, `${version}@${deps.now()}`) } catch { /* best effort */ }
    deps.reload(version)
  }

  return {
    async check(safe) {
      if (!updatesEnabled(deps.running)) return
      let deployed: string | null = null
      try { deployed = await deps.fetchDeployed() } catch { deployed = null }
      if (!deployed || deployed === deps.running) return
      waiting = deployed
      if (safe) reloadNow(deployed)
    },
    becameSafe() {
      if (waiting) reloadNow(waiting)
    },
    pending: () => waiting,
  }
}
