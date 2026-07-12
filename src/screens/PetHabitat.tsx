import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion'
import type { AnimationPlaybackControls } from 'framer-motion'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { Creature } from '../components/Creature'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { PetAdoptSheet } from '../components/PetAdoptSheet'
import { PixelPet } from '../components/PixelPet'
import { ActionButton, StatBar, moodBubble, statusText } from '../components/petUi'
import { usePets } from '../db/hooks'
import { carePet, releasePet, renamePet } from '../db/repo'
import { formatDay } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import {
  MAX_PETS,
  SPECIES,
  STAGE_LABEL,
  ageDays,
  growth,
  type PetAction,
  moodOf,
  settleStats,
  stageOf,
} from '../lib/pet'
import type { Pet } from '../types'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const speciesLabel = (id: string) => SPECIES.find((s) => s.id === id)?.label ?? id

export default function PetHabitat() {
  const pets = usePets()
  const t = useT()
  const [now, setNow] = useState(() => Date.now())
  const [adopt, setAdopt] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  if (pets === undefined) return null

  return (
    <div className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
      <PageHeader title={t('Our little habitat')} subtitle={t('Raise up to three together')} />

      {pets.length === 0 ? (
        <EmptyState
          emoji="🥚"
          title={t('No pets yet')}
          subtitle={t('Adopt a little one and raise it together.')}
        />
      ) : (
        <Scene pets={pets} now={now} />
      )}

      <div className="mt-5 space-y-4">
        {pets.map((pet) => (
          <PetCard key={pet.id} pet={pet} now={now} onChange={() => setNow(Date.now())} t={t} />
        ))}
      </div>

      {pets.length < MAX_PETS && (
        <button
          type="button"
          onClick={() => setAdopt(true)}
          className="btn-soft mx-auto mt-5 flex"
        >
          <Plus size={18} /> {pets.length === 0 ? t('Adopt a pet') : t('Adopt another')}
        </button>
      )}
      <p className="mt-3 text-center text-xs text-ink-soft/80">{t('{n} of {max} pets', { n: pets.length, max: MAX_PETS })}</p>
      <p className="mt-6 text-center text-[10px] leading-relaxed text-ink-soft/60">
        Pixel animals by Daniel Eddeland (OpenGameArt) · CC-BY 3.0
      </p>

      <PetAdoptSheet open={adopt} onClose={() => setAdopt(false)} />
    </div>
  )
}

/** A shared scene where all the pets wander around together — and can be dragged within it. */
function Scene({ pets, now }: { pets: Pet[]; now: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [maxX, setMaxX] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setMaxX(Math.max(0, el.clientWidth - 56))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  return (
    <div ref={ref} className="pet-scene relative h-44 overflow-hidden rounded-[var(--radius-card)] ring-1 ring-ink/5">
      {/* ground */}
      <div className="pet-scene-ground absolute inset-x-0 bottom-0 h-10" />
      {pets.map((pet, i) => (
        <SceneWalker key={pet.id} pet={pet} now={now} maxX={maxX} index={i} boxRef={ref} />
      ))}
    </div>
  )
}

function SceneWalker({
  pet,
  now,
  maxX,
  index,
  boxRef,
}: {
  pet: Pet
  now: number
  maxX: number
  index: number
  boxRef: RefObject<HTMLDivElement | null>
}) {
  const x = useMotionValue(20 + index * 60)
  const y = useMotionValue(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [walking, setWalking] = useState(false)
  const [held, setHeld] = useState(false)
  const ctrl = useRef<AnimationPlaybackControls | null>(null)
  const pause = useRef<number | undefined>(undefined)
  const mood = moodOf(pet, now)
  const stage = stageOf(pet, now)
  const still = prefersReducedMotion() || mood === 'sleepy' || stage === 'egg'
  const bubble = moodBubble(mood)

  useEffect(() => {
    let cancelled = false
    const scheduleNext = () => {
      pause.current = window.setTimeout(walk, 600 + Math.random() * 1800)
    }
    const walk = () => {
      if (cancelled || held || still || maxX <= 0) return
      const target = Math.round(Math.random() * maxX)
      setDir(target >= x.get() ? 1 : -1)
      setWalking(true)
      ctrl.current = animate(x, target, {
        duration: 2.5 + Math.random() * 2,
        ease: 'linear',
        onComplete: () => {
          setWalking(false)
          if (!cancelled) scheduleNext()
        },
      })
    }
    if (!still && maxX > 0 && !held) {
      const kick = window.setTimeout(walk, 400 + index * 300)
      return () => {
        cancelled = true
        window.clearTimeout(kick)
        window.clearTimeout(pause.current)
        ctrl.current?.stop()
      }
    }
    setWalking(false)
    ctrl.current?.stop()
    return () => {
      cancelled = true
      window.clearTimeout(pause.current)
      ctrl.current?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, held, maxX])

  return (
    <motion.div
      className="absolute bottom-6 left-0 grid touch-none cursor-grab place-items-center active:cursor-grabbing"
      style={{ x, y }}
      drag
      dragConstraints={boxRef}
      dragElastic={0.1}
      dragMomentum={false}
      onDragStart={() => {
        ctrl.current?.stop()
        setWalking(false)
        setHeld(true)
        haptic(6)
      }}
      onDragEnd={() => setHeld(false)}
      whileDrag={{ scale: 1.12, zIndex: 10 }}
    >
      {bubble && !held && <span className="absolute -top-6 text-sm">{bubble}</span>}
      <Creature species={pet.species} stage={stage} dir={dir} walking={walking} held={held} size={68} />
    </motion.div>
  )
}

function PetCard({
  pet,
  now,
  onChange,
  t,
}: {
  pet: Pet
  now: number
  onChange: () => void
  t: ReturnType<typeof useT>
}) {
  const [reaction, setReaction] = useState<string | null>(null)
  const [eating, setEating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(pet.name)
  const stats = settleStats(pet, now)
  const stage = stageOf(pet, now)
  const g = growth(pet, now)
  const age = ageDays(pet, now)
  const isEgg = stage === 'egg'

  async function act(action: PetAction, emoji: string) {
    if (action === 'play' && stats.energy < 10) {
      setReaction('💤')
      window.setTimeout(() => setReaction(null), 900)
      return
    }
    haptic([8, 20])
    setReaction(emoji)
    if (action === 'feed') {
      setEating(true)
      window.setTimeout(() => setEating(false), 1300)
    }
    await carePet(pet.id, action)
    onChange()
    window.setTimeout(() => setReaction(null), 900)
  }
  async function release() {
    if (!window.confirm(t('Release {name}? This frees a slot and can’t be undone.', { name: pet.name }))) return
    await releasePet(pet.id)
    onChange()
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-4">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-cream-deep">
          <PixelPet species={pet.species} stage={stage} moving={false} eating={eating} size={56} />
          <AnimatePresence>
            {reaction && (
              <motion.span
                initial={{ opacity: 0, y: 0, scale: 0.6 }}
                animate={{ opacity: 1, y: -28, scale: 1.2 }}
                exit={{ opacity: 0 }}
                className="absolute text-xl"
              >
                {reaction}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-full rounded-xl bg-cream-deep px-3 py-1.5 font-serif text-lg text-ink outline-none ring-1 ring-transparent focus:ring-coral/40"
              />
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-sm"
                onClick={async () => {
                  await renamePet(pet.id, name)
                  setEditing(false)
                  onChange()
                }}
              >
                {t('Save')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setName(pet.name)
                setEditing(true)
              }}
              className="flex items-center gap-1.5 active:opacity-70"
            >
              <span className="font-serif text-xl font-semibold text-ink">{pet.name}</span>
              <Pencil size={13} className="text-ink-soft" />
            </button>
          )}
          <p className="text-sm text-ink-soft">
            {t(STAGE_LABEL[stage])} ·{' '}
            {isEgg ? t('hatching soon') : age === 0 ? t('born today') : t('{n} days old', { n: age })}
          </p>
          <p className="text-xs text-ink-soft/80">
            {t(speciesLabel(pet.species))} · {t('born {date}', { date: formatDay(pet.bornAt) })}
          </p>
        </div>
      </div>

      {/* growth toward next stage */}
      {g.next ? (
        <div className="mt-4">
          <div className="mb-0.5 flex justify-between text-xs font-bold text-ink-soft">
            <span>{t(STAGE_LABEL[g.stage])}</span>
            <span>{t(STAGE_LABEL[g.next])} →</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-cream-deep">
            <motion.div
              className="h-full rounded-full bg-coral"
              animate={{ width: `${Math.round(g.progress * 100)}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 28 }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-center text-sm font-semibold text-coral">{t('All grown up 💖')}</p>
      )}

      <p className="mt-3 text-center text-sm font-semibold text-ink">{statusText(t, pet, now)}</p>

      <div className="mt-4 space-y-2.5">
        <StatBar emoji="🍖" label={t('Fullness')} value={stats.fullness} />
        <StatBar emoji="😊" label={t('Happiness')} value={stats.happiness} />
        <StatBar emoji="⚡" label={t('Energy')} value={stats.energy} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <ActionButton emoji="🍖" label={t('Feed')} onClick={() => act('feed', '🍖')} />
        <ActionButton emoji="🎾" label={t('Play')} onClick={() => act('play', '🎾')} disabled={isEgg} />
        <ActionButton emoji="❤️" label={t('Pet')} onClick={() => act('pet', '💕')} />
      </div>

      <button
        type="button"
        onClick={release}
        className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-bold text-ink-soft/70 active:scale-95"
      >
        <Trash2 size={13} /> {t('Release')}
      </button>
    </div>
  )
}
