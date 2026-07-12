import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] max-w-md overflow-y-auto rounded-t-[2rem] bg-paper px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
            {title && (
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-2xl font-semibold text-ink">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="grid h-11 w-11 place-items-center rounded-full bg-cream-deep text-ink-soft active:scale-90"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
