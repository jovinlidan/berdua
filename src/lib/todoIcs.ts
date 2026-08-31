// Bridges a wishlist item to the pure .ics builder, so both phones can drop a routine into their
// own calendar app. Kept out of lib/calendar.ts on purpose: that module must stay free of relative
// imports so scripts/test-ics.mjs can keep running it under plain `node`.
import { type DateIcsInput, downloadDateIcs } from './calendar'
import {
  localTzOffset,
  nextOccurrenceKey,
  normalizeRoutine,
  occurrenceInstant,
  routineExtraDates,
  toRRule,
} from './recurrence'
import type { Todo } from '../types'

/**
 * The .ics payload for a wishlist item: a routine becomes ONE repeating VEVENT anchored on its
 * first real occurrence (RFC 5545 wants DTSTART to match the rule), a dated to-do a single event.
 * Returns null when the item has no date at all, since there is nothing to put in a calendar.
 */
export function todoIcsInput(todo: Todo): DateIcsInput | null {
  const location = todo.place?.name
  const description = todo.note?.trim() || undefined
  if (todo.routine) {
    const routine = normalizeRoutine(todo.routine)
    const first = nextOccurrenceKey(routine, routine.startDate) ?? routine.startDate
    return {
      id: todo.id,
      title: todo.title,
      start: occurrenceInstant(first, routine.time, localTzOffset()),
      durationMin: 60,
      allDay: !routine.time, // a routine with no time of day is an all-day series
      rrule: toRRule(routine, { dateOnlyUntil: !routine.time }),
      rdates: routineExtraDates(routine),
      location,
      description,
      alarmMinutesBefore: 30,
    }
  }
  if (!todo.dueAt) return null
  return { id: todo.id, title: todo.title, start: todo.dueAt, location, description }
}

/** Download a wishlist item as .ics. Returns false when it has no date to export. */
export function downloadTodoIcs(todo: Todo): boolean {
  const input = todoIcsInput(todo)
  if (!input) return false
  downloadDateIcs(input)
  return true
}
