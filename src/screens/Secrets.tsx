import { AnimatePresence, motion } from 'framer-motion'
import { Check, ImagePlus, Lock, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { BlobImage } from '../components/BlobImage'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/Toast'
import { useCouple, useSecrets } from '../db/hooks'
import { addSecret, addSecretPhotos, deleteSecret, removeSecretPhoto, toggleSecret } from '../db/repo'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { otherPartner, partnerName } from '../lib/partners'
import { hashPin } from '../lib/pin'
import { compressImage } from '../lib/photos'
import { useSession } from '../store/useSession'
import type { Secret } from '../types'

const FIELD =
  'w-full rounded-2xl bg-cream-deep px-4 py-3 text-ink placeholder:text-ink-soft/60 outline-none ring-1 ring-transparent focus:ring-coral/40'
const onlyDigits = (s: string) => s.replace(/\D/g, '').slice(0, 6)

export default function Secrets() {
  const t = useT()
  const couple = useCouple()
  const secrets = useSecrets()
  const { activePartner, secretPin, setSecretPin } = useSession()
  const toast = useToast()
  const [unlocked, setUnlocked] = useState(!secretPin)
  const [pinEntry, setPinEntry] = useState('')
  const [text, setText] = useState('')
  const [settingPin, setSettingPin] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [lightbox, setLightbox] = useState<Blob | null>(null)

  if (!couple) return null
  const them = partnerName(couple, otherPartner(activePartner))
  const mine = (secrets ?? []).filter((s) => s.owner === activePartner)

  // 🔒 PIN gate
  if (secretPin && !unlocked) {
    const tryUnlock = () => {
      if (hashPin(pinEntry) === secretPin) {
        setUnlocked(true)
        setPinEntry('')
        haptic(8)
      } else {
        toast(t('Wrong PIN'), '🔒')
        setPinEntry('')
      }
    }
    return (
      <div className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
        <PageHeader title={t('Secret space')} back />
        <div className="card mt-8 p-8 text-center">
          <p className="text-5xl">🔒</p>
          <p className="mt-3 font-bold text-ink">{t('Enter your PIN')}</p>
          <input
            type="password"
            inputMode="numeric"
            value={pinEntry}
            onChange={(e) => setPinEntry(onlyDigits(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
            className="mx-auto mt-4 block w-40 rounded-2xl bg-cream-deep px-4 py-3 text-center text-2xl tracking-[0.4em] text-ink outline-none ring-1 ring-transparent focus:ring-coral/40"
            autoFocus
          />
          <button type="button" className="btn-primary mx-auto mt-4 flex" onClick={tryUnlock}>
            {t('Unlock')}
          </button>
        </div>
      </div>
    )
  }

  async function add() {
    if (!text.trim()) return
    await addSecret(activePartner, text)
    setText('')
    haptic(6)
  }

  return (
    <div className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
      <PageHeader title={t('Secret space')} subtitle={t('Private to you — hidden from {them}', { them })} back />

      <div className="card mb-4 flex items-start gap-3 p-4">
        <span className="text-xl">🤫</span>
        <p className="text-sm text-ink-soft">
          {t('Only you can see these. They stay on this device — never synced, never on {them}’s phone.', { them })}
        </p>
      </div>

      <div className="card mb-4 flex items-center gap-2 p-3">
        <input
          className={FIELD}
          placeholder={t('A private note or to-do…')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button
          type="button"
          onClick={add}
          disabled={!text.trim()}
          aria-label={t('Add secret')}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral text-white transition active:scale-90 disabled:opacity-40"
        >
          <Plus size={24} />
        </button>
      </div>

      {mine.length === 0 ? (
        <EmptyState emoji="🤫" title={t('Nothing secret yet')} subtitle={t('Plan a surprise, or jot a private thought.')} />
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false} mode="popLayout">
            {mine.map((s) => (
              <SecretRow key={s.id} secret={s} onView={setLightbox} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* PIN management */}
      <div className="mt-8">
        {secretPin ? (
          <div className="flex gap-3">
            <button type="button" className="btn-soft flex-1" onClick={() => setUnlocked(false)}>
              <Lock size={16} /> {t('Lock now')}
            </button>
            <button
              type="button"
              className="btn-soft flex-1 text-coral-deep"
              onClick={() => {
                setSecretPin(null)
                toast(t('PIN removed'), '🔓')
              }}
            >
              {t('Remove PIN')}
            </button>
          </div>
        ) : settingPin ? (
          <div className="card flex items-center gap-2 p-3">
            <input
              type="password"
              inputMode="numeric"
              placeholder={t('Choose a 4–6 digit PIN')}
              value={newPin}
              onChange={(e) => setNewPin(onlyDigits(e.target.value))}
              className={FIELD}
              autoFocus
            />
            <button
              type="button"
              className="btn-primary shrink-0"
              disabled={newPin.length < 4}
              onClick={() => {
                setSecretPin(hashPin(newPin))
                setSettingPin(false)
                setNewPin('')
                toast(t('PIN set 🔒'))
              }}
            >
              {t('Save')}
            </button>
          </div>
        ) : (
          <button type="button" className="btn-soft mx-auto flex" onClick={() => setSettingPin(true)}>
            <Lock size={16} /> {t('Set a PIN to lock this')}
          </button>
        )}
      </div>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="fixed inset-0 z-[60] grid place-items-center bg-ink/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <BlobImage blob={lightbox} className="max-h-[85vh] w-auto rounded-2xl object-contain" alt="" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SecretRow({ secret, onView }: { secret: Secret; onView: (b: Blob) => void }) {
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const photos = secret.photos ?? []

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    const blobs = await Promise.all(Array.from(files).map((f) => compressImage(f)))
    await addSecretPhotos(secret.id, blobs)
    haptic(8)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 480, damping: 36 }}
      className="card p-3.5"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            haptic(secret.done ? 4 : [8, 20])
            void toggleSecret(secret.id)
          }}
          aria-label={secret.done ? t('Mark not done') : t('Mark done')}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ring-2 transition ${
            secret.done ? 'bg-sage text-white ring-sage' : 'text-transparent ring-ink/15'
          }`}
        >
          <AnimatePresence>
            {secret.done && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check size={18} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <p className={`min-w-0 flex-1 font-semibold ${secret.done ? 'text-ink-soft/60 line-through' : 'text-ink'}`}>
          {secret.text}
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={t('Add photo')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft/60 transition active:scale-90 hover:text-coral"
        >
          <ImagePlus size={16} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addPhotos(e.target.files)}
        />
        <button
          type="button"
          onClick={() => void deleteSecret(secret.id)}
          aria-label={t('Delete secret')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft/50 transition active:scale-90 hover:text-coral-deep"
        >
          <X size={16} />
        </button>
      </div>

      {photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pl-11 [scrollbar-width:none]">
          {photos.map((blob, i) => (
            <div key={i} className="relative shrink-0">
              <button type="button" onClick={() => onView(blob)} className="block active:scale-95">
                <BlobImage blob={blob} className="h-16 w-16 rounded-xl object-cover" alt="" />
              </button>
              <button
                type="button"
                onClick={() => void removeSecretPhoto(secret.id, i)}
                aria-label={t('Remove photo')}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/55 text-white backdrop-blur active:scale-90"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
