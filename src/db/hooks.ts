// Reactive reads. dexie-react-hooks re-renders components automatically whenever the
// underlying IndexedDB rows change — no manual cache invalidation needed.
import { useLiveQuery } from 'dexie-react-hooks'
import { todayIso } from '../lib/dates'
import {
  addDaysKey,
  isOccurrenceDone,
  localTzOffset,
  occurrenceInstant,
  occurrenceKeys,
  occursOn,
  withinLimits,
} from '../lib/recurrence'
import type { Todo } from '../types'
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

// Routines that come around today, each with its own tick — powers the Home summary.
export interface RoutineToday {
  todo: Todo
  dayKey: string
  at: number
  done: boolean
}

export const useRoutinesToday = () =>
  useLiveQuery<RoutineToday[]>(async () => {
    const today = todayIso()
    const tz = localTzOffset()
    const todos = await db.todos.toArray()
    return todos
      .filter((t) => !t.done && t.routine && occursOn(t.routine, today) && withinLimits(t.routine, today))
      .map((t) => ({
        todo: t,
        dayKey: today,
        at: occurrenceInstant(today, t.routine?.time, tz),
        done: isOccurrenceDone(t, today),
      }))
      .sort((a, b) => a.at - b.at)
  })

// ── Calendar ──────────────────────────────────────────────────────────────────
export type CalendarEventType = 'todo' | 'capsule' | 'routine'

export interface CalendarEvent {
  id: string // unique per row — a routine repeats, so its day is part of the id
  sourceId: string // the underlying record's id
  type: CalendarEventType
  at: number // epoch ms
  title: string
  subtitle?: string
  done?: boolean
  allDay?: boolean // a routine with no time of day
  occurrenceKey?: string // routine only — which day's tick this row stands for
  route: string // where tapping it navigates
}

/**
 * Date-bearing things across the app, flattened into one timeline for the calendar: to-dos with a
 * reminder, time capsules, and every occurrence of a routine inside `[fromKey, toKey]`. Routines
 * are expanded on read and bounded by that window, so a repeating activity lands on all of its days
 * without ever storing a row per day. The recurring anniversary is handled in the Calendar screen.
 */
export const useCalendarEvents = (fromKey?: string, toKey?: string) =>
  useLiveQuery<CalendarEvent[]>(async () => {
    const today = todayIso()
    const from = fromKey ?? addDaysKey(today, -62)
    const to = toKey ?? addDaysKey(today, 366)
    const tz = localTzOffset()
    const [todos, capsules] = await Promise.all([db.todos.toArray(), db.sealedNotes.toArray()])
    const events: CalendarEvent[] = []
    for (const t of todos) {
      if (t.routine) {
        for (const day of occurrenceKeys(t.routine, from, to)) {
          events.push({
            id: `${t.id}#${day}`,
            sourceId: t.id,
            type: 'routine',
            at: occurrenceInstant(day, t.routine.time, tz),
            title: t.title,
            subtitle: t.note,
            done: isOccurrenceDone(t, day),
            allDay: !t.routine.time,
            occurrenceKey: day,
            route: '/todos',
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
    for (const c of capsules) {
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
  }, [fromKey, toKey])
