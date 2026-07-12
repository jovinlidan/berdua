// Reactive reads. dexie-react-hooks re-renders components automatically whenever the
// underlying IndexedDB rows change — no manual cache invalidation needed.
import { useLiveQuery } from 'dexie-react-hooks'
import { todayIso } from '../lib/dates'
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

// ── Calendar ──────────────────────────────────────────────────────────────────
export type CalendarEventType = 'todo' | 'capsule'

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  at: number // epoch ms
  title: string
  subtitle?: string
  done?: boolean
  route: string // where tapping it navigates
}

/**
 * Date-bearing things across the app, flattened into one timeline for the calendar: to-dos with a
 * reminder and time capsules. The recurring anniversary is handled in the Calendar screen itself.
 */
export const useCalendarEvents = () =>
  useLiveQuery<CalendarEvent[]>(async () => {
    const [todos, capsules] = await Promise.all([db.todos.toArray(), db.sealedNotes.toArray()])
    const events: CalendarEvent[] = []
    for (const t of todos) {
      if (!t.dueAt) continue
      events.push({ id: t.id, type: 'todo', at: t.dueAt, title: t.title, subtitle: t.note, done: t.done, route: '/todos' })
    }
    for (const c of capsules) {
      events.push({ id: c.id, type: 'capsule', at: c.unlockAt, title: c.title || 'Time capsule', route: '/capsule' })
    }
    return events
  })
