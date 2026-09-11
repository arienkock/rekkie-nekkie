/**
 * React binding for LearnerStore. The store notifies listeners on every
 * meaningful mutation; we force a re-render because the snapshot object is
 * mutated in place (identity does not change).
 */
import { useEffect, useMemo, useReducer } from 'react'
import { LearnerStore } from '../store/learner-store'

const PROFILE_ID = 'default'

export function useLearnerStore(): LearnerStore {
  const store = useMemo(() => new LearnerStore(PROFILE_ID), [])
  const [, force] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const unsubscribe = store.subscribe(force)
    return () => {
      unsubscribe()
    }
  }, [store])

  // Persist on unload so nothing is lost if the tab closes mid-session.
  useEffect(() => {
    const handler = () => {
      try {
        if (store.currentSession) store.persist()
      } catch {
        // Saving on unload is best-effort only.
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [store])

  return store
}
