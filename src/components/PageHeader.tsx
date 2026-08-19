import { ChevronLeft } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'

/**
 * A screen's title block, plus a compact bar that floats in at the top once the title has scrolled
 * away, so you always know where you are and can go back without scrolling up first.
 *
 * The bar is `fixed` rather than the title block being `sticky`, deliberately. A sticky element
 * still occupies its own box in normal flow, so condensing it to a compact height while stuck drags
 * the page content up under your finger. Fixed is out of flow entirely, so there is no layout shift
 * and the two states can look however they need to. This works because AppShell animates screens
 * with opacity ONLY: a transform there would make it the containing block for anything fixed (the
 * same reason the screens' FABs already rely on that rule).
 *
 * The trigger is an IntersectionObserver on a zero-height sentinel, not a scroll listener, so state
 * changes twice per screen instead of once per scroll event.
 */
export function PageHeader({
  title,
  subtitle,
  back = false,
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: boolean
}) {
  const navigate = useNavigate()
  const t = useT()
  const sentinel = useRef<HTMLDivElement>(null)
  const [floating, setFloating] = useState(false)

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setFloating(!entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <>
      <header className="flex items-start gap-2 pr-28 pt-[calc(0.4rem+env(safe-area-inset-top))]">
        {back && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('Back')}
            className="-ml-1.5 grid h-11 w-11 place-items-center rounded-full bg-paper/80 text-ink shadow-sm ring-1 ring-ink/5 active:scale-95"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="flex-1">
          <h1 className="font-serif text-[1.7rem] font-semibold leading-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
        </div>
      </header>
      {/* crossing this is what swaps the two states; it keeps the old header's bottom margin */}
      <div ref={sentinel} className="mb-5 h-px" aria-hidden />

      {/* the floating bar, a mirror of the bottom nav so the two read as one frame */}
      <div
        aria-hidden={!floating}
        className={`page-topbar fixed inset-x-0 top-0 z-40 border-b border-ink/5 bg-paper/85 backdrop-blur-md ${
          floating ? 'is-floating' : ''
        }`}
      >
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 pb-2.5 pt-[calc(0.5rem+env(safe-area-inset-top))]">
          {back && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={t('Back')}
              tabIndex={floating ? 0 : -1}
              className="-ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink active:scale-95"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <p className="min-w-0 flex-1 truncate font-serif text-lg font-semibold text-ink">{title}</p>
        </div>
      </div>
    </>
  )
}
