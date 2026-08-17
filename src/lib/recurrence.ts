// Routines — the pure rules behind "this activity repeats, over many days".
//
// Everything here is dependency-free and reasons in plain ISO day keys ('yyyy-mm-dd') plus an
// EXPLICIT timezone offset, never the ambient one. That's deliberate: the same rules have to
// produce the same occurrences in three runtimes that can't share a clock — the two phones' UIs,
// the sync merge, and the Vercel cron (which knows nothing about the couple's local time beyond
// `couple.tzOffsetMinutes`). Occurrences are always derived, never materialised into rows, so a
// routine stays one synced Todo record no matter how many days it spans.
//
// Like the rest of the app (see api/_lib/reminders.ts), a single stored tz offset is the accepted
// simplification: a routine crossing a DST boundary can land an hour off until the offset resyncs.
import type { PartnerKey, Routine, RoutineFreq, RoutineLog, Todo } from '../types'

/** An ISO `yyyy-mm-dd` day, the unit every routine rule is expressed in. */
export type DayKey = string

/** Hard ceilings so expansion is ALWAYS bounded, whatever a stored rule claims. */
export const MAX_OCCURRENCES = 400
const SCAN_LIMIT_DAYS = 366 * 6

export const ROUTINE_FREQS: RoutineFreq[] = ['daily', 'weekly', 'monthly']
/** 0=Sun … 6=Sat. These English abbreviations double as the i18n keys. */
export const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const ICS_WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

const SUNDAY_EPOCH = '1970-01-04' // 1 Jan 1970 was a Thursday; the 4th is the first Sunday
const pad2 = (n: number) => String(n).padStart(2, '0')

interface Ymd {
  y: number
  m: number // 1-based
  d: number
}

/** Days in a 1-based month (day 0 of the next month == the last day of this one). */
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate()

function parseKey(key: string | undefined): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key ?? '')
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

// ISO day keys sort lexicographically, so plain `<`/`>` comparisons below ARE calendar order.
export const isDayKey = (key: string | undefined): boolean => parseKey(key) !== null

const utcOf = (p: Ymd) => Date.UTC(p.y, p.m - 1, p.d)
const keyOfUtc = (ms: number): DayKey => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** This device's offset in minutes east of UTC — the same convention as `Couple.tzOffsetMinutes`. */
export const localTzOffset = (): number => -new Date().getTimezoneOffset()

/** epoch ms → the ISO day it falls on in a given timezone. */
export function dayKeyOf(ms: number, tzOffsetMinutes: number = localTzOffset()): DayKey {
  return keyOfUtc(ms + tzOffsetMinutes * 60_000)
}

export function addDaysKey(key: DayKey, n: number): DayKey {
  const p = parseKey(key)
  if (!p) return key
  return keyOfUtc(utcOf(p) + n * 86_400_000)
}

/** Whole calendar days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: DayKey, b: DayKey): number {
  const pa = parseKey(a)
  const pb = parseKey(b)
  if (!pa || !pb) return 0
  return Math.round((utcOf(pb) - utcOf(pa)) / 86_400_000)
}

/** 0=Sun … 6=Sat for a day key (timezone-free — the key already names the day). */
export function weekdayOf(key: DayKey): number {
  const p = parseKey(key)
  if (!p) return 0
  return new Date(utcOf(p)).getUTCDay()
}

/** Whole months from `a` to `b`, ignoring the day of month. */
export function monthsBetween(a: DayKey, b: DayKey): number {
  const pa = parseKey(a)
  const pb = parseKey(b)
  if (!pa || !pb) return 0
  return (pb.y - pa.y) * 12 + (pb.m - pa.m)
}

/** Add months, clamping to the shorter month (31 Jan + 1 month → 28/29 Feb). */
export function addMonthsKey(key: DayKey, n: number): DayKey {
  const p = parseKey(key)
  if (!p) return key
  const total = p.y * 12 + (p.m - 1) + n
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${y}-${pad2(m)}-${pad2(Math.min(p.d, daysInMonth(y, m)))}`
}

/** 'HH:mm' → minutes after local midnight, or null when absent/invalid. */
export function parseTime(time?: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? '')
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** The absolute instant an occurrence happens: its local wall-clock time in the given timezone. */
export function occurrenceInstant(key: DayKey, time: string | undefined, tzOffsetMinutes: number): number {
  const p = parseKey(key)
  if (!p) return NaN
  const minutes = parseTime(time) ?? 0 // all-day → local midnight
  return utcOf(p) + (minutes - tzOffsetMinutes) * 60_000
}

/** Fill in the defaults a stored rule may leave implicit, and clamp anything nonsensical. */
export function normalizeRoutine(routine: Routine): Routine {
  const freq: RoutineFreq = ROUTINE_FREQS.includes(routine.freq) ? routine.freq : 'daily'
  const interval = Math.max(1, Math.min(365, Math.floor(routine.interval) || 1))
  const weekdays = [...new Set((routine.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  )
  return {
    ...routine,
    freq,
    interval,
    weekdays: weekdays.length ? weekdays : undefined,
    time: parseTime(routine.time) === null ? undefined : routine.time,
    until: routine.until && isDayKey(routine.until) ? routine.until : null,
    // Clamped to what expansion can enumerate, so `occurrenceTotal` can never promise more
    // occurrences than `occurrenceKeys` will ever hand back.
    count: routine.count && routine.count > 0 ? Math.min(MAX_OCCURRENCES, Math.floor(routine.count)) : null,
  }
}

/** Which weekdays a weekly routine lands on (falls back to the start day's own weekday). */
export const routineWeekdays = (routine: Routine): number[] =>
  routine.weekdays?.length ? [...routine.weekdays].sort((a, b) => a - b) : [weekdayOf(routine.startDate)]

const weekIndex = (key: DayKey) => Math.floor(daysBetween(SUNDAY_EPOCH, key) / 7)

/** The rule test itself, on an already-normalized routine (hot path — no re-normalizing). */
function hits(routine: Routine, key: DayKey): boolean {
  if (key < routine.startDate) return false
  switch (routine.freq) {
    case 'daily':
      return daysBetween(routine.startDate, key) % routine.interval === 0
    case 'weekly': {
      if (!routineWeekdays(routine).includes(weekdayOf(key))) return false
      return (weekIndex(key) - weekIndex(routine.startDate)) % routine.interval === 0
    }
    case 'monthly': {
      const start = parseKey(routine.startDate)
      const p = parseKey(key)
      if (!start || !p) return false
      if (monthsBetween(routine.startDate, key) % routine.interval !== 0) return false
      // Clamp to short months, so "monthly on the 31st" still happens in February.
      return p.d === Math.min(start.d, daysInMonth(p.y, p.m))
    }
  }
}

/** Does the rule land on that day? (ignores `until`/`count` — see `occurrenceKeys` for those) */
export function occursOn(routine: Routine, key: DayKey): boolean {
  const r = normalizeRoutine(routine)
  if (!isDayKey(key) || !isDayKey(r.startDate)) return false
  return hits(r, key)
}

/**
 * Every occurrence day inside `[fromKey, toKey]` (inclusive), honouring `until` and `count`.
 * Always bounded: by the window, by `cap`, and by a scan limit, so a corrupt rule can't spin.
 */
export function occurrenceKeys(
  routine: Routine,
  fromKey: DayKey,
  toKey: DayKey,
  cap = MAX_OCCURRENCES,
): DayKey[] {
  const r = normalizeRoutine(routine)
  if (!isDayKey(r.startDate) || !isDayKey(fromKey) || !isDayKey(toKey) || toKey < fromKey) return []
  const end = r.until && r.until < toKey ? r.until : toKey
  if (end < r.startDate) return []

  // A `count` limit is an ORDINAL rule, so it can only be resolved by walking from the very first
  // occurrence. Without one we start the walk at the window and stay cheap.
  const limit = r.count ?? null
  let key = limit !== null || fromKey < r.startDate ? r.startDate : fromKey
  const out: DayKey[] = []
  let seen = 0
  for (let i = 0; i <= SCAN_LIMIT_DAYS && key <= end && out.length < cap; i++) {
    if (hits(r, key)) {
      seen++
      if (key >= fromKey) out.push(key)
      if (limit && seen >= limit) break
    }
    key = addDaysKey(key, 1)
  }
  return out
}

/** The first occurrence on or after `fromKey`, or null when the routine has run out. */
export function nextOccurrenceKey(routine: Routine, fromKey: DayKey): DayKey | null {
  return occurrenceKeys(routine, fromKey, addDaysKey(fromKey, 366 * 3), 1)[0] ?? null
}

/** The last occurrence on or before `toKey`, searching back `withinDays`. */
export function lastOccurrenceKey(routine: Routine, toKey: DayKey, withinDays = 45): DayKey | null {
  const keys = occurrenceKeys(routine, addDaysKey(toKey, -withinDays), toKey)
  return keys.length ? keys[keys.length - 1] : null
}

/** How many occurrences the routine plans in total — null when it's open-ended. */
export function occurrenceTotal(routine: Routine): number | null {
  const r = normalizeRoutine(routine)
  if (r.count) return r.count
  if (!r.until) return null
  return occurrenceKeys(r, r.startDate, r.until).length
}

// ── Per-occurrence ticks ───────────────────────────────────────────────────────
type RoutineTodo = Pick<Todo, 'routine' | 'routineLog'>

export const isOccurrenceDone = (todo: RoutineTodo, key: DayKey | null): boolean =>
  !!key && todo.routineLog?.[key]?.done === true

/** Flip (or set) one occurrence, returning a NEW log — the stored one is never mutated. */
export function toggleTickIn(
  log: RoutineLog | undefined,
  key: DayKey,
  by: PartnerKey,
  at: number,
  done?: boolean,
): RoutineLog {
  const next: RoutineLog = { ...(log ?? {}) }
  next[key] = { done: done ?? !(next[key]?.done ?? false), at, by }
  return next
}

/**
 * Union two logs per occurrence day, newest tick winning. This is what lets both phones tick
 * DIFFERENT days offline and keep both — whole-record last-write-wins would drop one of them.
 * Exact-millisecond ties resolve to `done` so the merge stays order-independent.
 */
export function mergeRoutineLogs(a?: RoutineLog, b?: RoutineLog): RoutineLog | undefined {
  if (!a) return b
  if (!b) return a
  const out: RoutineLog = { ...a }
  for (const [key, tick] of Object.entries(b)) {
    const mine = out[key]
    if (!mine || tick.at > mine.at || (tick.at === mine.at && tick.done && !mine.done)) out[key] = tick
  }
  return out
}

/** Cheap structural equality, so a pull only writes when the merged log actually changed. */
export function sameRoutineLog(a?: RoutineLog, b?: RoutineLog): boolean {
  const ka = Object.keys(a ?? {})
  const kb = Object.keys(b ?? {})
  if (ka.length !== kb.length) return false
  return ka.every((k) => a?.[k]?.done === b?.[k]?.done && a?.[k]?.at === b?.[k]?.at)
}

/**
 * The occurrence a single tap acts on: today when it's a routine day, else the most recent one in
 * the last week (so yesterday's missed check-in is still reachable), else the next one up.
 */
export function routineActiveKey(routine: Routine, todayKey: DayKey): DayKey | null {
  if (occursOn(routine, todayKey) && withinLimits(routine, todayKey)) return todayKey
  const recent = occurrenceKeys(routine, addDaysKey(todayKey, -7), addDaysKey(todayKey, -1))
  if (recent.length) return recent[recent.length - 1]
  return nextOccurrenceKey(routine, todayKey)
}

/** Is that day inside the routine's own start/until/count bounds? */
export function withinLimits(routine: Routine, key: DayKey): boolean {
  const r = normalizeRoutine(routine)
  if (key < r.startDate) return false
  if (r.until && key > r.until) return false
  if (!r.count) return true
  return occurrenceKeys(r, r.startDate, key).includes(key)
}

/** Ticked-off occurrences against the plan. `total` is null for an open-ended routine. */
export function routineProgress(todo: RoutineTodo): { done: number; total: number | null } {
  if (!todo.routine) return { done: 0, total: null }
  const r = normalizeRoutine(todo.routine)
  const done = Object.entries(todo.routineLog ?? {}).filter(
    ([key, tick]) => tick.done && hits(r, key) && (!r.until || key <= r.until),
  ).length
  return { done, total: occurrenceTotal(r) }
}

/**
 * Consecutive done occurrences ending at the latest past one. Today's occurrence is exempt while
 * it's still open, so the streak doesn't visibly break before the day is over.
 */
export function routineStreak(todo: RoutineTodo, todayKey: DayKey): number {
  if (!todo.routine || !todo.routineLog) return 0
  const keys = occurrenceKeys(todo.routine, addDaysKey(todayKey, -366), todayKey)
  if (keys.length && keys[keys.length - 1] === todayKey && !isOccurrenceDone(todo, todayKey)) keys.pop()
  let streak = 0
  for (let i = keys.length - 1; i >= 0; i--) {
    if (!isOccurrenceDone(todo, keys[i])) break
    streak++
  }
  return streak
}

/** True when this row is "done for now": its current occurrence for a routine, `done` otherwise. */
export function isTodoDoneNow(todo: Pick<Todo, 'done' | 'routine' | 'routineLog'>, todayKey: DayKey): boolean {
  if (todo.done) return true
  if (!todo.routine) return false
  return isOccurrenceDone(todo, routineActiveKey(todo.routine, todayKey))
}

// ── Labels + calendar export ───────────────────────────────────────────────────
type Translate = (key: string, params?: Record<string, string | number>) => string
const interpolate: Translate = (key, params) =>
  params ? Object.keys(params).reduce((s, k) => s.split(`{${k}}`).join(String(params[k])), key) : key

/**
 * "Every day", "Every Mon, Wed · 07:00", "Every 2 months on day 14". Takes a translator so the
 * module itself stays i18n-free (the English strings below are the dictionary keys).
 */
export function routineSummary(routine: Routine, t: Translate = interpolate): string {
  const r = normalizeRoutine(routine)
  const days = () => routineWeekdays(r).map((d) => t(WEEKDAY_KEYS[d])).join(', ')
  let base: string
  switch (r.freq) {
    case 'daily':
      base = r.interval === 1 ? t('Every day') : t('Every {n} days', { n: r.interval })
      break
    case 'weekly':
      base =
        r.interval === 1
          ? t('Every {days}', { days: days() })
          : t('Every {n} weeks on {days}', { n: r.interval, days: days() })
      break
    case 'monthly': {
      const day = parseKey(r.startDate)?.d ?? 1
      base =
        r.interval === 1
          ? t('Monthly on day {d}', { d: day })
          : t('Every {n} months on day {d}', { n: r.interval, d: day })
      break
    }
  }
  return r.time ? `${base} · ${r.time}` : base
}

/** The RFC 5545 RRULE for a routine, so one .ics repeats in the phone's own calendar app. */
export function toRRule(routine: Routine): string {
  const r = normalizeRoutine(routine)
  const parts = [`FREQ=${r.freq.toUpperCase()}`]
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`)
  if (r.freq === 'weekly') parts.push(`BYDAY=${routineWeekdays(r).map((d) => ICS_WEEKDAYS[d]).join(',')}`)
  if (r.freq === 'monthly') parts.push(`BYMONTHDAY=${parseKey(r.startDate)?.d ?? 1}`)
  if (r.count) parts.push(`COUNT=${r.count}`)
  // UNTIL must be UTC when DTSTART is (RFC 5545 §3.3.10); end-of-day keeps the last day inclusive.
  else if (r.until) parts.push(`UNTIL=${r.until.replace(/-/g, '')}T235959Z`)
  return parts.join(';')
}
