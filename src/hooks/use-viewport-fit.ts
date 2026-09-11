/**
 * useViewportFit: keeps the app usable while an on-screen keyboard is open.
 *
 * Two keyboard behaviors exist on tablets:
 * - Android/Chrome with `interactive-widget=resizes-content` resizes the
 *   layout viewport, so `100dvh` already shrinks the app. Nothing to do here
 *   (the computed inset is ~0).
 * - iPadOS Safari overlays the keyboard: the layout viewport keeps its size
 *   while the *visual* viewport shrinks. We measure the difference via the
 *   VisualViewport API and expose it as `--keyboard` so `#root`'s padding
 *   reserves exactly the covered height (see index.css).
 *
 * Also keeps the focused input within the visible region by scrolling it
 * into view inside `main` (the app's only bounded scroll container).
 */
import { useEffect } from 'react'

export function useViewportFit() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--keyboard', `${Math.round(inset)}px`)
    }

    const revealFocus = (e: FocusEvent) => {
      const el = e.target
      if (!(el instanceof HTMLElement)) return
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        // Wait a frame so the inset (and any layout shift) has landed.
        requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest' }))
      }
    }

    updateInset()
    vv.addEventListener('resize', updateInset)
    vv.addEventListener('scroll', updateInset)
    document.addEventListener('focusin', revealFocus)

    return () => {
      vv.removeEventListener('resize', updateInset)
      vv.removeEventListener('scroll', updateInset)
      document.removeEventListener('focusin', revealFocus)
      document.documentElement.style.removeProperty('--keyboard')
    }
  }, [])
}