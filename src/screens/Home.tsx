import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Heart,
  ListTodo,
  Mail,
  PartyPopper,
  Repeat,
  Settings as SettingsIcon,
  Smile,
  Star,
} from 'lucide-react'
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { PixelPet } from '../components/PixelPet'
import { ThemeToggle } from '../components/ThemeToggle'
import { ThinkingOfYou } from '../components/ThinkingOfYou'
import { statusText } from '../components/petUi'
import { useBucket, useCouple, usePets, useRoutinesToday, useSealedNotes, useTodayMood, useTodos } from '../db/hooks'
import { daysTogether } from '../lib/dates'
import { useT } from '../lib/i18n'
import { stageOf } from '../lib/pet'
import { nextAnniversary, ordinalYear } from '../lib/milestones'
import { moodEmoji } from '../lib/taxonomy'
import { useSession } from '../store/useSession'

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.35, ease: 'easeOut' as const },
})

export default function Home() {
  const t = useT()
  const couple = useCouple()
  const bucket = useBucket()
  const todos = useTodos()
  const sealedNotes = useSealedNotes()
  const todayMood = useTodayMood()
  const pets = usePets()
  const routinesToday = useRoutinesToday()
  const { activePartner } = useSession()

  if (!couple) return null

  const days = daysTogether(couple.anniversaryDate)
  const anniv = nextAnniversary(couple.anniversaryDate)
  const showAnniv = anniv && (anniv.isToday || anniv.daysUntil <= 45)

  const dreamsKept = (bucket ?? []).filter((b) => b.isComplete).length
  const todosDone = (todos ?? []).filter((tt) => tt.done).length
  const capsuleCount = (sealedNotes ?? []).length
  const hasStats = dreamsKept + todosDone + capsuleCount > 0
  // Routines get their own card below, so they're left out of the wishlist count (never both).
  const openTodos = (todos ?? []).filter((tt) => !tt.done && !tt.routine).length
  const lockedCapsules = (sealedNotes ?? []).filter((n) => n.unlockAt > Date.now()).length

  // To-dos with a reminder that's due today or already overdue.
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const withDue = (todos ?? []).filter((tt) => !tt.done && tt.dueAt !== undefined)
  const overdueCount = withDue.filter((tt) => (tt.dueAt as number) < startOfToday.getTime()).length
  const dueTodayCount = withDue.filter(
    (tt) => (tt.dueAt as number) >= startOfToday.getTime() && (tt.dueAt as number) <= endOfToday.getTime(),
  ).length
  const hasUrgentTodos = overdueCount + dueTodayCount > 0

  // Routines that come around today (each day is ticked off on its own).
  const routines = routinesToday ?? []
  const routinesDone = routines.filter((r) => r.done).length
  const routinesLeft = routines.length - routinesDone

  const myMood = activePartner === 'A' ? todayMood?.moodA : todayMood?.moodB
  const theirMood = activePartner === 'A' ? todayMood?.moodB : todayMood?.moodA
  const theirNote = activePartner === 'A' ? todayMood?.noteB : todayMood?.noteA
  const theirName = activePartner === 'A' ? couple.partnerBName : couple.partnerAName
  const moodState =
    myMood && theirMood ? `${moodEmoji(myMood)} ${moodEmoji(theirMood)}` : myMood ? t('Waiting for them') : t('Tap to check in')

  return (
    <div className="pt-[calc(4rem+env(safe-area-inset-top))]">
      <div className="fixed left-3 top-[calc(0.6rem+env(safe-area-inset-top))] z-40 flex gap-2">
        <Link
          to="/settings"
          aria-label={t('Settings')}
          className="grid h-10 w-10 place-items-center rounded-full bg-paper/90 text-ink-soft shadow-[0_6px_20px_-8px_rgba(58,46,43,0.35)] ring-1 ring-ink/5 backdrop-blur active:scale-95"
        >
          <SettingsIcon size={19} />
        </Link>
        <ThemeToggle />
      </div>

      <motion.header {...fade()}>
        <p className="font-script text-3xl text-coral">{t('Hello, lovebirds')}</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-ink">
          {couple.partnerAName} <Heart size={20} className="mx-0.5 inline text-coral" fill="currentColor" />{' '}
          {couple.partnerBName}
        </h1>
        {days !== null && (
          <p className="mt-1 text-sm text-ink-soft">
            <AnimatedCounter value={days} className="font-bold text-coral" />{' '}
            {t('day{s} together and counting', { s: days === 1 ? '' : 's' })}
          </p>
        )}
      </motion.header>

      {/* Anniversary countdown */}
      {showAnniv && anniv && (
        <motion.div
          {...fade(0.05)}
          className="mt-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-gradient-to-r from-coral/20 to-gold/25 p-4 ring-1 ring-gold/30"
        >
          <PartyPopper className="shrink-0 text-coral-deep" size={26} />
          <p className="text-sm font-semibold text-ink">
            {anniv.isToday ? (
              <>{t('Happy {year} anniversary! 🎉 Celebrate the two of you today.', { year: ordinalYear(anniv.years) })}</>
            ) : (
              <>
                <span className="font-bold text-coral-deep">{t('{days} days', { days: anniv.daysUntil })}</span>{' '}
                {t('until your {year} anniversary 💞', { year: ordinalYear(anniv.years) })}
              </>
            )}
          </p>
        </motion.div>
      )}

      {/* Thinking of you */}
      <motion.div {...fade(0.12)} className="mt-5">
        <ThinkingOfYou />
      </motion.div>

      {/* Pet corner */}
      {pets && pets.length > 0 && (
        <motion.section {...fade(0.16)} className="mt-4">
          <Link to="/pet" className="block">
            <motion.div whileTap={{ scale: 0.99 }} className="card flex items-center gap-4 p-5">
              <div className="flex -space-x-2">
                {pets.slice(0, 3).map((p) => (
                  <PixelPet key={p.id} species={p.species} stage={stageOf(p, Date.now())} moving={false} size={40} />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg font-semibold text-ink">
                  {pets.length === 1 ? pets[0].name : t('Your pets')}
                </p>
                <p className="truncate text-sm text-ink-soft">
                  {pets.length === 1 ? statusText(t, pets[0], Date.now()) : t('Tap to feed & play →')}
                </p>
              </div>
            </motion.div>
          </Link>
        </motion.section>
      )}

      {/* Daily check-in */}
      <motion.section {...fade(0.2)} className="mt-4">
        <Link to="/checkin" className="block">
          <motion.div whileTap={{ scale: 0.99 }} className="card flex items-center gap-4 p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sage/15 text-sage">
              <Smile size={22} />
            </span>
            <div className="flex-1">
              <p className="font-bold text-ink">{t('How are we today?')}</p>
              <p className="text-sm text-ink-soft">
                {theirNote?.trim() ? t('💬 {name} left you a note', { name: theirName }) : moodState}
              </p>
            </div>
          </motion.div>
        </Link>
      </motion.section>

      {/* Today's routines */}
      {routines.length > 0 && (
        <motion.section {...fade(0.22)} className="mt-4">
          <Link to="/routines" className="block">
            <motion.div whileTap={{ scale: 0.99 }} className="card flex items-center gap-4 p-5">
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                  routinesLeft > 0 ? 'bg-coral/15 text-coral' : 'bg-sage/15 text-sage'
                }`}
              >
                <Repeat size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg font-semibold text-ink">{t('Our routines today')}</p>
                <p className={`truncate text-sm ${routinesLeft > 0 ? 'font-semibold text-coral-deep' : 'text-ink-soft'}`}>
                  {routinesLeft > 0
                    ? t('{done} of {total} done today', { done: routinesDone, total: routines.length })
                    : t('All done today 💞')}
                </p>
              </div>
            </motion.div>
          </Link>
        </motion.section>
      )}

      {/* Wishlist summary */}
      {openTodos > 0 && (
        <motion.section {...fade(0.24)} className="mt-4">
          <Link to="/todos" className="block">
            <motion.div whileTap={{ scale: 0.99 }} className="card flex items-center gap-4 p-5">
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                  hasUrgentTodos ? 'bg-coral/15 text-coral' : 'bg-sage/15 text-sage'
                }`}
              >
                <ListTodo size={24} />
              </span>
              <div className="flex-1">
                <p className="font-serif text-lg font-semibold text-ink">
                  {t('{count} on the wishlist', { count: openTodos })}
                </p>
                <p className={`text-sm ${hasUrgentTodos ? 'font-semibold text-coral-deep' : 'text-ink-soft'}`}>
                  {overdueCount > 0
                    ? `${t('⏰ {count} overdue', { count: overdueCount })}${dueTodayCount ? t(' · {count} due today', { count: dueTodayCount }) : ''}`
                    : dueTodayCount > 0
                      ? t('📌 {count} due today', { count: dueTodayCount })
                      : t('Tap to check things off →')}
                </p>
              </div>
            </motion.div>
          </Link>
        </motion.section>
      )}

      {/* Time capsules */}
      <motion.section {...fade(0.28)} className="mt-4">
        <Link to="/capsule" className="block">
          <motion.div whileTap={{ scale: 0.99 }} className="card flex items-center gap-4 p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold/20 text-2xl">💌</span>
            <div className="flex-1">
              <p className="font-serif text-lg font-semibold text-ink">{t('Time capsules')}</p>
              <p className="text-sm text-ink-soft">
                {lockedCapsules > 0
                  ? t('{count} sealed, waiting to open', { count: lockedCapsules })
                  : t('Write a note to your future selves →')}
              </p>
            </div>
          </motion.div>
        </Link>
      </motion.section>

      {/* Our story so far */}
      {hasStats && (
        <motion.section {...fade(0.32)} className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-ink-soft">{t('Our story so far')}</p>
            <Link to="/story" className="text-sm font-bold text-coral">
              {t('Full story →')}
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={<Star size={18} />} value={dreamsKept} label={t('dreams')} />
            <Stat icon={<CheckCircle2 size={18} />} value={todosDone} label={t('to-dos')} />
            <Stat icon={<Mail size={18} />} value={capsuleCount} label={t('capsules')} />
          </div>
        </motion.section>
      )}
    </div>
  )
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-0.5 py-4">
      <span className="text-coral">{icon}</span>
      <span className="font-serif text-2xl font-semibold text-ink">{value}</span>
      <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</span>
    </div>
  )
}
