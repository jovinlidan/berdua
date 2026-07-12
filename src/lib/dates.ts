import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isTomorrow, parseISO } from 'date-fns'
import { activeDateLocale, tNow } from './i18n'

// All formatting passes the active date-fns locale, so months/weekdays render in the chosen language.
const loc = () => ({ locale: activeDateLocale() })

export function daysTogether(anniversaryISO: string | null): number | null {
  if (!anniversaryISO) return null
  // parseISO reads a date-only string as LOCAL midnight (new Date() would read it as UTC,
  // which shifts the calendar day by one in negative-UTC timezones).
  const start = parseISO(anniversaryISO)
  if (Number.isNaN(start.getTime())) return null
  return Math.max(0, differenceInCalendarDays(new Date(), start))
}

/** Today's local date as ISO yyyy-mm-dd — used as the natural key for daily records. */
export const todayIso = () => format(new Date(), 'yyyy-MM-dd')

/** Compact "2h ago" / "3d ago" for chat-style timestamps, in the active locale. */
export const relativeTime = (ms: number) => formatDistanceToNowStrict(new Date(ms), { addSuffix: true, ...loc() })

export const formatDay = (ms: number) => format(new Date(ms), 'EEE, MMM d', loc())
export const formatDayLong = (ms: number) => format(new Date(ms), 'EEEE, MMMM d, yyyy', loc())
export const formatTime = (ms: number) => format(new Date(ms), 'h:mm a', loc())

/** Friendly "when" label for upcoming dates. */
export function whenLabel(ms: number): string {
  const d = new Date(ms)
  if (isToday(d)) return `${tNow('Today')} · ${format(d, 'h:mm a', loc())}`
  if (isTomorrow(d)) return `${tNow('Tomorrow')} · ${format(d, 'h:mm a', loc())}`
  return format(d, 'EEE, MMM d · h:mm a', loc())
}

/** Short relative countdown: "Today" / "Tomorrow" / "in 3 days". */
export function countdownLabel(ms: number): string {
  const days = differenceInCalendarDays(new Date(ms), new Date())
  if (days <= 0) return tNow('Today')
  if (days === 1) return tNow('Tomorrow')
  return tNow('in {n} days', { n: days })
}

/** value for <input type="datetime-local">, in the user's local time */
export function toDatetimeLocal(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
