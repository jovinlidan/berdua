// Small presentational pieces + status text shared by the roaming companion and the habitat screen.
import { motion } from 'framer-motion'
import type { useT } from '../lib/i18n'
import { type PetMood, moodOf } from '../lib/pet'
import type { Pet } from '../types'

export function moodBubble(mood: PetMood): string | null {
  switch (mood) {
    case 'sleepy':
      return '💤'
    case 'hungry':
      return '🍖'
    case 'sad':
      return '🥺'
    case 'happy':
      return '💕'
    case 'egg':
      return '✨'
    default:
      return null
  }
}

/** A short, warm one-liner about how a pet is doing right now. */
export function statusText(t: ReturnType<typeof useT>, pet: Pet, now: number): string {
  const name = pet.name
  switch (moodOf(pet, now)) {
    case 'egg':
      return t('{name} is almost here — keep the egg cozy 🥚', { name })
    case 'sleepy':
      return t('{name} is sleepy 💤', { name })
    case 'hungry':
      return t('{name} is hungry 🍖', { name })
    case 'sad':
      return t('{name} misses you 🥺', { name })
    case 'happy':
      return t('{name} is so happy 😊', { name })
    default:
      return t('{name} is doing okay', { name })
  }
}

export function StatBar({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  const color = value < 25 ? '#D87862' : value < 55 ? '#E8B45F' : '#7C8A6F'
  return (
    <div className="flex items-center gap-3">
      <span className="w-6 shrink-0 text-center text-lg">{emoji}</span>
      <div className="flex-1">
        <div className="mb-0.5 flex justify-between text-xs font-bold text-ink-soft">
          <span>{label}</span>
          <span>{value}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-cream-deep">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            animate={{ width: `${value}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          />
        </div>
      </div>
    </div>
  )
}

export function ActionButton({
  emoji,
  label,
  onClick,
  disabled,
}: {
  emoji: string
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="card flex flex-col items-center gap-1 py-3 text-ink transition active:scale-95 disabled:opacity-40"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-sm font-bold">{label}</span>
    </button>
  )
}
