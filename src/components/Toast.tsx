import { AnimatePresence, motion } from 'framer-motion'
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react'
import { newId } from '../lib/id'

interface Toast {
  id: string
  message: string
  icon?: string
}

const ToastContext = createContext<(message: string, icon?: string) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, icon?: string) => {
    const id = newId()
    setToasts((t) => [...t, { id, message, icon }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.6rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink/90 px-4 py-2.5 text-sm font-semibold text-cream shadow-lg backdrop-blur"
            >
              {t.icon && <span>{t.icon}</span>}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
