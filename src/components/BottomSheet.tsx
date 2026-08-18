import { X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useOverlay } from '../store/useOverlay'

/**
 * How long the exit animation needs. Kept in sync with `.sheet-panel.is-closing` in index.css.
 * Only used as a backstop, since `animationend` normally does the unmounting.
 */
const EXIT_MS = 260

/**
 * A modal sheet that slides up from the bottom.
 *
 * The slide is a CSS keyframe animation, deliberately NOT a framer-motion spring. A spring is
 * computed in JavaScript and written to `style.transform` once per requestAnimationFrame, which
 * pins it to the main thread and to whatever rate rAF is running at. A transform/opacity keyframe
 * animation runs on the compositor instead, so it keeps its own pace at the display's refresh rate
 * (120Hz where the screen offers it) and does not stutter when the main thread is busy rendering
 * the sheet's own contents.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}) {
  // 'closing' keeps the sheet in the DOM through its exit animation, then it unmounts.
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>(open ? 'open' : 'closed')
  const [wasOpen, setWasOpen] = useState(open)

  // Adjusting state from a prop DURING render (rather than in an effect) so the first painted frame
  // already carries the right animation. An effect would land one frame late and show a flash.
  if (open !== wasOpen) {
    setWasOpen(open)
    setPhase(open ? 'open' : 'closing')
  }

  const mounted = phase !== 'closed'
  const closing = phase === 'closing'

  const pushOverlay = useOverlay((s) => s.push)
  const popOverlay = useOverlay((s) => s.pop)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Let the rest of the app know a modal is up (see useOverlay) while this one is on screen.
  useEffect(() => {
    if (!open) return
    pushOverlay()
    return popOverlay
  }, [open, pushOverlay, popOverlay])

  // Backstop for the unmount. `animationend` is the normal path, but a sheet that covers the whole
  // viewport must never be able to get stuck mounted if that event goes missing.
  useEffect(() => {
    if (phase !== 'closing') return
    const id = window.setTimeout(() => setPhase('closed'), EXIT_MS + 150)
    return () => window.clearTimeout(id)
  }, [phase])

  if (!mounted) return null

  return (
    <>
      <div
        className={`sheet-scrim fixed inset-0 z-50 bg-ink/50 ${closing ? 'is-closing' : ''}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`sheet-panel fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] max-w-md overflow-y-auto rounded-t-[2rem] bg-paper px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl ${
          closing ? 'is-closing' : ''
        }`}
        // guard on the target: the sheet's own contents may have CSS animations of their own
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) setPhase('closed')
        }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-11 w-11 place-items-center rounded-full bg-cream-deep text-ink-soft active:scale-90"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  )
}
