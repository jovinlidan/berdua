import { AnimatePresence, motion } from 'framer-motion'
import { CloudOff } from 'lucide-react'
import { useT } from '../lib/i18n'
import { useOnline } from '../lib/useOnline'

/** A calm reassurance when offline — everything still works locally and syncs on reconnect. */
export function OfflineBanner() {
  const t = useT()
  const online = useOnline()
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-ink/90 px-4 text-center text-sm font-semibold text-cream backdrop-blur"
          style={{ paddingTop: 'calc(0.45rem + env(safe-area-inset-top))', paddingBottom: '0.45rem' }}
        >
          <CloudOff size={15} /> {t('Offline — saved here, syncs when you’re back')}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
