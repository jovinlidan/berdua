import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'

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
  return (
    <header className="mb-5 flex items-start gap-2 pr-28 pt-[calc(0.4rem+env(safe-area-inset-top))]">
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
  )
}
