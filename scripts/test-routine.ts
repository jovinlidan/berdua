// Unit checks for routines: occurrence expansion, per-day tick merging, the RRULE export, and the
// per-occurrence cron reminders (all pure functions).
// Run: pnpm exec tsx scripts/test-routine.ts
import assert from 'node:assert'
import { emptyDoc, mergeDocs } from '../api/_lib/merge'
import { dueReminders } from '../api/_lib/reminders'
import { buildDateIcs } from '../src/lib/calendar'
import {
  dayKeyOf,
  isOccurrenceDone,
  localOccurrenceInstant,
  occurrenceOrdinal,
  mergeRoutineLogs,
  nextOccurrenceKey,
  occurrenceInstant,
  occurrenceKeys,
  occurrenceTotal,
  occursOn,
  routineActiveKey,
  routineProgress,
  routineStreak,
  routineSummary,
  sameRoutineLog,
  toRRule,
  withinLimits,
} from '../src/lib/recurrence'
import { todoIcsInput } from '../src/lib/todoIcs'
import type { Routine, RoutineLog, SyncDoc, SyncSnapshot, Todo } from '../src/types'

let n = 0
const ok = (label: string) => {
  n++
  console.log(`  ✓ ${label}`)
}

const rule = (over: Partial<Routine> = {}): Routine => ({
  freq: 'daily',
  interval: 1,
  startDate: '2026-06-01', // a Monday
  ...over,
})

const routineTodo = (over: Partial<Todo> = {}): Todo => ({
  id: 'r1',
  title: 'Walk together 🌙',
  category: 'food',
  done: false,
  addedBy: 'A',
  routine: rule(),
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const log = (entries: Record<string, [done: boolean, at: number]>): RoutineLog =>
  Object.fromEntries(Object.entries(entries).map(([k, [done, at]]) => [k, { done, at, by: 'A' as const }]))

// ── Occurrence expansion ───────────────────────────────────────────────────────
let keys = occurrenceKeys(rule(), '2026-06-01', '2026-06-05')
assert.deepEqual(keys, ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'])
ok('daily: every day in the window')

keys = occurrenceKeys(rule({ interval: 3 }), '2026-06-01', '2026-06-10')
assert.deepEqual(keys, ['2026-06-01', '2026-06-04', '2026-06-07', '2026-06-10'])
ok('daily with interval: every 3rd day')

keys = occurrenceKeys(rule({ freq: 'weekly', weekdays: [1, 3] }), '2026-06-01', '2026-06-14')
assert.deepEqual(keys, ['2026-06-01', '2026-06-03', '2026-06-08', '2026-06-10'])
ok('weekly: only the chosen weekdays (Mon + Wed)')

// Tuesdays AND Thursdays, the everyday way of describing a two-day week
keys = occurrenceKeys(rule({ freq: 'weekly', weekdays: [2, 4] }), '2026-06-01', '2026-06-14')
assert.deepEqual(keys, ['2026-06-02', '2026-06-04', '2026-06-09', '2026-06-11'])
ok('weekly on Tue + Thu lands on both days, every week')

assert.equal(toRRule(rule({ freq: 'weekly', weekdays: [2, 4] })), 'FREQ=WEEKLY;BYDAY=TU,TH')
ok('a two-day week exports as one RRULE with both days')

keys = occurrenceKeys(rule({ freq: 'weekly', interval: 2, weekdays: [1] }), '2026-06-01', '2026-07-01')
assert.deepEqual(keys, ['2026-06-01', '2026-06-15', '2026-06-29'])
ok('weekly with interval: every other Monday')

keys = occurrenceKeys(rule({ freq: 'weekly' }), '2026-06-01', '2026-06-30')
assert.deepEqual(keys, ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'])
ok('weekly with no weekdays picked → the start day’s own weekday')

keys = occurrenceKeys(rule({ freq: 'monthly', startDate: '2026-01-31' }), '2026-01-01', '2026-04-30')
assert.deepEqual(keys, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
ok('monthly on the 31st clamps to short months (and back again)')

keys = occurrenceKeys(rule({ freq: 'monthly', interval: 3, startDate: '2026-06-14' }), '2026-06-01', '2027-01-01')
assert.deepEqual(keys, ['2026-06-14', '2026-09-14', '2026-12-14'])
ok('monthly with interval: every 3rd month')

assert.deepEqual(occurrenceKeys(rule(), '2026-05-01', '2026-06-02'), ['2026-06-01', '2026-06-02'])
ok('nothing before the start date')

keys = occurrenceKeys(rule({ until: '2026-06-03' }), '2026-06-01', '2026-06-30')
assert.deepEqual(keys, ['2026-06-01', '2026-06-02', '2026-06-03'])
ok('`until` is an inclusive last day')

keys = occurrenceKeys(rule({ count: 3 }), '2026-06-01', '2026-06-30')
assert.deepEqual(keys, ['2026-06-01', '2026-06-02', '2026-06-03'])
ok('`count` stops the series after N occurrences')

// A count is an ORDINAL limit, so a window that opens mid-series still respects it.
keys = occurrenceKeys(rule({ count: 3 }), '2026-06-03', '2026-06-30')
assert.deepEqual(keys, ['2026-06-03'])
ok('`count` counts from the start, not from the window')

assert.equal(occurrenceKeys(rule(), '2026-06-10', '2026-06-01').length, 0)
ok('a backwards window yields nothing')

assert.ok(occurrenceKeys(rule(), '2026-06-01', '2030-01-01').length <= 400)
ok('expansion is capped, so an open-ended routine can never run away')

assert.equal(occurrenceKeys({ ...rule(), interval: 0 }, '2026-06-01', '2026-06-03').length, 3)
ok('a corrupt interval of 0 is clamped to 1 instead of looping')

assert.equal(nextOccurrenceKey(rule({ freq: 'weekly', weekdays: [5] }), '2026-06-01'), '2026-06-05')
ok('nextOccurrenceKey skips to the first matching weekday')

assert.equal(nextOccurrenceKey(rule({ until: '2026-06-02' }), '2026-06-03'), null)
ok('a finished routine has no next occurrence')

assert.equal(occurrenceTotal(rule({ count: 12 })), 12)
assert.equal(occurrenceTotal(rule({ until: '2026-06-07' })), 7)
assert.equal(occurrenceTotal(rule()), null)
ok('occurrenceTotal: count, until-derived, and open-ended')

assert.ok(occursOn(rule({ freq: 'weekly', weekdays: [1] }), '2026-06-08'))
assert.ok(!occursOn(rule({ freq: 'weekly', weekdays: [1] }), '2026-06-09'))
ok('occursOn answers a single day without expanding the series')

// ── Ordinals: where a day sits in the series (arithmetic, not a walk) ─────────
assert.equal(occurrenceOrdinal(rule(), '2026-06-01'), 1)
assert.equal(occurrenceOrdinal(rule(), '2026-06-10'), 10)
assert.equal(occurrenceOrdinal(rule({ interval: 3 }), '2026-06-10'), 4)
assert.equal(occurrenceOrdinal(rule({ interval: 3 }), '2026-06-11'), null)
ok('ordinal of a daily occurrence, and null off-rule')

// start Mon 1 Jun; Tue+Thu means the first week only holds Tue and Thu
assert.equal(occurrenceOrdinal(rule({ freq: 'weekly', weekdays: [2, 4] }), '2026-06-02'), 1)
assert.equal(occurrenceOrdinal(rule({ freq: 'weekly', weekdays: [2, 4] }), '2026-06-04'), 2)
assert.equal(occurrenceOrdinal(rule({ freq: 'weekly', weekdays: [2, 4] }), '2026-06-09'), 3)
ok('ordinal counts a multi-day week in order')

// a start day AFTER some of the chosen weekdays: that first week is partial
assert.equal(occurrenceOrdinal(rule({ freq: 'weekly', weekdays: [1, 5], startDate: '2026-06-05' }), '2026-06-05'), 1)
assert.equal(occurrenceOrdinal(rule({ freq: 'weekly', weekdays: [1, 5], startDate: '2026-06-05' }), '2026-06-08'), 2)
ok('ordinal handles a partial first week')

assert.equal(occurrenceOrdinal(rule({ freq: 'monthly', startDate: '2026-01-31' }), '2026-04-30'), 4)
ok('ordinal of a clamped monthly occurrence')

// A long count-limited series used to fall outside its own limits once the day-by-day walk ran out.
assert.ok(withinLimits(rule({ freq: 'monthly', startDate: '2015-01-18', count: 400 }), '2026-08-18'))
ok('a count limit still holds a decade into the series')

assert.equal(occurrenceTotal(rule({ startDate: '2026-01-01', until: '2027-12-31' })), 730)
ok('an `until` two years out totals 730, not the expansion cap')

assert.equal(occurrenceTotal(rule({ freq: 'weekly', weekdays: [2, 4], startDate: '2026-06-01', until: '2026-06-30' })), 9)
ok('`until` totals count only the chosen weekdays')

// lowering the plan after ticking must not report more done than planned
const overTicked = routineTodo({
  routine: rule({ count: 2 }),
  routineLog: log({ '2026-06-01': [true, 1], '2026-06-02': [true, 2], '2026-06-03': [true, 3] }),
})
const overProgress = routineProgress(overTicked)
assert.ok(overProgress.done <= (overProgress.total ?? Infinity))
assert.deepEqual(overProgress, { done: 2, total: 2 })
ok('progress never exceeds the plan')

// ── Timezone handling (the cron only knows the couple's stored offset) ─────────
const jakarta = 7 * 60
assert.equal(occurrenceInstant('2026-06-01', '07:00', jakarta), Date.UTC(2026, 5, 1, 0, 0))
ok('07:00 in UTC+7 is midnight UTC: occurrences are local wall-clock')
assert.equal(occurrenceInstant('2026-06-01', undefined, jakarta), Date.UTC(2026, 4, 31, 17, 0))
ok('an all-day occurrence anchors to local midnight')
assert.equal(dayKeyOf(Date.UTC(2026, 5, 1, 20, 0), jakarta), '2026-06-02')
ok('dayKeyOf uses the couple’s zone, not the server’s')

// ── Per-occurrence ticks + merge ───────────────────────────────────────────────
const todo = routineTodo({ routineLog: log({ '2026-06-01': [true, 100] }) })
assert.ok(isOccurrenceDone(todo, '2026-06-01'))
assert.ok(!isOccurrenceDone(todo, '2026-06-02'))
ok('a tick belongs to one occurrence day only')

// The heart of it: two phones tick DIFFERENT days offline; whole-record LWW would lose one.
let merged = mergeRoutineLogs(log({ '2026-06-01': [true, 100] }), log({ '2026-06-02': [true, 200] }))
assert.equal(Object.keys(merged ?? {}).length, 2)
ok('logs union per day: both partners’ ticks survive')

merged = mergeRoutineLogs(log({ '2026-06-01': [true, 100] }), log({ '2026-06-01': [false, 200] }))
assert.equal(merged?.['2026-06-01'].done, false)
ok('same day twice → the newer tick wins (an untick can undo a tick)')

merged = mergeRoutineLogs(log({ '2026-06-01': [true, 300] }), log({ '2026-06-01': [false, 200] }))
assert.equal(merged?.['2026-06-01'].done, true)
ok('same day twice → an older untick does not win')

// Commutativity: an exact-ms tie must resolve the same way whichever phone posts first.
const tieA = log({ '2026-06-01': [true, 500] })
const tieB = log({ '2026-06-01': [false, 500] })
assert.equal(mergeRoutineLogs(tieA, tieB)?.['2026-06-01'].done, mergeRoutineLogs(tieB, tieA)?.['2026-06-01'].done)
ok('a millisecond tie merges the same in both directions')

assert.ok(sameRoutineLog(log({ a: [true, 1] }), log({ a: [true, 1] })))
assert.ok(!sameRoutineLog(log({ a: [true, 1] }), log({ a: [false, 1] })))
assert.ok(!sameRoutineLog(log({ a: [true, 1] }), log({ a: [true, 1], b: [true, 1] })))
ok('sameRoutineLog spots a changed log so a pull only writes when needed')

// ── Progress, streaks, and which occurrence a tap acts on ─────────────────────
const kept = routineTodo({
  routine: rule({ count: 5 }),
  routineLog: log({ '2026-06-01': [true, 1], '2026-06-02': [true, 2], '2026-06-03': [false, 3] }),
})
assert.deepEqual(routineProgress(kept), { done: 2, total: 5 })
ok('progress counts done ticks against the plan')

assert.deepEqual(routineProgress(routineTodo({ routineLog: log({ '2026-05-01': [true, 1] }) })), {
  done: 0,
  total: null,
})
ok('a tick outside the rule (an old day) is ignored by progress')

assert.equal(routineStreak(kept, '2026-06-02'), 2)
ok('streak counts consecutive done occurrences')
assert.equal(routineStreak(kept, '2026-06-03'), 2)
ok('today’s still-open occurrence does not break the streak')
assert.equal(routineStreak(kept, '2026-06-04'), 0)
ok('a missed past occurrence does break it')

assert.equal(routineActiveKey(rule(), '2026-06-10'), '2026-06-10')
ok('a tap on a routine day acts on today')
assert.equal(routineActiveKey(rule({ freq: 'weekly', weekdays: [1] }), '2026-06-10'), '2026-06-08')
ok('off-day: the tap falls back to the most recent occurrence')
assert.equal(routineActiveKey(rule({ startDate: '2026-07-01' }), '2026-06-10'), '2026-07-01')
ok('before it starts: the tap targets the first upcoming occurrence')

// The client renders with the offset in force on THAT date, so a routine keeps its wall-clock
// time (and its calendar day) across a DST boundary.
for (const day of ['2026-07-01', '2026-12-25']) {
  const at = new Date(localOccurrenceInstant(day, '07:00'))
  assert.equal(`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`, day)
  assert.equal(at.getHours(), 7)
}
ok(`07:00 stays 07:00 on the right day either side of a DST change (TZ=${process.env.TZ ?? '(system)'})`)

// ── Calendar export ────────────────────────────────────────────────────────────
assert.equal(toRRule(rule()), 'FREQ=DAILY')
assert.equal(toRRule(rule({ interval: 2 })), 'FREQ=DAILY;INTERVAL=2')
assert.equal(toRRule(rule({ freq: 'weekly', weekdays: [1, 3] })), 'FREQ=WEEKLY;BYDAY=MO,WE')
assert.equal(toRRule(rule({ freq: 'monthly', startDate: '2026-06-14' })), 'FREQ=MONTHLY;BYMONTHDAY=14')
assert.equal(toRRule(rule({ count: 8 })), 'FREQ=DAILY;COUNT=8')
assert.equal(toRRule(rule({ until: '2026-12-31' })), 'FREQ=DAILY;UNTIL=20261231T235959Z')
ok('RRULE covers frequency, interval, weekdays, month day, count and until')

const icsInput = todoIcsInput(routineTodo({ routine: rule({ freq: 'weekly', weekdays: [1], time: '07:00' }) }))
assert.ok(icsInput)
const ics = buildDateIcs({ ...icsInput, stamp: Date.UTC(2026, 5, 1) })
assert.ok(ics.includes('RRULE:FREQ=WEEKLY;BYDAY=MO'), 'ics carries the RRULE')
assert.ok(ics.includes('BEGIN:VALARM'), 'a timed routine keeps its alarm')
ok('a routine exports as ONE repeating VEVENT')

const allDay = todoIcsInput(routineTodo({ routine: rule() }))
const allDayIcs = buildDateIcs({ ...allDay!, stamp: Date.UTC(2026, 5, 1) })
assert.ok(allDayIcs.includes('DTSTART;VALUE=DATE:'), 'all-day routine uses a DATE value')
assert.ok(!allDayIcs.includes('BEGIN:VALARM'), 'no midnight alarm on an all-day routine')
ok('a routine with no time exports as an all-day series')

assert.equal(todoIcsInput(routineTodo({ routine: undefined })), null)
ok('an undated one-off has nothing to export')

// an all-day series must end on the NEXT day, or calendars drop the event
const dtstart = /DTSTART;VALUE=DATE:(\d{8})/.exec(allDayIcs)?.[1]
const dtend = /DTEND;VALUE=DATE:(\d{8})/.exec(allDayIcs)?.[1]
assert.ok(dtstart && dtend && Number(dtend) > Number(dtstart))
ok('all-day DTEND is strictly after DTSTART')

// UNTIL has to carry DTSTART's value type (RFC 5545 §3.3.10)
assert.equal(toRRule(rule({ until: '2026-12-31' }), { dateOnlyUntil: true }), 'FREQ=DAILY;UNTIL=20261231')
assert.equal(toRRule(rule({ until: '2026-12-31' })), 'FREQ=DAILY;UNTIL=20261231T235959Z')
ok('an all-day series exports a DATE-valued UNTIL, a timed one a UTC DATE-TIME')

// the app clamps "monthly on the 31st" to short months, so the RRULE has to say so too
assert.equal(toRRule(rule({ freq: 'monthly', startDate: '2026-01-31' })), 'FREQ=MONTHLY;BYMONTHDAY=31,-1;BYSETPOS=1')
assert.equal(toRRule(rule({ freq: 'monthly', startDate: '2026-01-15' })), 'FREQ=MONTHLY;BYMONTHDAY=15')
ok('a late-month rule exports the clamp, an early-month one stays plain')

// ── Labels ─────────────────────────────────────────────────────────────────────
assert.equal(routineSummary(rule()), 'Every day')
assert.equal(routineSummary(rule({ interval: 2 })), 'Every 2 days')
assert.equal(routineSummary(rule({ freq: 'weekly', weekdays: [2] })), 'Every Tuesday')
assert.equal(routineSummary(rule({ freq: 'weekly', weekdays: [2, 4] })), 'Every Tuesday and Thursday')
assert.equal(routineSummary(rule({ freq: 'weekly', weekdays: [1, 3, 5] })), 'Every Mon, Wed, Fri')
assert.equal(routineSummary(rule({ freq: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] })), 'Every day')
assert.equal(routineSummary(rule({ freq: 'weekly', interval: 2, weekdays: [6] })), 'Every 2 weeks on Saturday')
assert.equal(
  routineSummary(rule({ freq: 'weekly', interval: 2, weekdays: [2, 4] })),
  'Every 2 weeks on Tuesday and Thursday',
)
assert.equal(routineSummary(rule({ freq: 'monthly', startDate: '2026-06-14' })), 'Monthly on day 14')
assert.equal(routineSummary(rule({ time: '07:30' })), 'Every day · 07:30')
ok('summaries read as plain English (and go through t() in the UI)')

// ── Sync: the shared document keeps both phones' ticks ────────────────────────
const stored = (over: Partial<SyncDoc> = {}): SyncDoc => ({ ...emptyDoc(), ...over })
const shot = (over: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  couple: null,
  pets: [],
  notifPrefs: null,
  notifPrefsUpdatedAt: 0,
  bucketItems: [],
  todos: [],
  todoGroups: [],
  sealedNotes: [],
  thinkingPings: [],
  dailyMoodChecks: [],
  tombstones: [],
  subscriptions: [],
  ...over,
})
const NOW = Date.UTC(2026, 5, 13, 12, 0, 0) // Sat 13 Jun 2026, 12:00 UTC

let doc = mergeDocs(
  stored({ todos: [routineTodo({ updatedAt: NOW - 5_000, routineLog: log({ '2026-06-01': [true, NOW - 5_000] }) })] }),
  shot({ todos: [routineTodo({ updatedAt: NOW - 1_000, routineLog: log({ '2026-06-02': [true, NOW - 1_000] }) })] }),
  NOW,
)
assert.deepEqual(Object.keys(doc.todos[0].routineLog ?? {}).sort(), ['2026-06-01', '2026-06-02'])
ok('server merge unions ticks instead of last-write-wins clobbering one')

// The record itself still merges last-write-wins around the unioned log.
doc = mergeDocs(
  stored({ todos: [routineTodo({ title: 'old', updatedAt: NOW - 5_000 })] }),
  shot({ todos: [routineTodo({ title: 'new', updatedAt: NOW - 1_000 })] }),
  NOW,
)
assert.equal(doc.todos[0].title, 'new')
ok('a routine’s other fields still merge last-write-wins')

doc = mergeDocs(
  stored({ todos: [routineTodo({ updatedAt: NOW - 5_000 })] }),
  shot({ tombstones: [{ id: 'r1', table: 'todos', deletedAt: NOW - 1_000 }] }),
  NOW,
)
assert.equal(doc.todos.length, 0)
ok('deleting a routine still propagates through its tombstone')

// ── Reminders: one push per occurrence ────────────────────────────────────────
const couple = { id: 'couple' as const, partnerAName: 'A', partnerBName: 'B', anniversaryDate: null, coupleSpaceCode: 'x', themeAccent: '', tzOffsetMinutes: 0, createdAt: 0, updatedAt: 0 }
const prefs = { quietHoursStart: 0, quietHoursEnd: 0, weekendNudge: false, anniversaryReminder: false, partnerActivity: true }
const remindDoc = (todos: Todo[]) => stored({ couple, notifPrefs: prefs, todos })

// NOW is 12:00 UTC and the couple's offset is 0, so a 12:00 routine is due right now.
let events = dueReminders(remindDoc([routineTodo({ routine: rule({ time: '12:00' }) })]), NOW)
assert.deepEqual(
  events.filter((e) => e.key.startsWith('routine:')).map((e) => e.key),
  ['routine:r1:2026-06-13'],
)
ok('a routine due now → one reminder keyed to THAT day')

events = dueReminders(
  remindDoc([routineTodo({ routine: rule({ time: '12:00' }), routineLog: log({ '2026-06-13': [true, NOW] }) })]),
  NOW,
)
assert.equal(events.filter((e) => e.key.startsWith('routine:')).length, 0)
ok('an occurrence already ticked off sends nothing')

// Tomorrow's occurrence gets its OWN key, so a daily routine nudges every single day.
const tomorrow = dueReminders(remindDoc([routineTodo({ routine: rule({ time: '12:00' }) })]), NOW + 86_400_000)
assert.deepEqual(
  tomorrow.filter((e) => e.key.startsWith('routine:')).map((e) => e.key),
  ['routine:r1:2026-06-14'],
)
ok('each day is its own dedupe key: the reminder comes back tomorrow')

events = dueReminders(remindDoc([routineTodo({ routine: rule({ freq: 'weekly', weekdays: [1], time: '12:00' }) })]), NOW)
assert.equal(events.filter((e) => e.key.startsWith('routine:')).length, 0)
ok('a weekly routine stays quiet on a day it does not fall on (Sat vs Mon)')

events = dueReminders(remindDoc([routineTodo({ routine: rule({ time: '12:00' }), done: true })]), NOW)
assert.equal(events.filter((e) => e.key.startsWith('routine:')).length, 0)
ok('a retired (done) routine stops nudging')

events = dueReminders(remindDoc([routineTodo({ routine: rule() })]), NOW)
assert.equal(events.filter((e) => e.key.startsWith('routine:')).length, 0)
ok('an all-day routine has no instant to nudge at → no push')

// A leftover dueAt must not double-notify alongside the repeat rule.
events = dueReminders(remindDoc([routineTodo({ routine: rule({ time: '12:00' }), dueAt: NOW })]), NOW)
assert.equal(events.filter((e) => e.key.startsWith('todo:')).length, 0)
assert.equal(events.filter((e) => e.key.startsWith('routine:')).length, 1)
ok('the routine schedule replaces `dueAt`: exactly one reminder, never two')

events = dueReminders(remindDoc([routineTodo({ routine: rule({ time: '12:00' }) })]), NOW + 8 * 3_600_000)
assert.equal(events.filter((e) => e.key.startsWith('routine:')).length, 0)
ok('a long-missed occurrence stops nudging (6h window, like dated to-dos)')

// ── switched off (paused) ──────────────────────────────────────────────────────────────────────
// Pausing has to do three things at once: stop the routine coming around, KEEP the days it already
// happened on, and leave the tick history alone so the count of what really happened survives.
const paused = rule({ paused: true, pausedAt: '2026-06-10' })

assert.equal(occursOn(paused, '2026-06-10'), false)
assert.equal(occursOn(paused, '2026-06-11'), false)
ok('a paused routine does not occur on the pause day or after it')

assert.equal(occursOn(paused, '2026-06-09'), true)
ok('a paused routine still occurred on the days before it was switched off')

assert.deepEqual(occurrenceKeys(paused, '2026-06-08', '2026-06-14'), ['2026-06-08', '2026-06-09'])
ok('expansion stops at the pause day, so past days keep their place on the calendar')

assert.deepEqual(occurrenceKeys(paused, '2026-06-11', '2026-06-20'), [])
ok('a window entirely after the pause is empty')

assert.equal(nextOccurrenceKey(paused, '2026-06-10'), null)
ok('a paused routine has no next occurrence')

// history must be untouched: 3 ticks before the pause still read as 3 that really happened
const pausedWithTicks = routineTodo({
  routine: paused,
  routineLog: {
    '2026-06-07': { done: true, at: 1, by: 'A' },
    '2026-06-08': { done: true, at: 2, by: 'B' },
    '2026-06-09': { done: true, at: 3, by: 'A' },
  },
})
assert.equal(routineProgress(pausedWithTicks).done, 3)
ok('pausing does not change how many occurrences really happened')

assert.equal(routineStreak(pausedWithTicks, '2026-06-09'), 3)
ok('pausing does not reset the streak')

// the cron must go quiet for it
events = dueReminders(remindDoc([routineTodo({ routine: { ...paused, time: '12:00', pausedAt: '2026-06-01' } })]), NOW)
assert.equal(events.filter((e) => e.key.startsWith('routine:')).length, 0)
ok('a paused routine stops nudging')

// switching back on is a plain resume, rule and history intact
const resumed = { ...paused, paused: undefined, pausedAt: undefined } as Routine
assert.equal(occursOn(resumed, '2026-06-11'), true)
assert.equal(routineProgress({ ...pausedWithTicks, routine: resumed }).done, 3)
ok('switching back on resumes the same rule and keeps the history')

// a record written without a pause date (older build) hides rather than silently staying on
assert.equal(occursOn({ ...rule(), paused: true }, '2026-06-11'), false)
assert.deepEqual(occurrenceKeys({ ...rule(), paused: true }, '2026-06-01', '2026-06-20'), [])
ok('paused with no pause date hides everything, the safer reading of switched off')

console.log(`\nAll ${n} routine checks passed ✅`)
