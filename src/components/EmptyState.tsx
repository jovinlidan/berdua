import { motion, useReducedMotion } from 'framer-motion'
import { Plus } from 'lucide-react'

export function EmptyState({
  emoji,
  title,
  subtitle,
  action,
}: {
  emoji: string
  title: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card mt-6 p-8 text-center"
    >
      <motion.p
        animate={reduce ? undefined : { y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
        className="text-5xl"
      >
        {emoji}
      </motion.p>
      <p className="mt-3 font-serif text-lg font-semibold text-ink">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      {action && (
        <button type="button" onClick={action.onClick} className="btn-primary mx-auto mt-5 flex">
          <Plus size={18} /> {action.label}
        </button>
      )}
    </motion.div>
  )
}
