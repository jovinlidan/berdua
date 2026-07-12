import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Copy } from 'lucide-react'
import { useCouple } from '../db/hooks'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { useSession } from '../store/useSession'

/**
 * Shown while you've claimed a code but your partner hasn't joined yet. The partner's name
 * stays empty until their phone pairs in with the same code — that's our "still waiting" signal.
 * The app is fully usable meanwhile.
 */
export function WaitingBanner() {
  const t = useT()
  const couple = useCouple()
  const activePartner = useSession((s) => s.activePartner)
  const code = couple?.coupleSpaceCode?.trim()
  if (!couple || !code) return null
  const partnerName = (activePartner === 'A' ? couple.partnerBName : couple.partnerAName)?.trim()
  const waiting = !partnerName

  return (
    <AnimatePresence>
      {waiting && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mx-auto mt-3 flex w-full max-w-md items-center gap-3 rounded-2xl bg-coral/10 px-4 py-3 text-left ring-1 ring-coral/20"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral/15 text-coral">
            <Clock size={18} />
          </span>
          <span className="flex-1 leading-tight">
            <span className="block text-sm font-bold text-ink">{t('Waiting for your partner…')}</span>
            <span className="block text-xs text-ink-soft">
              {t('Share the code')} <span className="font-bold text-coral">{code}</span> {t('— they pair in by entering it.')}
            </span>
          </span>
          <button
            type="button"
            aria-label={t('Copy code')}
            onClick={() => {
              void navigator.clipboard?.writeText(code)
              haptic(6)
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft transition active:scale-90"
          >
            <Copy size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
