import type { ReactNode } from 'react'

export function Chip({
  active = false,
  color,
  onClick,
  children,
}: {
  active?: boolean
  color?: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip shrink-0 whitespace-nowrap active:scale-95 ${active ? 'text-white shadow-sm' : 'bg-cream-deep text-ink ring-1 ring-ink/5'}`}
      style={active ? { backgroundColor: color ?? 'var(--color-coral)' } : undefined}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}
