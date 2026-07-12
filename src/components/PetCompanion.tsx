import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion'
import type { AnimationPlaybackControls } from 'framer-motion'
import { ArrowRight, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePets } from '../db/hooks'
import { carePet, renamePet } from '../db/repo'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { type PetAction, STAGE_LABEL, moodOf, settleStats, stageOf } from '../lib/pet'
import type { Pet } from '../types'
import { BottomSheet } from './BottomSheet'
import { Creature } from './Creature'
import { PetAdoptSheet } from './PetAdoptSheet'
import { PixelPet } from './PixelPet'
import { ActionButton, StatBar, moodBubble, statusText } from './petUi'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Roaming companions that live in the app shell, so the pets follow you across every screen. */
export function PetCompanion() {
  const pets = usePets()
  const t = useT()
  const onHabitat = useLocation().pathname === '/pet'
  const [now, setNow] = useState(() => Date.now())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adopt, setAdopt] = useState(false)

  // Re-settle stats / stage / mood as real time passes.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  // On the habitat screen the pets already appear in the scene — don't double them with roamers.
  if (pets === undefined || onHabitat) return null

  if (pets.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAdopt(true)}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-1.5 rounded-full bg-paper/95 py-2 pl-2.5 pr-3.5 text-sm font-bold text-ink shadow-[0_8px_24px_-8px_rgba(58,46,43,0.45)] ring-1 ring-ink/5 backdrop-blur active:scale-95"
        >
          <motion.span
            animate={{ rotate: [0, -8, 8, -8, 0] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
            className="text-lg"
          >
            🥚
          </motion.span>
          {t('Adopt a pet')}
        </button>
        <PetAdoptSheet open={adopt} onClose={() => setAdopt(false)} />
      </>
    )
  }

  const selected = pets.find((p) => p.id === selectedId) ?? null

  return (
    <>
      {pets.map((pet, i) => (
        <RoamingPet key={pet.id} pet={pet} now={now} index={i} onTap={() => setSelectedId(pet.id)} />
      ))}
      <CareSheet
        pet={selected}
        now={now}
        open={!!selected}
        onClose={() => setSelectedId(null)}
        onChange={() => setNow(Date.now())}
      />
    </>
  )
}

/**
 * One pet living on screen: it strolls left↔right on little feet, and you can pick it up and drop
 * it anywhere (it keeps wandering at wherever you place it). Tap (without dragging) opens its care.
 */
function RoamingPet({ pet, now, index, onTap }: { pet: Pet; now: number; index: number; onTap: () => void }) {
  const x = useMotionValue(16 + index * 56)
  const y = useMotionValue(0) // 0 = ground; negative = lifted up
  const [dir, setDir] = useState<1 | -1>(1)
  const [walking, setWalking] = useState(false)
  const [held, setHeld] = useState(false)
  const [bounds, setBounds] = useState({ maxX: 0, maxY: 0 })
  const walkCtrl = useRef<AnimationPlaybackControls | null>(null)
  const pauseRef = useRef<number | undefined>(undefined)

  const stage = stageOf(pet, now)
  const mood = moodOf(pet, now)
  const bubble = moodBubble(mood)
  const still = prefersReducedMotion() || mood === 'sleepy' || stage === 'egg'

  useEffect(() => {
    const measure = () => {
      const w = Math.min(window.innerWidth, 448)
      setBounds({ maxX: Math.max(0, w - 56), maxY: Math.max(0, window.innerHeight - 220) })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Imperative wander loop on the x motion value (so drag can interrupt it cleanly).
  useEffect(() => {
    let cancelled = false
    const scheduleNext = () => {
      pauseRef.current = window.setTimeout(walk, 700 + Math.random() * 2000)
    }
    const walk = () => {
      if (cancelled || held || still || bounds.maxX <= 0) return
      const target = Math.round(Math.random() * bounds.maxX)
      setDir(target >= x.get() ? 1 : -1)
      setWalking(true)
      walkCtrl.current = animate(x, target, {
        duration: 2.5 + Math.random() * 2,
        ease: 'linear',
        onComplete: () => {
          setWalking(false)
          if (!cancelled) scheduleNext()
        },
      })
    }
    if (!still && bounds.maxX > 0 && !held) {
      const kick = window.setTimeout(walk, 400 + index * 250)
      return () => {
        cancelled = true
        window.clearTimeout(kick)
        window.clearTimeout(pauseRef.current)
        walkCtrl.current?.stop()
      }
    }
    setWalking(false)
    walkCtrl.current?.stop()
    return () => {
      cancelled = true
      window.clearTimeout(pauseRef.current)
      walkCtrl.current?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, held, bounds.maxX])

  return (
    <div className="pointer-events-none fixed inset-0 z-30 mx-auto max-w-md">
      <motion.button
        type="button"
        onTap={onTap}
        aria-label={pet.name}
        drag
        dragMomentum={false}
        dragElastic={0.12}
        dragConstraints={{ left: 0, right: bounds.maxX, top: -bounds.maxY, bottom: 0 }}
        onDragStart={() => {
          walkCtrl.current?.stop()
          setWalking(false)
          setHeld(true)
          haptic(6)
        }}
        onDragEnd={() => setHeld(false)}
        whileDrag={{ scale: 1.12 }}
        style={{ x, y, position: 'absolute', left: 0, bottom: 'calc(4.6rem + env(safe-area-inset-bottom))' }}
        className="pointer-events-auto grid touch-none cursor-grab place-items-center active:cursor-grabbing"
      >
        <AnimatePresence>
          {bubble && !held && (
            <motion.span
              key={bubble}
              initial={{ opacity: 0, y: 4, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -top-5 text-xs"
            >
              {bubble}
            </motion.span>
          )}
        </AnimatePresence>
        <Creature species={pet.species} stage={stage} dir={dir} walking={walking} held={held} size={46} />
      </motion.button>
    </div>
  )
}

function CareSheet({
  pet,
  now,
  open,
  onClose,
  onChange,
}: {
  pet: Pet | null
  now: number
  open: boolean
  onClose: () => void
  onChange: () => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const [reaction, setReaction] = useState<string | null>(null)
  const [eating, setEating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')

  if (!pet)
    return (
      <BottomSheet open={open} onClose={onClose} title={t('Your pet')}>
        <></>
      </BottomSheet>
    )

  const stats = settleStats(pet, now)
  const stage = stageOf(pet, now)
  const isEgg = stage === 'egg'

  async function act(action: PetAction, emoji: string) {
    if (!pet) return
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

  async function saveName() {
    if (!pet) return
    await renamePet(pet.id, name)
    setEditing(false)
    onChange()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('Your pet')}>
      <div className="space-y-5">
        <div className="relative flex flex-col items-center">
          <div className="relative grid h-24 w-24 place-items-center rounded-full bg-cream-deep">
            <PixelPet species={pet.species} stage={stage} moving={false} eating={eating} size={72} />
            <AnimatePresence>
              {reaction && (
                <motion.span
                  initial={{ opacity: 0, y: 0, scale: 0.6 }}
                  animate={{ opacity: 1, y: -34, scale: 1.2 }}
                  exit={{ opacity: 0 }}
                  className="absolute text-2xl"
                >
                  {reaction}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {editing ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-40 rounded-xl bg-cream-deep px-3 py-1.5 text-center font-serif text-lg text-ink outline-none ring-1 ring-transparent focus:ring-coral/40"
              />
              <button type="button" onClick={saveName} className="btn-primary px-3 py-1.5 text-sm">
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
              className="mt-3 flex items-center gap-1.5 active:opacity-70"
            >
              <span className="font-serif text-2xl font-semibold text-ink">{pet.name}</span>
              <Pencil size={14} className="text-ink-soft" />
            </button>
          )}
          <p className="mt-0.5 text-sm text-ink-soft">{t(STAGE_LABEL[stage])}</p>
          <p className="mt-2 text-center text-sm font-semibold text-ink">{statusText(t, pet, now)}</p>
        </div>

        <div className="space-y-2.5">
          <StatBar emoji="🍖" label={t('Fullness')} value={stats.fullness} />
          <StatBar emoji="😊" label={t('Happiness')} value={stats.happiness} />
          <StatBar emoji="⚡" label={t('Energy')} value={stats.energy} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <ActionButton emoji="🍖" label={t('Feed')} onClick={() => act('feed', '🍖')} />
          <ActionButton emoji="🎾" label={t('Play')} onClick={() => act('play', '🎾')} disabled={isEgg} />
          <ActionButton emoji="❤️" label={t('Pet')} onClick={() => act('pet', '💕')} />
        </div>

        <button
          type="button"
          onClick={() => {
            onClose()
            navigate('/pet')
          }}
          className="flex w-full items-center justify-center gap-1.5 text-sm font-bold text-coral active:scale-95"
        >
          {t('Open habitat')} <ArrowRight size={15} />
        </button>
      </div>
    </BottomSheet>
  )
}
