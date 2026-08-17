// Build a standards-compliant .ics file for a planned date so each partner can drop it
// into their own phone calendar — works offline and on both iPhone & Android, and the
// built-in VALARM nudges them even before cloud push reminders are set up.
//
// A routine exports as ONE recurring VEVENT (an RRULE), not one event per day, so the phone's own
// calendar keeps expanding it forever without a re-export. Turning a wishlist item into this input
// lives in lib/todoIcs.ts — this module stays import-free so plain `node` can run it (see
// scripts/test-ics.mjs: type stripping works, extensionless import resolution does not).

export interface DateIcsInput {
  id: string
  title: string
  start: number // epoch ms
  durationMin?: number
  location?: string
  description?: string
  alarmMinutesBefore?: number
  rrule?: string // RFC 5545 RRULE body, e.g. 'FREQ=WEEKLY;BYDAY=MO,WE' → a repeating event
  allDay?: boolean // DATE-valued event (uses the LOCAL calendar day of `start`; no time, no alarm)
  stamp?: number // override DTSTAMP (for deterministic tests)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** epoch ms → UTC "YYYYMMDDTHHMMSSZ" (timezone-independent, the safe iCal form). */
function toIcsUtc(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/** epoch ms → local "YYYYMMDD" — a DATE value carries no time, so the local day is the point. */
function toIcsDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

/** RFC 5545 text escaping. */
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

export function buildDateIcs(input: DateIcsInput): string {
  const { id, title, start, durationMin = 120, location, description, alarmMinutesBefore = 120 } = input
  const timed = !input.allDay
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Berdua//Date//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${id}@berdua`,
    `DTSTAMP:${toIcsUtc(input.stamp ?? Date.now())}`,
    ...(timed
      ? [`DTSTART:${toIcsUtc(start)}`, `DTEND:${toIcsUtc(start + durationMin * 60_000)}`]
      : [`DTSTART;VALUE=DATE:${toIcsDate(start)}`, `DTEND;VALUE=DATE:${toIcsDate(start + 86_400_000)}`]),
    ...(input.rrule ? [`RRULE:${input.rrule}`] : []),
    `SUMMARY:${esc(title)}`,
    ...(location ? [`LOCATION:${esc(location)}`] : []),
    ...(description ? [`DESCRIPTION:${esc(description)}`] : []),
    // An alarm relative to midnight is noise, so all-day events ship without one.
    ...(timed
      ? ['BEGIN:VALARM', `TRIGGER:-PT${alarmMinutesBefore}M`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM']
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

/** Build the .ics and trigger a download (browser only). See lib/todoIcs.ts for wishlist items. */
export function downloadDateIcs(input: DateIcsInput): void {
  const ics = buildDateIcs(input)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${input.title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'date'}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
