import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { resolveMode } from '../lib/theme'
import { useSession } from '../store/useSession'

/** Glanceable light/dark toggle with an animated sun/moon swap. */
export function ThemeToggle() {
  const t = useT()
  const { themeMode, setThemeMode } = useSession()
  const dark = resolveMode(themeMode) === 'dark'
  return (
    <button
      type="button"
      aria-label={dark ? t('Switch to light theme') : t('Switch to dark theme')}
      onClick={() => {
        setThemeMode(dark ? 'light' : 'dark')
        haptic(6)
      }}
      className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-paper/90 text-ink-soft shadow-[0_6px_20px_-8px_rgba(58,46,43,0.35)] ring-1 ring-ink/5 backdrop-blur active:scale-95"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? 'sun' : 'moon'}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.2 }}
          className="grid place-items-center"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
