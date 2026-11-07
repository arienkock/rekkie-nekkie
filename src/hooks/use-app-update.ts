/**
 * Keep an open tab on the latest deployed version (see src/app-update.ts).
 * Checks on start, whenever the page comes back into view, and every
 * quarter hour while visible. It reloads only at rest: when the tablet is
 * picked up again on Vandaag or on a finished session's summary, or when she
 * goes back to Vandaag. Never during an exercise, and never from the timer.
 */
import { useEffect, useRef } from 'react'
import { APP_VERSION } from '../analytics/usage'
import { CHECK_EVERY_MS, createUpdateChecker, parseVersionFile, type UpdateChecker } from '../app-update'

function sessionStore(): Storage | null {
  try { return window.sessionStorage } catch { return null }
}

async function fetchDeployed(): Promise<string | null> {
  const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`
  const response = await fetch(url, { cache: 'no-store' })
  return response.ok ? parseVersionFile(await response.text()) : null
}

export function useAppUpdate(
  { atRest, onHome }: { atRest: boolean; onHome: boolean },
  saveFirst: () => void,
): void {
  const atRestRef = useRef(atRest)
  const saveRef = useRef(saveFirst)
  const checkerRef = useRef<UpdateChecker | null>(null)
  useEffect(() => {
    atRestRef.current = atRest
    saveRef.current = saveFirst
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const checker = createUpdateChecker({
      running: APP_VERSION,
      fetchDeployed,
      reload: (version) => {
        saveRef.current()
        // A new address skips any cached copy of the page itself.
        const url = new URL(window.location.href)
        url.searchParams.set('v', version.slice(0, 12))
        window.location.replace(url.toString())
      },
      storage: sessionStore(),
      now: () => Date.now(),
    })
    checkerRef.current = checker
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checker.check(atRestRef.current)
    }
    onVisible()
    const timer = window.setInterval(() => {
      // A timer never reloads under her hands: it only notes the update,
      // which then waits for her return to Vandaag or to the tablet.
      if (document.visibilityState === 'visible') void checker.check(false)
    }, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      checkerRef.current = null
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    if (onHome) checkerRef.current?.becameSafe()
  }, [onHome])
}
