// The repeat editor: turns a one-off wishlist item into a routine that comes back over many days.
// Everything it produces is a plain `Routine` rule (never a list of dates), so the same sheet is
// used for composing a new activity and for editing an existing one.
import { format, parseISO } from 'date-fns'
import { Repeat, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_OCCURRENCES,
  ROUTINE_FREQS,
  WEEKDAY_KEYS,
  addDaysKey,
  nextOccurrenceKey,
  occurrenceKeys,
  routineSummary,
  weekdayOf,
} from '../lib/recurrence'
import { todayIso } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { activeDateLocale, useT } from '../lib/i18n'
import type { Routine, RoutineFreq } from '../types'
import { BottomSheet } from './BottomSheet'
import { Chip } from './Chip'

const FIELD =
  'w-full rounded-2xl bg-cream-deep px-4 py-3 text-ink placeholder:text-ink-soft/60 outline-none ring-1 ring-transparent focus:ring-coral/40'

const FREQ_LABELS: Record<RoutineFreq, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
const UNIT_LABELS: Record<RoutineFreq, [one: string, many: string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
}
type EndMode = 'never' | 'on' | 'after'

export function RoutineSheet({
  open,
  onClose,
  value,
  onSave,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  value?: Routine | null
  onSave: (routine: Routine) => void
  onRemove?: () => void
}) {
  const t = useT()
  const locale = activeDateLocale()
  const [freq, setFreq] = useState<RoutineFreq>('daily')
  const [every, setEvery] = useState(1)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [startDate, setStartDate] = useState(todayIso)
  const [time, setTime] = useState('')
  const [endMode, setEndMode] = useState<EndMode>('never')
  const [until, setUntil] = useState('')
  const [count, setCount] = useState(10)

  // Seed the form from the rule being edited, but ONLY on open: `value` comes from a live Dexie
  // query, so any unrelated write re-creates that object, and reacting to it would wipe an edit
  // in progress.
  const seed = useRef(value)
  seed.current = value
  useEffect(() => {
    if (!open) return
    const routine = seed.current
    const start = routine?.startDate || todayIso()
    setFreq(routine?.freq ?? 'daily')
    setEvery(routine?.interval ?? 1)
    setWeekdays(routine?.weekdays?.length ? routine.weekdays : [weekdayOf(start)])
    setStartDate(start)
    setTime(routine?.time ?? '')
    setEndMode(routine?.count ? 'after' : routine?.until ? 'on' : 'never')
    setUntil(routine?.until ?? '')
    setCount(routine?.count ?? 10)
  }, [open])

  const draft: Routine = useMemo(
    () => ({
      freq,
      interval: every,
      weekdays: freq === 'weekly' ? weekdays : undefined,
      startDate,
      time: time || undefined,
      until: endMode === 'on' && until ? until : null,
      count: endMode === 'after' ? count : null,
    }),
    [freq, every, weekdays, startDate, time, endMode, until, count],
  )

  // A weekly rule with every weekday switched off can't land anywhere, so block saving it.
  const valid = freq !== 'weekly' || weekdays.length > 0
  const preview = useMemo(() => {
    if (!valid) return []
    const from = nextOccurrenceKey(draft, startDate) ?? startDate
    return occurrenceKeys(draft, from, addDaysKey(from, 366 * 2), 3)
  }, [draft, startDate, valid])

  function toggleWeekday(day: number) {
    haptic(4)
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b),
    )
  }

  const [unitOne, unitMany] = UNIT_LABELS[freq]

  return (
    <BottomSheet open={open} onClose={onClose} title={t('Repeat this')}>
      <div className="space-y-4">
        {/* how often */}
        <div className="flex gap-2">
          {ROUTINE_FREQS.map((f) => (
            <Chip
              key={f}
              active={freq === f}
              onClick={() => {
                haptic(4)
                setFreq(f)
              }}
            >
              {t(FREQ_LABELS[f])}
            </Chip>
          ))}
        </div>

        {/* every N days/weeks/months */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-ink-soft">{t('Every')}</span>
          <div className="flex items-center gap-2 rounded-full bg-cream-deep px-1.5 py-1">
            <button
              type="button"
              onClick={() => setEvery((n) => Math.max(1, n - 1))}
              aria-label={t('Repeat more often')}
              className="grid h-8 w-8 place-items-center rounded-full text-lg font-bold text-ink-soft active:scale-90"
            >
              −
            </button>
            <span className="min-w-6 text-center font-bold text-ink">{every}</span>
            <button
              type="button"
              onClick={() => setEvery((n) => Math.min(99, n + 1))}
              aria-label={t('Repeat less often')}
              className="grid h-8 w-8 place-items-center rounded-full text-lg font-bold text-ink-soft active:scale-90"
            >
              +
            </button>
          </div>
          <span className="text-sm font-bold text-ink-soft">{every === 1 ? t(unitOne) : t(unitMany)}</span>
        </div>

        {/* which days (weekly only) */}
        {freq === 'weekly' && (
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('On these days')}</label>
            <div className="flex gap-1.5">
              {WEEKDAY_KEYS.map((key, day) => {
                const on = weekdays.includes(day)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    aria-pressed={on}
                    aria-label={t(key)}
                    className={`h-10 flex-1 rounded-xl text-xs font-bold transition active:scale-90 ${
                      on ? 'bg-coral text-white' : 'bg-cream-deep text-ink-soft'
                    }`}
                  >
                    {t(key).slice(0, 2)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* start + time of day */}
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Starts')}</label>
            <input type="date" className={FIELD} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Time (optional)')}</label>
            <input type="time" className={FIELD} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        {/* when it stops */}
        <div>
          <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Ends')}</label>
          <div className="flex gap-2">
            {(['never', 'on', 'after'] as EndMode[]).map((mode) => (
              <Chip
                key={mode}
                active={endMode === mode}
                onClick={() => {
                  haptic(4)
                  setEndMode(mode)
                }}
              >
                {t(mode === 'never' ? 'Never' : mode === 'on' ? 'On a date' : 'After N times')}
              </Chip>
            ))}
          </div>
          {endMode === 'on' && (
            <input
              type="date"
              className={`${FIELD} mt-2`}
              value={until}
              min={startDate}
              onChange={(e) => setUntil(e.target.value)}
            />
          )}
          {endMode === 'after' && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={MAX_OCCURRENCES}
                className={FIELD}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(MAX_OCCURRENCES, Number(e.target.value) || 1)))}
              />
              <span className="shrink-0 text-sm font-bold text-ink-soft">{t('times')}</span>
            </div>
          )}
        </div>

        {/* live read-back of the rule + its first few days */}
        <div className="rounded-2xl bg-coral/10 p-3.5 ring-1 ring-coral/20">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Repeat size={15} className="shrink-0 text-coral" />
            {valid ? routineSummary(draft, t) : t('Pick at least one day')}
          </p>
          {preview.length > 0 && (
            <p className="mt-1 text-sm text-ink-soft">
              {t('Next: {days}', {
                days: preview.map((day) => format(parseISO(day), 'EEE, MMM d', { locale })).join(' · '),
              })}
            </p>
          )}
        </div>

        <button
          type="button"
          className="btn-primary w-full"
          disabled={!valid}
          onClick={() => {
            haptic(8)
            onSave(draft)
          }}
        >
          {t('Save routine')}
        </button>
        {onRemove && (
          <button
            type="button"
            className="btn-soft mx-auto flex text-coral-deep"
            onClick={() => {
              haptic(6)
              onRemove()
            }}
          >
            <Trash2 size={16} /> {t('Stop repeating')}
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
