import { differenceInCalendarDays, format } from 'date-fns'
import { motion } from 'framer-motion'
import { Lock, Mail, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { BottomSheet } from '../components/BottomSheet'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/Toast'
import { useCouple, useSealedNotes } from '../db/hooks'
import { addSealedNote, deleteSealedNote } from '../db/repo'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { PARTNER_COLORS, partnerName } from '../lib/partners'
import { useSession } from '../store/useSession'
import type { SealedNote } from '../types'

const FIELD =
  'w-full rounded-2xl bg-cream-deep px-4 py-3 text-ink placeholder:text-ink-soft/60 outline-none ring-1 ring-transparent focus:ring-coral/40'

function defaultUnlock(): string {
  const d = new Date(Date.now() + 30 * 86_400_000) // a month out
  return format(d, 'yyyy-MM-dd')
}

export default function Capsule() {
  const notes = useSealedNotes()
  const couple = useCouple()
  const { activePartner } = useSession()
  const toast = useToast()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [unlock, setUnlock] = useState(defaultUnlock)

  if (!couple) return null

  const now = Date.now()
  const list = notes ?? []
  const locked = list.filter((n) => n.unlockAt > now)
  const opened = list.filter((n) => n.unlockAt <= now)

  async function save() {
    if (!body.trim()) return
    await addSealedNote({
      fromPartner: activePartner,
      title: title.trim() || undefined,
      body: body.trim(),
      unlockAt: new Date(`${unlock}T09:00`).getTime(),
    })
    setTitle('')
    setBody('')
    setUnlock(defaultUnlock())
    setOpen(false)
    haptic([10, 30, 10])
    toast(t('Sealed 💌'), '🔒')
  }

  return (
    <div className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
      <PageHeader title={t('Time capsules')} subtitle={t('Notes that open on a future day')} back />

      {list.length === 0 && (
        <EmptyState
          emoji="💌"
          title={t('Write a note to your future selves')}
          subtitle={t('Seal it now — it unlocks on the day you choose.')}
          action={{ label: t('Seal a note'), onClick: () => setOpen(true) }}
        />
      )}

      {locked.length > 0 && (
        <>
          <p className="mb-2 text-sm font-bold text-ink-soft">{t('Sealed 🔒')}</p>
          <div className="space-y-3">
            {locked.map((note) => (
              <SealedCard key={note.id} note={note} coupleNames={couple} />
            ))}
          </div>
        </>
      )}

      {opened.length > 0 && (
        <>
          <p className="mb-2 mt-7 text-sm font-bold text-ink-soft">{t('Opened 💛')}</p>
          <div className="space-y-3">
            {opened.map((note) => (
              <OpenedCard
                key={note.id}
                note={note}
                coupleNames={couple}
                onDelete={() => void deleteSealedNote(note.id)}
              />
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('New time capsule')}
        className={`fixed bottom-[calc(5.2rem+env(safe-area-inset-bottom))] right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-coral text-white shadow-[0_12px_30px_-8px_rgba(232,146,124,0.9)] transition-opacity duration-200 active:scale-90 ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <Plus size={26} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('Seal a note')}>
        <div className="space-y-4">
          <input className={FIELD} placeholder={t('Title (optional)')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className={`${FIELD} font-script text-2xl leading-snug`}
            rows={4}
            placeholder={t('Dear us…')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Opens on')}</label>
            <input type="date" className={FIELD} value={unlock} onChange={(e) => setUnlock(e.target.value)} />
          </div>
          <button type="button" className="btn-primary w-full" disabled={!body.trim()} onClick={save}>
            <Lock size={18} /> {t('Seal it')}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

function SealedCard({ note, coupleNames }: { note: SealedNote; coupleNames: { partnerAName: string; partnerBName: string } }) {
  const t = useT()
  const days = Math.max(0, differenceInCalendarDays(new Date(note.unlockAt), new Date()))
  return (
    <div className="card flex items-center gap-3 p-4 opacity-90">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cream-deep text-ink-soft">
        <Lock size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-lg font-semibold text-ink">{note.title || t('A sealed note')}</p>
        <p className="text-sm text-ink-soft">
          {t('Opens {date}', { date: format(new Date(note.unlockAt), 'MMM d, yyyy') })} · {days === 0 ? t('today') : t('in {n} days', { n: days })}
        </p>
      </div>
      <Avatar name={partnerName(coupleNames, note.fromPartner)} color={PARTNER_COLORS[note.fromPartner]} size={22} />
    </div>
  )
}

function OpenedCard({
  note,
  coupleNames,
  onDelete,
}: {
  note: SealedNote
  coupleNames: { partnerAName: string; partnerBName: string }
  onDelete: () => void
}) {
  const t = useT()
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden p-5 ring-2 ring-gold/40"
    >
      <div className="flex items-center gap-2 text-sm font-bold text-coral-deep">
        <Mail size={16} /> {note.title || t('A note from us')}
      </div>
      <p className="mt-2 whitespace-pre-wrap font-script text-2xl leading-snug text-ink">{note.body}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-ink-soft">
          <Avatar name={partnerName(coupleNames, note.fromPartner)} color={PARTNER_COLORS[note.fromPartner]} size={20} />
          {t('from {name}', { name: partnerName(coupleNames, note.fromPartner) })}
        </span>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('Delete capsule')}
          className="grid h-8 w-8 place-items-center rounded-full text-ink-soft/50 active:scale-90 hover:text-coral-deep"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  )
}
