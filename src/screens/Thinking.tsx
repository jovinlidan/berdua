import { AnimatePresence, motion } from 'framer-motion'
import { Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/Toast'
import { useCouple, useThinkingPings } from '../db/hooks'
import { addThinkingPing, deleteThinkingPing } from '../db/repo'
import { relativeTime } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { PARTNER_COLORS, otherPartner, partnerName } from '../lib/partners'
import { sendPing } from '../lib/ping'
import { useSession } from '../store/useSession'
import { syncOnce } from '../sync/sync'

const PRESETS = ['Thinking of you 💕', 'Miss you 🥺', 'Can’t wait to see you 😘', 'Hope your day is going well ☀️']

export default function Thinking() {
  const t = useT()
  const couple = useCouple()
  const pings = useThinkingPings()
  const { activePartner, setLastSeenThinking } = useSession()
  const toast = useToast()
  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)

  // Newest received ping → mark the thread as seen (clears the Home unread dot).
  const newestReceived = useMemo(
    () => (pings ?? []).filter((p) => p.fromPartner !== activePartner).reduce((m, p) => Math.max(m, p.createdAt), 0),
    [pings, activePartner],
  )
  useEffect(() => {
    if (newestReceived) setLastSeenThinking(newestReceived)
  }, [newestReceived, setLastSeenThinking])

  if (!couple) return null
  const them = partnerName(couple, otherPartner(activePartner))

  async function send(message?: string) {
    if (!couple) return
    const msg = message?.trim()
    if (!msg) return
    if (!couple.coupleSpaceCode) {
      toast(t('Add a couple-space code in Settings first'), '🔗')
      return
    }
    setSending(true)
    setCustom('') // clear right away so the composer is ready for the next one
    // Save the durable record FIRST (this is what survives a cleared notification), then push.
    await addThinkingPing(activePartner, msg)
    const sent = await sendPing(couple.coupleSpaceCode, activePartner, msg)
    void syncOnce(true) // get the record into the cloud now, so the partner pulls it even if the push fails
    setSending(false)
    haptic([8, 30, 8])
    toast(
      sent === null
        ? t('Saved — syncs when you’re back 💭')
        : sent > 0
          ? t('Sent to {partner} 💕', { partner: them })
          : t('Saved — {partner} gets it once their phone is set up', { partner: them }),
      '💭',
    )
  }

  async function remove(id: string) {
    await deleteThinkingPing(id)
    void syncOnce(true)
    haptic(8)
  }

  return (
    <div className="pb-[calc(9.5rem+env(safe-area-inset-bottom))]">
      <PageHeader title={t('Thinking of you')} subtitle={t('Little pings, kept safe here 💭')} back />

      {pings === undefined ? null : pings.length === 0 ? (
        <EmptyState
          emoji="💭"
          title={t('No pings yet')}
          subtitle={t('Tap a note below or write your own — {partner} will always find it here.', { partner: them })}
        />
      ) : (
        <ul className="mt-2 space-y-3">
          <AnimatePresence initial={false}>
            {pings.map((p) => {
              const mine = p.fromPartner === activePartner
              const who = mine ? t('You') : partnerName(couple, p.fromPartner)
              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar name={who} color={PARTNER_COLORS[p.fromPartner]} size={28} />
                  <div className={`max-w-[78%] ${mine ? 'items-end text-right' : 'items-start'} flex flex-col`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 ${
                        mine ? 'rounded-br-md bg-coral text-white' : 'rounded-bl-md bg-cream-deep text-ink'
                      }`}
                    >
                      <span className="font-script text-xl leading-snug">{p.message}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 px-1 text-xs text-ink-soft">
                      <span>{who}</span>
                      <span aria-hidden>·</span>
                      <span>{relativeTime(p.createdAt)}</span>
                      {mine && (
                        <button
                          type="button"
                          onClick={() => remove(p.id)}
                          aria-label={t('Remove this ping')}
                          className="ml-0.5 text-ink-soft/60 transition active:scale-90 hover:text-coral"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Always-on composer pinned to the bottom — quick notes + your own, and it stays put after sending. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/5 bg-paper/95 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2.5">
          <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={sending}
                onClick={() => send(p)}
                className="shrink-0 whitespace-nowrap rounded-full bg-cream-deep px-3.5 py-1.5 text-sm font-semibold text-ink transition active:scale-95 disabled:opacity-50"
              >
                {t(p)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-2xl bg-cream-deep px-4 py-3 text-ink placeholder:text-ink-soft/60 outline-none ring-1 ring-transparent focus:ring-coral/40"
              placeholder={t('Write a little something for {partner}…', { partner: them })}
              value={custom}
              enterKeyHint="send"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(custom)}
            />
            <button
              type="button"
              disabled={sending || !custom.trim()}
              onClick={() => send(custom)}
              aria-label={t('Send ping')}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral text-white transition active:scale-90 disabled:opacity-40"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
