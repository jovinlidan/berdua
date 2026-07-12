import { motion } from 'framer-motion'
import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { MoodChart } from '../components/MoodChart'
import { PageHeader } from '../components/PageHeader'
import { useCouple, useMoodHistory, useTodayMood } from '../db/hooks'
import { checkInMood } from '../db/repo'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { otherPartner, PARTNER_COLORS, partnerName } from '../lib/partners'
import { DAILY_MOODS, moodEmoji } from '../lib/taxonomy'
import { useSession } from '../store/useSession'

const FIELD =
  'w-full rounded-2xl bg-cream-deep px-4 py-3 text-ink placeholder:text-ink-soft/60 outline-none ring-1 ring-transparent focus:ring-coral/40'

export default function DailyCheckIn() {
  const t = useT()
  const couple = useCouple()
  const today = useTodayMood()
  const history = useMoodHistory(14)
  const { activePartner } = useSession()
  const [note, setNote] = useState('')

  if (!couple) return null

  const me = activePartner
  const them = otherPartner(activePartner)
  const myMood = me === 'A' ? today?.moodA : today?.moodB
  const theirMood = them === 'A' ? today?.moodA : today?.moodB
  const myNote = me === 'A' ? today?.noteA : today?.noteB
  const theirNote = them === 'A' ? today?.noteA : today?.noteB

  function setMood(value: number) {
    haptic(8)
    void checkInMood(me, value, note || myNote)
  }

  return (
    <div className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
      <PageHeader title={t('How are we today?')} subtitle={t('A quick daily check-in, just for us')} back />

      {/* both partners' today */}
      <div className="card mb-5 flex items-center justify-around p-5">
        <Today couple={couple} side={me} mood={myMood} label={t('You')} />
        <span className="text-2xl text-ink-soft/40">·</span>
        <Today couple={couple} side={them} mood={theirMood} label={partnerName(couple, them)} />
      </div>

      {/* a little note from your partner */}
      {theirNote?.trim() && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-5 flex items-start gap-3 p-4"
        >
          <Avatar name={partnerName(couple, them)} color={PARTNER_COLORS[them]} size={32} />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              {theirMood ? `${moodEmoji(theirMood)} ` : ''}
              {t('{name} today', { name: partnerName(couple, them) })}
            </p>
            <p className="mt-1 font-script text-xl leading-snug text-ink">“{theirNote}”</p>
          </div>
        </motion.div>
      )}

      {/* your check-in */}
      <p className="mb-2 text-sm font-bold text-ink-soft">
        {myMood ? t('Tap to update how you feel') : t('How are you feeling?')}
      </p>
      <div className="card flex items-center justify-between p-3">
        {DAILY_MOODS.map((m) => {
          const active = myMood === m.value
          return (
            <motion.button
              key={m.value}
              type="button"
              whileTap={{ scale: 0.85 }}
              animate={active ? { scale: 1.15 } : { scale: 1 }}
              onClick={() => setMood(m.value)}
              aria-label={m.label}
              aria-pressed={active}
              className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl transition ${
                active ? 'bg-coral/15 ring-2 ring-coral' : ''
              }`}
            >
              {m.emoji}
            </motion.button>
          )
        })}
      </div>

      {myMood && (
        <input
          className={`${FIELD} mt-3`}
          placeholder={t('A word about your day (optional)…')}
          defaultValue={myNote ?? ''}
          onChange={(e) => setNote(e.target.value)}
          onBlur={(e) => checkInMood(me, myMood, e.target.value)}
        />
      )}

      {/* chart */}
      {(history?.length ?? 0) > 0 && (
        <div className="card mt-6 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-bold" style={{ color: PARTNER_COLORS.A }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PARTNER_COLORS.A }} />
              {partnerName(couple, 'A')}
            </span>
            <span className="flex items-center gap-1.5 font-bold" style={{ color: PARTNER_COLORS.B }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PARTNER_COLORS.B }} />
              {partnerName(couple, 'B')}
            </span>
          </div>
          <MoodChart data={history ?? []} />
        </div>
      )}
    </div>
  )
}

function Today({
  couple,
  side,
  mood,
  label,
}: {
  couple: Parameters<typeof partnerName>[0]
  side: 'A' | 'B'
  mood?: number
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Avatar name={partnerName(couple, side)} color={PARTNER_COLORS[side]} size={28} />
      <span className="text-3xl">{mood ? moodEmoji(mood) : '·'}</span>
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
    </div>
  )
}
