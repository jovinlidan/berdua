import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useCalendarEvents, useCouple, type CalendarEvent, type CalendarEventType } from '../db/hooks'
import { formatTime } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { activeDateLocale, useT } from '../lib/i18n'

// Labels are translated at render via t(); colors/emoji stay as-is.
const META: Record<CalendarEventType | 'anniversary', { emoji: string; color: string; label: string }> = {
  todo: { emoji: '☑️', color: '#7C8A6F', label: 'Wishlist' },
  capsule: { emoji: '💌', color: '#9D8EC9', label: 'Capsule' },
  anniversary: { emoji: '❤️', color: '#E07A9B', label: 'Anniversary' },
}
const dayKey = (d: Date | number) => format(d, 'yyyy-MM-dd')

export default function Calendar() {
  const t = useT()
  const couple = useCouple()
  const events = useCalendarEvents()
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())

  // Weekday initials + month names follow the chosen language (re-renders via useT on lang change).
  const locale = activeDateLocale()
  const weekStart = startOfWeek(new Date())
  const weekdays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'EEEEE', { locale }))

  // group events by local day
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of events ?? []) {
      const k = dayKey(e.at)
      const list = m.get(k)
      if (list) list.push(e)
      else m.set(k, [e])
    }
    for (const list of m.values()) list.sort((a, b) => a.at - b.at)
    return m
  }, [events])

  // recurring anniversary → years count on a given day (null if not the anniversary)
  const anniv = couple?.anniversaryDate ? parseISO(couple.anniversaryDate) : null
  const annivYearsOn = (d: Date): number | null => {
    if (!anniv || Number.isNaN(anniv.getTime())) return null
    if (d.getMonth() !== anniv.getMonth() || d.getDate() !== anniv.getDate()) return null
    return Math.max(0, d.getFullYear() - anniv.getFullYear())
  }

  const gridDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  })

  const selectedEvents = byDay.get(dayKey(selected)) ?? []
  const selectedAnniv = annivYearsOn(selected)

  function pick(day: Date) {
    haptic(5)
    setSelected(day)
    if (!isSameMonth(day, cursor)) setCursor(startOfMonth(day))
  }
  function step(dir: 1 | -1) {
    haptic(5)
    setCursor((c) => addMonths(c, dir))
  }
  function goToday() {
    haptic(6)
    const now = new Date()
    setCursor(startOfMonth(now))
    setSelected(now)
  }

  return (
    <div className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
      <PageHeader title={t('Our calendar')} subtitle={t('Dates, to-dos & moments together')} />

      {/* month switcher */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={t('Previous month')}
          className="grid h-9 w-9 place-items-center rounded-full bg-cream-deep text-ink-soft transition active:scale-90"
        >
          <ChevronLeft size={20} />
        </button>
        <button type="button" onClick={goToday} className="font-serif text-xl font-semibold text-ink active:opacity-70">
          {format(cursor, 'MMMM yyyy', { locale })}
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={t('Next month')}
          className="grid h-9 w-9 place-items-center rounded-full bg-cream-deep text-ink-soft transition active:scale-90"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* grid */}
      <div className="card p-3">
        <div className="mb-1 grid grid-cols-7">
          {weekdays.map((d, i) => (
            <div key={i} className="text-center text-xs font-bold text-ink-soft/70">
              {d}
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={format(cursor, 'yyyy-MM')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="grid grid-cols-7 gap-y-1"
          >
            {gridDays.map((day) => {
              const dayEvents = byDay.get(dayKey(day)) ?? []
              const types = [...new Set(dayEvents.map((e) => e.type))]
              const annivYears = annivYearsOn(day)
              const inMonth = isSameMonth(day, cursor)
              const selectedDay = isSameDay(day, selected)
              const today = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pick(day)}
                  className="flex flex-col items-center py-1"
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold transition ${
                      selectedDay
                        ? 'bg-coral text-white'
                        : today
                          ? 'text-coral ring-2 ring-coral/40'
                          : inMonth
                            ? 'text-ink'
                            : 'text-ink-soft/35'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {/* dots */}
                  <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                    {annivYears !== null && (
                      <Heart size={7} fill={META.anniversary.color} color={META.anniversary.color} />
                    )}
                    {types.slice(0, 4).map((ty) => (
                      <span
                        key={ty}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: META[ty].color, opacity: inMonth ? 1 : 0.4 }}
                      />
                    ))}
                  </span>
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* selected day detail */}
      <div className="mt-5">
        <h2 className="mb-2 px-1 font-serif text-lg font-semibold text-ink">{format(selected, 'EEEE, MMMM d', { locale })}</h2>
        <AnimatePresence mode="wait">
          <motion.div
            key={dayKey(selected)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="space-y-2.5"
          >
            {selectedAnniv !== null && (
              <div className="card flex items-center gap-3 p-3.5" style={{ boxShadow: `inset 4px 0 0 ${META.anniversary.color}` }}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xl" style={{ backgroundColor: `${META.anniversary.color}22` }}>
                  {META.anniversary.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{t('Anniversary')}</p>
                  <p className="text-sm text-ink-soft">
                    {selectedAnniv > 0
                      ? t(selectedAnniv === 1 ? '{n} year together 🥹' : '{n} years together 🥹', { n: selectedAnniv })
                      : t('The day it began 💞')}
                  </p>
                </div>
              </div>
            )}

            {selectedEvents.map((e) => (
              <button
                key={`${e.type}-${e.id}`}
                type="button"
                onClick={() => navigate(e.route)}
                className="card flex w-full items-center gap-3 p-3.5 text-left transition active:scale-[0.99]"
                style={{ boxShadow: `inset 4px 0 0 ${META[e.type].color}` }}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xl" style={{ backgroundColor: `${META[e.type].color}22` }}>
                  {META[e.type].emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${e.done ? 'text-ink-soft/60 line-through' : 'text-ink'}`}>{e.title}</p>
                  <p className="flex items-center gap-1.5 text-sm text-ink-soft">
                    <span style={{ color: META[e.type].color }} className="font-bold">
                      {t(META[e.type].label)}
                    </span>
                    <span>· {formatTime(e.at)}</span>
                    {e.subtitle && <span className="truncate">· {e.subtitle}</span>}
                  </p>
                </div>
              </button>
            ))}

            {selectedEvents.length === 0 && selectedAnniv === null && (
              <EmptyState
                emoji="🗓️"
                title={t('Nothing on this day')}
                subtitle={t('Plan a date or add a to-do with a reminder and it shows up here.')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
