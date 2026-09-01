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
import { CalendarPlus, CalendarX, Check, ChevronLeft, ChevronRight, Heart, Plus, Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { RoutineSheet } from '../components/RoutineSheet'
import { useToast } from '../components/Toast'
import {
  calendarEventsIn,
  useCalendarSources,
  useCouple,
  useTodoGroups,
  useTodos,
  type CalendarEvent,
  type CalendarEventType,
} from '../db/hooks'
import { addRoutineDate, addTodo, skipRoutineDate, toggleRoutineOccurrence, updateTodo } from '../db/repo'
import { DAY_REMINDER_HOUR, formatTime } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { activeDateLocale, useT } from '../lib/i18n'
import { localOccurrenceInstant, occursOn, routineSummary } from '../lib/recurrence'
import { ROUTINE_CATEGORY, defaultTodoList } from '../lib/taxonomy'
import { downloadTodoIcs } from '../lib/todoIcs'
import { useSession } from '../store/useSession'
import type { PartnerKey, Routine, Todo } from '../types'

// Labels are translated at render via t(); colors/emoji stay as-is. A routine carries no emoji:
// its row is interactive, so the slot holds a real check control instead (see RoutineRow).
const META: Record<CalendarEventType | 'anniversary', { emoji?: string; color: string; label: string }> = {
  todo: { emoji: '☑️', color: '#6E7D62', label: 'Wishlist' },
  routine: { color: '#B4703F', label: 'Routine' },
  capsule: { emoji: '💌', color: '#7E6BB0', label: 'Capsule' },
  anniversary: { emoji: '❤️', color: '#C25876', label: 'Anniversary' },
}
const dayKey = (d: Date | number) => format(d, 'yyyy-MM-dd')

export default function Calendar() {
  const t = useT()
  const couple = useCouple()
  const todos = useTodos()
  const toast = useToast()
  const activePartner = useSession((s) => s.activePartner)
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [adding, setAdding] = useState(false)

  // Routines are expanded per DAY, so the window decides how much work this is: it is exactly the
  // grid being drawn, six weeks, with the selected day folded in (stepping the cursor two months
  // away used to leave it outside the window and blank its detail panel).
  //
  // It used to reach a month further either side. That slack was pure cost: the window is an input
  // to the derivation, so every month step recomputed it anyway, and the extra days were never
  // drawn. Roughly 100 days of expansion per routine became about 42.
  const gridFrom = dayKey(startOfWeek(startOfMonth(cursor)))
  const gridTo = dayKey(endOfWeek(endOfMonth(cursor)))
  const selectedKey = dayKey(selected)
  const sources = useCalendarSources()
  // The window is resolved FIRST, so tapping a day inside the grid leaves it unchanged and the memo
  // below holds. Depending on `selectedKey` directly re-expanded every routine on every day tap,
  // for a window that had not moved.
  const from = selectedKey < gridFrom ? selectedKey : gridFrom
  const to = selectedKey > gridTo ? selectedKey : gridTo
  const events = useMemo(() => calendarEventsIn(sources, from, to), [sources, from, to])

  /** Take one occurrence off the calendar. The repeat carries on; only this day stops being expected. */
  async function removeFromDay(event: CalendarEvent) {
    if (!event.occurrenceKey) return
    haptic(6)
    await skipRoutineDate(event.sourceId, event.occurrenceKey)
    toast(t('Off for {date}', { date: format(event.at, 'MMM d', { locale }) }), '🚫')
  }

  /** Hand one wishlist item to the phone's own calendar app (a routine goes as one RRULE event). */
  function exportToPhone(sourceId: string) {
    const todo = todos?.find((row) => row.id === sourceId)
    if (!todo || !downloadTodoIcs(todo)) return
    haptic(6)
    toast(t('Calendar file saved'), '🗓️')
  }

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
                  // The bare number reads as "5" to a screen reader; name the whole day instead.
                  aria-label={format(day, 'EEEE, MMMM d', { locale })}
                  aria-current={today ? 'date' : undefined}
                  data-day={dayKey(day)}
                  className="flex flex-col items-center py-1"
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold transition ${
                      selectedDay
                        ? 'bg-coral-deep text-white'
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

      {/* selected day detail (see RoutineRow below for the tick-off row) */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h2 className="min-w-0 truncate font-serif text-lg font-semibold text-ink">
            {format(selected, 'EEEE, MMMM d', { locale })}
          </h2>
          {/* Adding straight onto the day you are looking at, rather than going to another screen
              and setting the date by hand. */}
          <button
            type="button"
            onClick={() => {
              haptic(6)
              setAdding(true)
            }}
            className="chip shrink-0 bg-cream-deep text-ink-soft"
          >
            <Plus size={14} /> {t('Add')}
          </button>
        </div>
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
              <div className="card flex items-center gap-3 p-3.5">
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

            {selectedEvents.map((e) =>
              e.type === 'routine' ? (
                <RoutineRow
                  key={e.id}
                  event={e}
                  by={activePartner}
                  onOpen={() => navigate(e.route)}
                  onExport={() => exportToPhone(e.sourceId)}
                  onRemoveFromDay={() => removeFromDay(e)}
                />
              ) : (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => navigate(e.route)}
                  className="card flex w-full items-center gap-3 p-3.5 text-left transition active:scale-[0.99]"
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
              ),
            )}

            {selectedEvents.length === 0 && selectedAnniv === null && (
              <EmptyState
                emoji="🗓️"
                title={t('Nothing on this day')}
                subtitle={t('Add a date or a repeating routine to a wishlist item and it shows up here.')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AddToDaySheet key={selectedKey} open={adding} onClose={() => setAdding(false)} day={selected} />
    </div>
  )
}

/**
 * One occurrence of a routine on the selected day. Unlike the other rows it is not just a link:
 * the couple can tick THAT day off right here (each day carries its own state), and hand the whole
 * repeating series to the phone's calendar app.
 */
/**
 * Add a to-do or a routine straight onto the day being looked at.
 *
 * One sheet with a type switch rather than two entry points, because the only real difference is
 * what the day MEANS: a to-do gets it as its reminder date, a routine gets it as the day its rule
 * starts from. Keyed by day by the caller, so reopening on another day starts clean.
 */
function AddToDaySheet({ open, onClose, day }: { open: boolean; onClose: () => void; day: Date }) {
  const t = useT()
  const toast = useToast()
  const locale = activeDateLocale()
  const groups = useTodoGroups()
  const todos = useTodos()
  const activePartner = useSession((s) => s.activePartner)
  const lastTodoList = useSession((s) => s.lastTodoList)
  const setLastTodoList = useSession((s) => s.setLastTodoList)
  const dayIso = dayKey(day)

  /**
   * Four things this sheet can do, kept as separate modes rather than one "pick existing" list with
   * headings inside it: what you can pick differs per kind, and so does the reason there might be
   * nothing to pick, which a shared list cannot say clearly.
   */
  const [kind, setKind] = useState<'todo' | 'routine' | 'pickTodo' | 'pickRoutine'>('todo')
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  // a routine always has a rule, so it starts with one: every day, from the day being added to
  const [rule, setRule] = useState<Routine>({ freq: 'daily', interval: 1, startDate: dayIso })
  const [rulesOpen, setRulesOpen] = useState(false)

  const groupList = groups ?? []
  const target = defaultTodoList(groupList, lastTodoList, category)

  /**
   * What can be dropped onto this day. Two kinds, and each has a reason to be left out:
   *
   * A to-do that is already ticked off, because dating a finished task achieves nothing.
   *
   * A routine that ALREADY lands on this day, because picking it would be a silent no-op. That
   * covers both a rule that reaches the day and a one-off day already added to it.
   */
  const pickable = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (title: string) => !q || title.toLowerCase().includes(q)
    const list = (todos ?? []).filter((td) => matches(td.title))
    const todoPicks = list
      .filter((td) => !td.routine && !td.done)
      // undated first: giving a date to something that has none is the common case, and moving one
      // that already has a date is the rarer, more deliberate act
      .sort((a, b) => (a.dueAt ? 1 : 0) - (b.dueAt ? 1 : 0))
    const routinePicks = list.filter((td) => td.routine && !occursOn(td.routine, dayIso))
    // how many routines are hidden BECAUSE they already land here, so the empty state can say so
    const alreadyHere = list.filter((td) => td.routine && occursOn(td.routine, dayIso)).length
    return { todoPicks, routinePicks, alreadyHere, total: todoPicks.length + routinePicks.length }
  }, [todos, query, dayIso])

  const picking = kind === 'pickTodo' || kind === 'pickRoutine'
  const rows = kind === 'pickRoutine' ? pickable.routinePicks : kind === 'pickTodo' ? pickable.todoPicks : []

  async function assign(todo: Todo) {
    if (todo.routine) {
      // The rule is untouched: this adds one extra day, so a Tuesday routine can happen on a
      // Thursday without moving every other Tuesday.
      await addRoutineDate(todo.id, dayIso)
      toast(t('Added to {date}', { date: format(day, 'MMM d', { locale }) }), '\u{1F501}')
    } else {
      await updateTodo(todo.id, { dueAt: localOccurrenceInstant(dayIso, DAY_REMINDER_HOUR) })
      toast(t('Added to {date}', { date: format(day, 'MMM d', { locale }) }), '\u{2705}')
    }
    haptic(8)
    onClose()
  }

  async function add() {
    const text = title.trim()
    if (!text) return
    if (kind === 'routine') {
      await addTodo({ title: text, category: ROUTINE_CATEGORY, addedBy: activePartner, routine: rule })
      toast(t('Routine added'), '\u{1F501}')
    } else {
      await addTodo({
        title: text,
        category: target,
        addedBy: activePartner,
        // the same 09:00 the wishlist uses, so a day picked here behaves like one picked there
        dueAt: localOccurrenceInstant(dayIso, DAY_REMINDER_HOUR),
      })
      setLastTodoList(target)
      toast(t('Added to {date}', { date: format(day, 'MMM d', { locale }) }), '\u{2705}')
    }
    haptic(8)
    setTitle('')
    onClose()
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('Add to {date}', { date: format(day, 'EEE, MMM d', { locale }) })}
      >
        <div className="space-y-4">
          {/* four chips do not fit a phone width, so the row scrolls like the category rows do */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={kind === 'todo'} onClick={() => setKind('todo')}>
              {t('New wishlist')}
            </Chip>
            <Chip active={kind === 'routine'} onClick={() => setKind('routine')}>
              <Repeat size={14} /> {t('New routine')}
            </Chip>
            <Chip active={kind === 'pickTodo'} onClick={() => setKind('pickTodo')}>
              {t('Pick wishlist')}
            </Chip>
            <Chip active={kind === 'pickRoutine'} onClick={() => setKind('pickRoutine')}>
              <Repeat size={14} /> {t('Pick routine')}
            </Chip>
          </div>

          {picking ? (
            <div>
              <label className="mb-1.5 block text-sm font-bold text-ink-soft">
                {kind === 'pickRoutine' ? t('One of your routines') : t('Something on your wishlist')}
              </label>
              <input
                className="field"
                placeholder={t('Search…')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {rows.length === 0 ? (
                <p className="mt-3 px-1 text-sm text-ink-soft">
                  {/* "nothing to pick" reads as broken when the real reason is that every routine
                      already happens today, which is the normal case for a daily one. */}
                  {query.trim()
                    ? t('Nothing matches that.')
                    : kind === 'pickRoutine' && pickable.alreadyHere > 0
                      ? t('All your routines already happen on this day. Remove one with the ⃠ on its row.')
                      : kind === 'pickRoutine'
                        ? t('No routines yet.')
                        : t('Nothing on your wishlist to pick.')}
                </p>
              ) : (
                <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                  {rows.map((td) => (
                    <button
                      key={td.id}
                      type="button"
                      onClick={() => assign(td)}
                      className="row flex w-full items-center gap-3 p-3 text-left active:scale-[0.99]"
                    >
                      {td.routine && <Repeat size={14} className="shrink-0 text-ink-soft" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{td.title}</span>
                        {td.routine ? (
                          <span className="block text-xs text-ink-soft">
                            {/* says the rule is untouched, so nobody expects the whole series to move */}
                            {t('just this day, its repeat stays')}
                          </span>
                        ) : (
                          // an existing date means picking this MOVES it, which is worth saying
                          td.dueAt && (
                            <span className="block text-xs text-ink-soft">
                              {t('now {date}', { date: format(td.dueAt, 'EEE, MMM d', { locale }) })}
                            </span>
                          )
                        )}
                      </span>
                      <Plus size={16} className="shrink-0 text-coral-deep" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink-soft">
              {kind === 'routine' ? t('Routine') : t('Task')}
            </label>
            <input
              className="field"
              placeholder={kind === 'routine' ? t('What do you two do together?') : t('Add a task\u2026')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </div>

          {kind === 'routine' ? (
            <div>
              <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Repeats')}</label>
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="field flex items-center gap-2 text-left"
              >
                <Repeat size={16} className="shrink-0 text-ink-soft" />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{routineSummary(rule, t)}</span>
                <span className="shrink-0 text-xs font-bold text-coral-deep">{t('Change')}</span>
              </button>
            </div>
          ) : (
            groupList.length > 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('List')}</label>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {groupList.map((g) => (
                    <Chip key={g.id} active={target === g.id} color={g.tint} onClick={() => setCategory(g.id)}>
                      {g.emoji} {t(g.label)}
                    </Chip>
                  ))}
                </div>
              </div>
            )
          )}

          <button type="button" className="btn-primary w-full" disabled={!title.trim()} onClick={add}>
            {kind === 'routine' ? t('Add routine') : t('Add to-do')}
          </button>
            </>
          )}
        </div>
      </BottomSheet>

      {/* stacked on top, same as the wishlist and routines screens */}
      <RoutineSheet
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        value={rule}
        onSave={(next) => {
          setRule(next)
          setRulesOpen(false)
        }}
      />
    </>
  )
}

function RoutineRow({
  event,
  by,
  onOpen,
  onExport,
  onRemoveFromDay,
}: {
  event: CalendarEvent
  by: PartnerKey
  onOpen: () => void
  onExport: () => void
  onRemoveFromDay: () => void
}) {
  const t = useT()
  const occurrenceKey = event.occurrenceKey
  return (
    <div
      className="card flex w-full items-center gap-3 p-3.5"
    >
      {/* The same check the wishlist row uses, so "tap to tick this day off" needs no explaining. */}
      <button
        type="button"
        disabled={!occurrenceKey}
        onClick={() => {
          if (!occurrenceKey) return
          haptic(event.done ? 4 : [8, 20])
          void toggleRoutineOccurrence(event.sourceId, occurrenceKey, by)
        }}
        aria-label={event.done ? t('Mark not done') : t('Mark done')}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition active:scale-90"
      >
        <span
          className="grid h-6 w-6 place-items-center rounded-full text-white"
          style={
            event.done
              ? { backgroundColor: '#7C8A6F', boxShadow: 'inset 0 0 0 2px #7C8A6F' }
              : { backgroundColor: `${META.routine.color}26`, boxShadow: `inset 0 0 0 2px ${META.routine.color}` }
          }
        >
          {event.done && <Check size={14} strokeWidth={3} />}
        </span>
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left active:opacity-70">
        <p className={`font-semibold ${event.done ? 'text-ink-soft/60 line-through' : 'text-ink'}`}>{event.title}</p>
        <p className="flex items-center gap-1.5 text-sm text-ink-soft">
          <span style={{ color: META.routine.color }} className="font-bold">
            {t(META.routine.label)}
          </span>
          {!event.allDay && <span>· {formatTime(event.at)}</span>}
          {event.subtitle && <span className="truncate">· {event.subtitle}</span>}
        </p>
      </button>
      <button
        type="button"
        onClick={onExport}
        aria-label={t('Add to phone calendar')}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft/60 transition active:scale-90 hover:text-coral"
      >
        <CalendarPlus size={16} />
      </button>
      {/* Takes this ONE day off the calendar. The repeat itself carries on, which is why this is not
          the same as deleting the routine (that lives on the routines screen). */}
      <button
        type="button"
        onClick={onRemoveFromDay}
        aria-label={t('Not on this day')}
        title={t('Not on this day')}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft/60 transition active:scale-90 hover:text-coral-deep"
      >
        <CalendarX size={16} />
      </button>
    </div>
  )
}
