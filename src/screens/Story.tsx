import { motion } from 'framer-motion'
import { CalendarHeart, CheckCircle2, Heart, Mail, Repeat, Star } from 'lucide-react'
import { type ReactNode } from 'react'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { PageHeader } from '../components/PageHeader'
import { useBucket, useCouple, useSealedNotes, useTodos } from '../db/hooks'
import { daysTogether } from '../lib/dates'
import { useT } from '../lib/i18n'
import { nextAnniversary, ordinalYear } from '../lib/milestones'
import { routineProgress } from '../lib/recurrence'

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.35, ease: 'easeOut' as const },
})

export default function Story() {
  const t = useT()
  const couple = useCouple()
  const bucket = useBucket()
  const todos = useTodos()
  const capsules = useSealedNotes()

  if (!couple) return null

  const days = daysTogether(couple.anniversaryDate)
  const anniv = nextAnniversary(couple.anniversaryDate)
  const dreamsKept = (bucket ?? []).filter((b) => b.isComplete).length
  const todosDone = (todos ?? []).filter((t) => t.done).length
  const capsuleCount = (capsules ?? []).length
  // Every occurrence the two of you ticked off across all routines.
  const routineDays = (todos ?? []).reduce((sum, t) => sum + (t.routine ? routineProgress(t).done : 0), 0)

  return (
    <div className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
      <PageHeader title={t('Our story')} back />
      {/* hero */}
      <motion.div {...fade()} className="card mb-5 overflow-hidden p-6 text-center">
        <p className="font-script text-2xl text-coral">{t('just the two of us')}</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold leading-tight text-ink">
          {couple.partnerAName} <Heart size={18} className="mx-0.5 inline text-coral" fill="currentColor" />{' '}
          {couple.partnerBName}
        </h1>
        {days !== null && (
          <div className="mt-4">
            <AnimatedCounter value={days} className="font-serif text-6xl font-semibold text-coral" />
            <p className="mt-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
              {days === 1 ? t('day together') : t('days together')}
            </p>
          </div>
        )}
        {anniv && (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1.5 text-sm font-semibold text-ink">
            <CalendarHeart size={15} className="text-coral-deep" />
            {anniv.isToday
              ? t('Happy {year} anniversary! 🎉', { year: ordinalYear(anniv.years) })
              : t('{n} days to your {year} anniversary', { n: anniv.daysUntil, year: ordinalYear(anniv.years) })}
          </p>
        )}
      </motion.div>

      {/* stats */}
      <motion.div {...fade(0.08)} className="mb-5 grid grid-cols-3 gap-3">
        <Stat icon={<Star size={18} />} value={dreamsKept} label={t('dreams')} />
        <Stat icon={<CheckCircle2 size={18} />} value={todosDone} label={t('to-dos')} />
        <Stat icon={<Mail size={18} />} value={capsuleCount} label={t('capsules')} />
      </motion.div>

      {routineDays > 0 && (
        <motion.p
          {...fade(0.12)}
          className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-sage/15 px-3.5 py-2 text-sm font-semibold text-ink"
        >
          <Repeat size={15} className="text-sage" />
          {t('{n} routine days kept together', { n: routineDays })}
        </motion.p>
      )}

      <motion.p {...fade(0.16)} className="mt-8 text-center font-script text-2xl text-coral-soft">
        {t('and the best is yet to come 💞')}
      </motion.p>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 py-5">
      <span className="text-coral">{icon}</span>
      <AnimatedCounter value={value} className="font-serif text-3xl font-semibold text-ink" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{label}</span>
    </div>
  )
}
