/**
 * React binding for LearnerStore. The store notifies listeners on every
 * meaningful mutation; we force a re-render because the snapshot object is
 * mutated in place (identity does not change).
 */
import { useEffect, useMemo, useReducer } from 'react'
import { LearnerStore } from '../store/learner-store'
import { acquireWriterLease } from '../storage/writer-lease'

const PROFILE_ID = 'default'

export function useLearnerStore(): LearnerStore {
  const store = useMemo(() => {
    const value = new LearnerStore(PROFILE_ID)
    if (typeof window !== 'undefined' && navigator.locks) value.requireWriterLease()
    return value
  }, [])
  const [, force] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const unsubscribe = store.subscribe(force)
    return () => {
      unsubscribe()
    }
  }, [store])

  useEffect(() => {
    if (!navigator.locks || store.storageIssue) return
    let release: (() => void) | undefined
    const acquire = () => {
      store.requireWriterLease()
      release = acquireWriterLease(navigator.locks, store.profileId,
        () => store.grantWriterLease(), () => store.externalProgressChanged())
    }
    const hide = () => {
      store.setVisible(false)
      store.requireWriterLease()
      release?.()
      release = undefined
    }
    const show = () => { if (!release) acquire() }
    acquire()
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => {
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
      store.requireWriterLease()
      release?.()
    }
  }, [store, store.storageIssue])

  // Save during use and at visibility/lifecycle boundaries. Mobile browsers
  // can kill a backgrounded page without ever delivering beforeunload.
  useEffect(() => {
    const visibility = () => store.setVisible(document.visibilityState === 'visible')
    const hide = () => store.setVisible(false)
    const show = () => visibility()
    const activity = (event: Event) => {
      if (event.isTrusted) store.activity()
    }
    const externalSave = (event: StorageEvent) => {
      if (event.key === null || event.key === `rn:profile:${store.profileId}:head`) store.externalProgressChanged()
    }
    visibility()
    const checkpoint = window.setInterval(() => {
      if (store.currentSession && document.visibilityState === 'visible') store.persist()
    }, 10_000)
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('pointerdown', activity, { passive: true })
    document.addEventListener('keydown', activity)
    document.addEventListener('wheel', activity, { passive: true })
    document.addEventListener('touchmove', activity, { passive: true })
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    window.addEventListener('beforeunload', hide)
    window.addEventListener('storage', externalSave)
    return () => {
      window.clearInterval(checkpoint)
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('pointerdown', activity)
      document.removeEventListener('keydown', activity)
      document.removeEventListener('wheel', activity)
      document.removeEventListener('touchmove', activity)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
      window.removeEventListener('beforeunload', hide)
      window.removeEventListener('storage', externalSave)
    }
  }, [store])

  return store
}
