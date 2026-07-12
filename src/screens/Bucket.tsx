import { AnimatePresence, motion } from 'framer-motion'
import { Check, Circle, ExternalLink, Plus } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { BucketFormSheet } from '../components/BucketFormSheet'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useBucket, useCouple } from '../db/hooks'
import { completeBucketItem, uncompleteBucketItem } from '../db/repo'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { LINK_SOURCE } from '../lib/links'
import { PARTNER_COLORS, partnerName } from '../lib/partners'
import { WISH_LEVELS, WISH_ORDER } from '../lib/taxonomy'
import type { BucketItem, WishLevel } from '../types'

export default function Bucket() {
  const t = useT()
  const items = useBucket()
  const couple = useCouple()
  const [wish, setWish] = useState<WishLevel | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BucketItem | undefined>()

  if (!couple) return null

  const list = items ?? []
  const open = list.filter((i) => !i.isComplete)
  const done = list.filter((i) => i.isComplete)
  const openByWish = (w: WishLevel) => open.filter((i) => i.wishLevel === w).length
  const visibleOpen = wish === 'all' ? open : open.filter((i) => i.wishLevel === wish)
  const visibleDone = wish === 'all' ? done : done.filter((i) => i.wishLevel === wish)

  async function complete(item: BucketItem) {
    haptic([10, 40, 10])
    await completeBucketItem(item.id)
  }

  return (
    <div className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
      <PageHeader
        title={t('Our bucket list')}
        subtitle={
          list.length
            ? `${t('{n} to chase', { n: open.length })} · ${t('{n} kept', { n: done.length })} 💛`
            : t('dreams for the two of you')
        }
      />

      {list.length === 0 ? (
        <EmptyState
          emoji="🌙"
          title={t('No dreams yet')}
          subtitle={t('Add the first thing you want to do together someday.')}
          action={{ label: t('Add a dream'), onClick: () => setFormOpen(true) }}
        />
      ) : (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip active={wish === 'all'} onClick={() => setWish('all')}>
            {t('All')}{open.length > 0 ? ` · ${open.length}` : ''}
          </Chip>
          {WISH_ORDER.map((w) => (
            <Chip key={w} active={wish === w} color={WISH_LEVELS[w].tint} onClick={() => setWish(w)}>
              {WISH_LEVELS[w].emoji} {t(WISH_LEVELS[w].label)}
              {openByWish(w) > 0 ? ` · ${openByWish(w)}` : ''}
            </Chip>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
          {visibleOpen.map((item) => {
            const wl = WISH_LEVELS[item.wishLevel]
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                className="card relative flex items-center gap-3 overflow-hidden p-4 pl-4"
              >
                <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: wl.tint }} />
                <button
                  type="button"
                  onClick={() => complete(item)}
                  aria-label={t('Mark as done together')}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft ring-2 ring-ink/10 transition active:scale-90 hover:text-coral hover:ring-coral/40"
                >
                  <Circle size={20} />
                </button>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(item)}>
                  <p className="truncate font-serif text-lg font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold">
                    <span style={{ color: wl.tint }}>
                      {wl.emoji} {t(wl.label)}
                    </span>
                    {item.link && item.linkSource && (
                      <span className="text-ink-soft">
                        · {LINK_SOURCE[item.linkSource].emoji} {t(LINK_SOURCE[item.linkSource].label)}
                      </span>
                    )}
                  </p>
                </button>
                {item.link && item.linkThumb ? (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t('Open link')}
                    className="shrink-0 transition active:scale-95"
                  >
                    <img src={item.linkThumb} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  </a>
                ) : item.link ? (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t('Open link')}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft transition active:scale-90 hover:text-coral"
                  >
                    <ExternalLink size={16} />
                  </a>
                ) : null}
                <Avatar name={partnerName(couple, item.addedBy)} color={PARTNER_COLORS[item.addedBy]} size={22} />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {visibleDone.length > 0 && (
        <>
          <p className="mb-2 mt-7 text-sm font-bold text-ink-soft">{t('Dreams we’ve kept')} 💛</p>
          <div className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {visibleDone.map((item) => {
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
                    transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      haptic(6)
                      void uncompleteBucketItem(item.id)
                    }}
                    className="card flex w-full items-center gap-3 p-4 text-left"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage text-white">
                      <Check size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-lg font-semibold text-ink">{item.title}</p>
                      <p className="text-sm text-ink-soft">{t('Kept 💛 · tap to undo')}</p>
                    </div>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setFormOpen(true)}
        aria-label={t('Add dream')}
        className={`fixed bottom-[calc(5.2rem+env(safe-area-inset-bottom))] right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-coral text-white shadow-[0_12px_30px_-8px_rgba(232,146,124,0.9)] transition-opacity duration-200 active:scale-90 ${
          formOpen || editing ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <Plus size={26} />
      </button>

      <BucketFormSheet open={formOpen} onClose={() => setFormOpen(false)} />
      <BucketFormSheet open={!!editing} onClose={() => setEditing(undefined)} existing={editing} />
    </div>
  )
}
