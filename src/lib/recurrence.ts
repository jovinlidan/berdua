// Routines: the pure rules behind "this activity repeats, over many days".
//
// Everything here is dependency-free and reasons in plain ISO day keys ('yyyy-mm-dd') plus an
// EXPLICIT timezone offset, never the ambient one. That's deliberate: the same rules have to
// produce the same occurrences in three runtimes that can't share a clock: the two phones' UIs,
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
/** Short label key per frequency, for places too narrow for the full rule. */
export const ROUTINE_FREQ_LABELS: Record<RoutineFreq, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}
/** 0=Sun to 6=Sat. These English abbreviations double as the i18n keys. */
export const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** Full names, for summaries of one or two days ("Every Tuesday and Thursday"). */
export const WEEKDAY_FULL_KEYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
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

/** This device's offset in minutes east of UTC, the same convention as `Couple.tzOffsetMinutes`. */
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

/** 0=Sun to 6=Sat for a day key (timezone-free, since the key already names the day). */
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

/**
 * The instant an occurrence happens on THIS device, using the offset actually in force on that
 * date. `occurrenceInstant` takes a fixed offset because the cron only has the couple's stored one;
 * on the client that snapshot would drift a whole hour (and sometimes a whole day) across a DST
 * boundary, so anything rendered locally goes through here instead.
 */
export function localOccurrenceInstant(key: DayKey, time?: string): number {
  const p = parseKey(key)
  if (!p) return NaN
  const minutes = parseTime(time) ?? 0
  return new Date(p.y, p.m - 1, p.d, Math.floor(minutes / 60), minutes % 60).getTime()
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
    extraDates: sanitizeExtraDates(routine.extraDates),
  }
}

/** Valid, deduped, sorted day keys, or undefined when there are none. */
function sanitizeExtraDates(dates: string[] | undefined): string[] | undefined {
  if (!dates?.length) return undefined
  const clean = [...new Set(dates.filter(isDayKey))].sort()
  return clean.length ? clean : undefined
}

/**
 * Both phones' added days, unioned.
 *
 * The rule itself is last-write-wins like any other edit, but this list is not an edit: it is two
 * people each appending days. Under LWW, Alex adding Thursday and Bea adding Saturday while both are
 * offline would lose one of them, the same trap `mergeRoutineLogs` exists for.
 *
 * A union means a REMOVAL cannot propagate: nothing removes an added day today (the calendar only
 * ever appends, idempotently), so if that ever changes this needs per-day tombstones like the ticks.
 */
export function mergeExtraDates(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
  if (!a?.length) return sanitizeExtraDates(b)
  if (!b?.length) return sanitizeExtraDates(a)
  return sanitizeExtraDates([...a, ...b])
}

/** The one-off days a routine also happens on, already sanitised. */
export const routineExtraDates = (routine: Routine): string[] => sanitizeExtraDates(routine.extraDates) ?? []

/** Which weekdays a weekly routine lands on (falls back to the start day's own weekday). */
export const routineWeekdays = (routine: Routine): number[] =>
  routine.weekdays?.length ? [...routine.weekdays].sort((a, b) => a - b) : [weekdayOf(routine.startDate)]

const weekIndex = (key: DayKey) => Math.floor(daysBetween(SUNDAY_EPOCH, key) / 7)

/**
 * The last day a paused routine still counts, or null when it is running.
 *
 * A pause with no `pausedAt` (only reachable from a record written by an older build) falls back to
 * hiding everything, which is the safer reading of "switched off" than silently staying on.
 */
function pauseStop(routine: Routine): DayKey | null {
  if (!routine.paused) return null
  return routine.pausedAt && isDayKey(routine.pausedAt) ? addDaysKey(routine.pausedAt, -1) : ''
}

/** Is `key` on or after the day this routine was switched off? */
function pausedFrom(routine: Routine, key: DayKey): boolean {
  const stop = pauseStop(routine)
  return stop !== null && key > stop
}

/** The rule test itself, on an already-normalized routine (hot path, no re-normalizing). */
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

/**
 * 1-based position of `key` in the series, or null when the rule doesn't land on it. Arithmetic on
 * purpose: resolving a `count` limit by walking from the start date used to break for series longer
 * than the scan window, which silently dropped a routine out of "today" and off Home.
 */
export function occurrenceOrdinal(routine: Routine, key: DayKey): number | null {
  const r = normalizeRoutine(routine)
  if (!isDayKey(key) || !isDayKey(r.startDate) || !hits(r, key)) return null
  switch (r.freq) {
    case 'daily':
      return Math.floor(daysBetween(r.startDate, key) / r.interval) + 1
    case 'weekly': {
      const days = routineWeekdays(r)
      const startWeekday = weekdayOf(r.startDate)
      // The first week is partial: only the chosen days at or after the start weekday happen.
      const firstWeek = days.filter((d) => d >= startWeekday)
      const cycles = Math.floor((weekIndex(key) - weekIndex(r.startDate)) / r.interval)
      if (cycles === 0) return firstWeek.indexOf(weekdayOf(key)) + 1
      return firstWeek.length + (cycles - 1) * days.length + days.indexOf(weekdayOf(key)) + 1
    }
    case 'monthly':
      return Math.floor(monthsBetween(r.startDate, key) / r.interval) + 1
  }
}

/** Does the rule land on that day? (ignores `until`/`count`; see `occurrenceKeys` for those) */
export function occursOn(routine: Routine, key: DayKey): boolean {
  if (pausedFrom(routine, key)) return false
  const r = normalizeRoutine(routine)
  if (!isDayKey(key)) return false
  // an explicitly added day happens even where the rule does not reach
  if (routineExtraDates(r).includes(key)) return true
  if (!isDayKey(r.startDate)) return false
  return hits(r, key)
}

/**
 * Every occurrence day inside `[fromKey, toKey]` (inclusive), honouring `until` and `count`.
 * Always bounded: by the window, by `cap`, and by a scan limit, so a corrupt rule can't spin.
 *
 * A paused routine stops at the day it was switched off. This and `occursOn` are the ONLY two
 * places that check `paused`,
 * because everything that asks "is it happening" goes through one of them: the calendar and the
 * cron's push window expand with `occurrenceKeys`, `nextOccurrenceKey` is built on it, and today's
 * list on Home and the Routines screen ask `occursOn`. Deliberately NOT gated in `hits`,
 * `occurrenceOrdinal`, `occurrenceTotal`, `routineProgress` or `routineStreak`: those report what a
 * routine HAS done, and a pause must not erase history or reset a streak.
 */
export function occurrenceKeys(
  routine: Routine,
  fromKey: DayKey,
  toKey: DayKey,
  cap = MAX_OCCURRENCES,
): DayKey[] {
  const r = normalizeRoutine(routine)
  if (!isDayKey(r.startDate) || !isDayKey(fromKey) || !isDayKey(toKey) || toKey < fromKey) return []
  // A pause ends the series like a stricter `until`, so the days before it keep their place.
  const stop = pauseStop(r)
  if (stop !== null && stop < fromKey) return []
  let end = r.until && r.until < toKey ? r.until : toKey
  if (stop !== null && stop < end) end = stop
  if (end < r.startDate) return []

  const limit = r.count ?? null
  let key = fromKey < r.startDate ? r.startDate : fromKey
  const out: DayKey[] = []
  for (let i = 0; i <= SCAN_LIMIT_DAYS && key <= end && out.length < cap; i++) {
    if (hits(r, key)) {
      // Ordinals rise monotonically, so the first one past the limit ends the series.
      if (limit !== null && (occurrenceOrdinal(r, key) ?? Infinity) > limit) break
      out.push(key)
    }
    key = addDaysKey(key, 1)
  }

  // Days added by hand sit outside the counted series, so they are merged in here rather than being
  // walked with the rule: they ignore `until` and `count` (a person named the day) but not the pause,
  // and `toKey` still bounds them because the caller only asked about this window.
  const extras = routineExtraDates(r).filter(
    (d) => d >= fromKey && d <= toKey && !(stop !== null && d > stop) && !out.includes(d),
  )
  if (!extras.length) return out
  return [...out, ...extras].sort().slice(0, cap)
}

/** The first occurrence on or after `fromKey`, or null when the routine has run out. */
export function nextOccurrenceKey(routine: Routine, fromKey: DayKey): DayKey | null {
  return occurrenceKeys(routine, fromKey, addDaysKey(fromKey, 366 * 3), 1)[0] ?? null
}

/**
 * How many occurrences the routine plans in total. Null when it's open-ended. The `until` case is
 * counted by the LAST occurrence's ordinal, not by collecting them: collecting stopped at the
 * expansion cap, so a two-year daily routine used to report 400 instead of 730.
 */
export function occurrenceTotal(routine: Routine): number | null {
  const r = normalizeRoutine(routine)
  // Added days are extra planned days, so a finite plan grows by however many are not already part
  // of the series. Without this, ticking one could report more done than the total.
  const extra = routineExtraDates(r).filter((d) => !inCountedSeries(r, d)).length
  if (r.count) return r.count + extra
  if (!r.until || r.until < r.startDate) return r.until ? extra : null
  // Any legal rule repeats at least once a year, so the last occurrence is within 366 days of the
  // end; walking back from there is bounded no matter how long the series is.
  for (let key = r.until, i = 0; i <= 366 && key >= r.startDate; i++, key = addDaysKey(key, -1)) {
    const ordinal = occurrenceOrdinal(r, key)
    if (ordinal !== null) return ordinal + extra
  }
  return extra
}

// ── Per-occurrence ticks ───────────────────────────────────────────────────────
type RoutineTodo = Pick<Todo, 'routine' | 'routineLog'>

export const isOccurrenceDone = (todo: RoutineTodo, key: DayKey | null): boolean =>
  !!key && todo.routineLog?.[key]?.done === true

/** Flip (or set) one occurrence, returning a NEW log; the stored one is never mutated. */
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
 * DIFFERENT days offline and keep both. Whole-record last-write-wins would drop one of them.
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
/**
 * Is `key` an occurrence of the RULE itself, honouring `startDate`, `until` and `count`?
 *
 * Deliberately blind to the added-days list, so it can answer "was this day already covered" for
 * the two callers that need to know: `withinLimits`, which then also accepts an added day, and
 * `occurrenceTotal`, which counts how many added days are genuinely extra. Asking `hits` instead is
 * wrong, because a daily rule's arithmetic lands on every day including ones past its `count`.
 */
function inCountedSeries(r: Routine, key: DayKey): boolean {
  if (!isDayKey(r.startDate) || key < r.startDate) return false
  if (r.until && key > r.until) return false
  if (!hits(r, key)) return false
  if (!r.count) return true
  const ordinal = occurrenceOrdinal(r, key)
  return ordinal !== null && ordinal <= r.count
}

export function withinLimits(routine: Routine, key: DayKey): boolean {
  const r = normalizeRoutine(routine)
  // an added day is always "within": it was named explicitly, so a tick on it must count
  if (routineExtraDates(r).includes(key)) return true
  return inCountedSeries(r, key)
}

/** Ticked-off occurrences against the plan. `total` is null for an open-ended routine. */
export function routineProgress(todo: RoutineTodo): { done: number; total: number | null } {
  if (!todo.routine) return { done: 0, total: null }
  const r = normalizeRoutine(todo.routine)
  // Only ticks on days the rule still covers count, so lowering `count` or `until` after ticking
  // can never report more done than planned.
  const done = Object.entries(todo.routineLog ?? {}).filter(([key, tick]) => tick.done && withinLimits(r, key)).length
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
    case 'weekly': {
      const picked = routineWeekdays(r)
      // Every weekday selected is just "every day"; one or two read better spelled out; three or
      // more would run too long, so those fall back to the short forms.
      if (picked.length === 7) {
        base = r.interval === 1 ? t('Every day') : t('Every {n} weeks', { n: r.interval })
        break
      }
      const named =
        picked.length === 1
          ? t(WEEKDAY_FULL_KEYS[picked[0]])
          : picked.length === 2
            ? t('{a} and {b}', {
                a: t(WEEKDAY_FULL_KEYS[picked[0]]),
                b: t(WEEKDAY_FULL_KEYS[picked[1]]),
              })
            : days()
      base =
        r.interval === 1
          ? t('Every {days}', { days: named })
          : t('Every {n} weeks on {days}', { n: r.interval, days: named })
      break
    }
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
export function toRRule(routine: Routine, opts: { dateOnlyUntil?: boolean } = {}): string {
  const r = normalizeRoutine(routine)
  const parts = [`FREQ=${r.freq.toUpperCase()}`]
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`)
  if (r.freq === 'weekly') parts.push(`BYDAY=${routineWeekdays(r).map((d) => ICS_WEEKDAYS[d]).join(',')}`)
  if (r.freq === 'monthly') {
    const day = parseKey(r.startDate)?.d ?? 1
    // Past the 28th the app clamps to the last day of a short month, which plain BYMONTHDAY cannot
    // express: "day, or the last one if the month is shorter" is BYMONTHDAY=<d>,-1 + BYSETPOS=1.
    parts.push(day >= 29 ? `BYMONTHDAY=${day},-1;BYSETPOS=1` : `BYMONTHDAY=${day}`)
  }
  if (r.count) parts.push(`COUNT=${r.count}`)
  // RFC 5545 §3.3.10: UNTIL must carry the same value type as DTSTART, so an all-day series gets a
  // bare DATE while a timed one gets a UTC DATE-TIME at end of day (keeping the last day inclusive).
  else if (r.until) {
    const day = r.until.replace(/-/g, '')
    parts.push(`UNTIL=${opts.dateOnlyUntil ? day : `${day}T235959Z`}`)
  }
  return parts.join(';')
}
