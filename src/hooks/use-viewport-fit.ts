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

    const isTextField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement

    const reveal = (el: HTMLElement) => {
      // Wait a frame so the inset (and any layout shift) has landed.
      requestAnimationFrame(() => {
        // A field can belong to a larger unit (a test item with its message
        // underneath, marked data-reveal): show all of it when it fits above
        // the keyboard, otherwise at least the field itself.
        const unit = el.closest<HTMLElement>('[data-reveal]')
        const fits = unit !== null && unit.getBoundingClientRect().height <= vv.height * 0.6
        ;(fits ? unit : el).scrollIntoView({ block: 'nearest' })
      })
    }

    let lastInset = -1
    const updateInset = () => {
      const inset = Math.round(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
      document.documentElement.style.setProperty('--keyboard', `${inset}px`)
      // iPadOS slides the keyboard in ~250 ms *after* focus, so the reveal on
      // focus ran against the full-height screen and the field can end up
      // under the keyboard. Reveal it again once the keyboard has landed.
      if (inset !== lastInset && isTextField(document.activeElement)) reveal(document.activeElement)
      lastInset = inset
    }

    const revealFocus = (e: FocusEvent) => {
      if (isTextField(e.target as Element)) reveal(e.target as HTMLElement)
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