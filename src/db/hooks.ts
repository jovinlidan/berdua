// Reactive reads. dexie-react-hooks re-renders components automatically whenever the
// underlying IndexedDB rows change — no manual cache invalidation needed.
import { useLiveQuery } from 'dexie-react-hooks'
import { todayIso } from '../lib/dates'
import {
  isOccurrenceDone,
  localOccurrenceInstant,
  nextOccurrenceKey,
  occurrenceKeys,
  occursOn,
  withinLimits,
} from '../lib/recurrence'
import type { SealedNote, Todo } from '../types'
import { db } from './database'
import { COUPLE_ID } from './repo'

// undefined = still loading · null = no couple yet (→ onboarding) · object = exists
export const useCouple = () =>
  useLiveQuery(async () => (await db.couples.get(COUPLE_ID)) ?? null)

// undefined = loading · array (possibly empty) = the couple's pets, stable oldest-first order
export const usePets = () =>
  useLiveQuery(async () => (await db.pets.toArray()).sort((a, b) => a.createdAt - b.createdAt))

export const useBucket = () =>
  useLiveQuery(() => db.bucketItems.orderBy('createdAt').reverse().toArray())

export const useTodos = () =>
  useLiveQuery(() => db.todos.orderBy('createdAt').reverse().toArray())

/**
 * The two halves of the todos table, kept apart because they are different kinds of thing: a
 * wishlist item is finished once, a routine keeps coming back. They share one synced collection so
 * per-day ticks, tombstones and history keep working, but no screen ever shows both.
 */
export const useWishlist = () =>
  useLiveQuery(() => db.todos.orderBy('createdAt').reverse().toArray().then((rows) => rows.filter((r) => !r.routine)))

/** Routines, soonest next occurrence first, so the list reads as "what's coming". */
export const useRoutines = () =>
  useLiveQuery(async () => {
    const today = todayIso()
    const rows = (await db.todos.toArray()).filter((r) => r.routine)
    // Expand each rule ONCE: called from inside the comparator it would re-walk the calendar on
    // every comparison.
    return rows
      .map((row) => ({ row, next: (row.routine && nextOccurrenceKey(row.routine, today)) || '9999-12-31' }))
      .sort((a, b) => (a.next === b.next ? a.row.createdAt - b.row.createdAt : a.next < b.next ? -1 : 1))
      .map((entry) => entry.row)
  })

// To-dos pinned to a place — the dots on the Map screen. Newest first.
export const useLocatedTodos = () =>
  useLiveQuery(() =>
    db.todos
      .orderBy('createdAt')
      .reverse()
      .toArray()
      .then((rows) =>
        rows.filter((t) => t.place && Number.isFinite(t.place.lat) && Number.isFinite(t.place.lng)),
      ),
  )

export const useTodoGroups = () => useLiveQuery(() => db.todoGroups.orderBy('order').toArray())

export const useSealedNotes = () =>
  useLiveQuery(() => db.sealedNotes.orderBy('unlockAt').toArray())

// "Thinking of you" ping history, newest first (a sent + received thread).
export const useThinkingPings = () =>
  useLiveQuery(() => db.thinkingPings.orderBy('createdAt').reverse().toArray())

export const useTodayMood = () => useLiveQuery(() => db.dailyMoodChecks.get(todayIso()))

export const useSecrets = () => useLiveQuery(() => db.secrets.orderBy('createdAt').reverse().toArray())
export const useMoodHistory = (days = 14) =>
  useLiveQuery(() => db.dailyMoodChecks.orderBy('id').reverse().limit(days).toArray(), [days])

// Routines that come around today, each with its own tick. Powers the Home summary.
export interface RoutineToday {
  todo: Todo
  dayKey: string
  at: number
  done: boolean
}

export const useRoutinesToday = () =>
  useLiveQuery<RoutineToday[]>(async () => {
    const today = todayIso()
    const todos = await db.todos.toArray()
    return todos
      .filter((t) => !t.done && t.routine && occursOn(t.routine, today) && withinLimits(t.routine, today))
      .map((t) => ({
        todo: t,
        dayKey: today,
        at: localOccurrenceInstant(today, t.routine?.time),
        done: isOccurrenceDone(t, today),
      }))
      .sort((a, b) => a.at - b.at)
  })

// ── Calendar ──────────────────────────────────────────────────────────────────
export type CalendarEventType = 'todo' | 'capsule' | 'routine'

export interface CalendarEvent {
  id: string // unique per row: a routine repeats, so its day is part of the id
  sourceId: string // the underlying record's id
  type: CalendarEventType
  at: number // epoch ms
  title: string
  subtitle?: string
  done?: boolean
  allDay?: boolean // a routine with no time of day
  occurrenceKey?: string // routine only: which day's tick this row stands for
  route: string // where tapping it navigates
}

/**
 * Date-bearing things across the app, flattened into one timeline for the calendar: to-dos with a
 * reminder, time capsules, and every occurrence of a routine inside `[fromKey, toKey]`. Routines
 * are expanded on read and bounded by that window, so a repeating activity lands on all of its days
 * without ever storing a row per day. The recurring anniversary is handled in the Calendar screen.
 */
/**
 * Everything the calendar can draw, fetched once.
 *
 * Deliberately takes NO window. It used to, which meant stepping a month changed the query's
 * arguments and re-ran the whole thing: a fresh read of every to-do out of IndexedDB and a fresh
 * Dexie subscription, just to look at days that were mostly already expanded. Now the fetch re-runs
 * only when the data actually changes, and moving around the calendar is pure work over what is
 * already in memory (see `calendarEventsIn`).
 */
export const useCalendarSources = () =>
  useLiveQuery(async () => {
    const [todos, capsules] = await Promise.all([db.todos.toArray(), db.sealedNotes.toArray()])
    return { todos, capsules }
  }, [])

/**
 * The events falling in `[fromKey, toKey]`. Pure, so a caller can memoize it against the window it
 * is actually showing rather than paying for a database round trip per month.
 *
 * Only routines are windowed: they are expanded per day, so the range decides how much work this is.
 * A dated to-do and a capsule are single points already, so they are cheap to hand over whole.
 */
export function calendarEventsIn(
  sources: { todos: Todo[]; capsules: SealedNote[] } | undefined,
  fromKey: string,
  toKey: string,
): CalendarEvent[] {
  if (!sources) return []
  const events: CalendarEvent[] = []
  for (const t of sources.todos) {
    if (t.routine) {
      for (const day of occurrenceKeys(t.routine, fromKey, toKey)) {
        events.push({
          id: `${t.id}#${day}`,
          sourceId: t.id,
          type: 'routine',
          at: localOccurrenceInstant(day, t.routine.time),
          title: t.title,
          subtitle: t.note,
          done: isOccurrenceDone(t, day),
          allDay: !t.routine.time,
          occurrenceKey: day,
          route: '/routines',
        })
      }
      continue
    }
    if (!t.dueAt) continue
    events.push({
      id: t.id,
      sourceId: t.id,
      type: 'todo',
      at: t.dueAt,
      title: t.title,
      subtitle: t.note,
      done: t.done,
      route: '/todos',
    })
  }
  for (const c of sources.capsules) {
    events.push({
      id: c.id,
      sourceId: c.id,
      type: 'capsule',
      at: c.unlockAt,
      title: c.title || 'Time capsule',
      route: '/capsule',
    })
  }
  return events
}
