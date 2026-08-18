import type { ReactNode } from 'react'
import { textOn } from '../lib/contrast'

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
      className={`chip shrink-0 whitespace-nowrap active:scale-95 ${active ? 'shadow-sm' : 'bg-cream-deep text-ink ring-1 ring-ink/5'}`}
      style={active ? { backgroundColor: color ?? '#c86a51', color: textOn(color ?? '#c86a51') } : undefined}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}
