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
      // A caller-supplied tint gets a label colour picked for contrast; with no tint the chip
      // follows the couple's accent, which only exists as a CSS variable.
      className={`chip shrink-0 whitespace-nowrap active:scale-95 ${
        active ? (color ? 'shadow-sm' : 'bg-coral-deep text-white shadow-sm') : 'bg-cream-deep text-ink ring-1 ring-ink/5'
      }`}
      style={active && color ? { backgroundColor: color, color: textOn(color) } : undefined}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}
