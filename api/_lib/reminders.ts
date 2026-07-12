import type { SyncDoc } from '../../src/types.js'

export interface ReminderEvent {
  key: string // dedupe key (stored in remindersSent)
  title: string
  body: string
  url: string
}

const HOUR = 3_600_000
const DAY = 86_400_000

function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end // wraps midnight
}

function weekNumber(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - start) / DAY + 1) / 7)
}

/**
 * Compute which reminders are due right now. Date reminders are tz-independent
 * (relative to the absolute instant); anniversary/weekend/quiet-hours use the
 * couple's stored tz offset so they land in local time.
 */
export function dueReminders(doc: SyncDoc, nowMs: number): ReminderEvent[] {
  const events: ReminderEvent[] = []
  const tz = doc.couple?.tzOffsetMinutes ?? 0
  const local = new Date(nowMs + tz * 60_000) // UTC fields now read as local wall-clock
  const prefs = doc.notifPrefs

  if (prefs && inQuietHours(local.getUTCHours(), prefs.quietHoursStart, prefs.quietHoursEnd)) return []

  // 1) wishlist due reminders (tz-independent — relative to the due instant)
  for (const todo of doc.todos) {
    if (todo.done || !todo.dueAt) continue
    if (nowMs >= todo.dueAt - 30 * 60_000 && nowMs < todo.dueAt + 6 * HOUR) {
      events.push({ key: `todo:${todo.id}:due`, title: 'A little to-do ✅', body: todo.title, url: '/todos' })
    }
  }

  // 1c) time-capsule unlocks
  for (const note of doc.sealedNotes) {
    if (nowMs >= note.unlockAt && nowMs < note.unlockAt + 12 * HOUR) {
      events.push({
        key: `capsule:${note.id}:unlocked`,
        title: 'A time capsule unlocked 💌',
        body: note.title || 'A note from the two of you is ready to open.',
        url: '/capsule',
      })
    }
  }

  // 2) anniversary
  if (prefs?.anniversaryReminder && doc.couple?.anniversaryDate) {
    const start = new Date(`${doc.couple.anniversaryDate}T00:00:00Z`)
    if (
      !Number.isNaN(start.getTime()) &&
      start.getUTCMonth() === local.getUTCMonth() &&
      start.getUTCDate() === local.getUTCDate()
    ) {
      const years = local.getUTCFullYear() - start.getUTCFullYear()
      if (years > 0) {
        events.push({
          key: `anniv:${local.getUTCFullYear()}`,
          title: 'Happy anniversary! 🎉',
          body: `${years} year${years > 1 ? 's' : ''} of the two of you 💞`,
          url: '/',
        })
      }
    }
  }

  // 3) weekend nudge (Friday)
  if (prefs?.weekendNudge && local.getUTCDay() === 5) {
    events.push({
      key: `weekend:${local.getUTCFullYear()}-W${weekNumber(local)}`,
      title: 'Weekend together? 🗓️',
      body: 'Plan something sweet for the two of you this weekend.',
      url: '/',
    })
  }

  return events
}
