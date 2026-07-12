// Unit checks for the phase-2 merge + reminder logic (pure functions).
// Run: pnpm exec tsx scripts/test-sync.ts
import assert from 'node:assert'
import { emptyDoc, mergeDocs } from '../api/_lib/merge'
import { dueReminders, reminderDeliveryKey } from '../api/_lib/reminders'
import type { SyncDoc, SyncSnapshot } from '../src/types'

const NOW = Date.UTC(2026, 5, 13, 12, 0, 0) // Sat 13 Jun 2026, 12:00 UTC
const HOUR = 3_600_000
const at = (k: number) => NOW - 10_000 + k // realistic recent timestamps (within the tombstone TTL)

const todo = (id: string, updatedAt: number, title = 'x') =>
  ({ id, title, category: 'food', done: false, addedBy: 'A', createdAt: updatedAt, updatedAt }) as never
const sub = (deviceId: string, updatedAt: number) =>
  ({ deviceId, partner: 'A', endpoint: `e/${deviceId}`, p256dh: 'p', auth: 'a', updatedAt }) as never
const prefs = (weekendNudge: boolean, quiet: [number, number] = [0, 0]) =>
  ({ quietHoursStart: quiet[0], quietHoursEnd: quiet[1], weekendNudge, anniversaryReminder: true, partnerActivity: true }) as never
const couple = (over: Record<string, unknown> = {}) =>
  ({ id: 'couple', partnerAName: 'A', partnerBName: 'B', anniversaryDate: null, coupleSpaceCode: 'x', themeAccent: '', tzOffsetMinutes: 0, createdAt: 0, updatedAt: 0, ...over }) as never
const shot = (over: Partial<SyncSnapshot> = {}): SyncSnapshot =>
  ({ couple: null, pets: [], notifPrefs: null, notifPrefsUpdatedAt: 0, bucketItems: [], todos: [], todoGroups: [], sealedNotes: [], thinkingPings: [], dailyMoodChecks: [], tombstones: [], subscriptions: [], ...over })
const ping = (id: string, updatedAt: number, message = 'Miss you 🥺', fromPartner: 'A' | 'B' = 'A') =>
  ({ id, fromPartner, message, createdAt: updatedAt, updatedAt }) as never
const moodRec = (id: string, over: Record<string, unknown>) =>
  ({ id, createdAt: at(100), updatedAt: at(100), ...over }) as never
const note = (id: string, unlockOffsetHours: number) =>
  ({ id, fromPartner: 'A', body: 'hi', unlockAt: NOW + unlockOffsetHours * HOUR, createdAt: 0, updatedAt: 0 }) as never
const todoDue = (id: string, dueOffsetHours: number) =>
  ({ id, title: 'Buy milk', category: 'food', done: false, dueAt: NOW + dueOffsetHours * HOUR, addedBy: 'A', createdAt: 0, updatedAt: 0 }) as never
const stored = (over: Partial<SyncDoc> = {}): SyncDoc => ({ ...emptyDoc(), ...over })

let n = 0
const ok = (label: string) => {
  n++
  console.log(`  ✓ ${label}`)
}

// ── mergeDocs ───────────────────────────────────────────────────────────────
let m = mergeDocs(emptyDoc(), shot({ todos: [todo('a', at(100), 'A1')] }), NOW)
assert.equal(m.todos.length, 1)
assert.equal(m.version, 1)
ok('adds a new record, bumps version')

m = mergeDocs(stored({ todos: [todo('a', at(100), 'old')] }), shot({ todos: [todo('a', at(200), 'new')] }), NOW)
assert.equal(m.todos[0].title, 'new')
ok('LWW: newer incoming wins')

m = mergeDocs(stored({ todos: [todo('a', at(300), 'keep')] }), shot({ todos: [todo('a', at(200), 'old')] }), NOW)
assert.equal(m.todos[0].title, 'keep')
ok('LWW: older incoming ignored')

m = mergeDocs(stored({ todos: [todo('a', at(200))] }), shot({ tombstones: [{ id: 'a', table: 'todos', deletedAt: at(300) }] }), NOW)
assert.equal(m.todos.length, 0)
ok('tombstone newer than row → row removed')

m = mergeDocs(stored({ todos: [todo('a', at(300))] }), shot({ tombstones: [{ id: 'a', table: 'todos', deletedAt: at(100) }] }), NOW)
assert.equal(m.todos.length, 1)
ok('tombstone older than edit → row kept (edit wins over delete)')

m = mergeDocs(stored({ subscriptions: [sub('d1', at(100))] }), shot({ subscriptions: [sub('d2', at(100))] }), NOW)
assert.equal(m.subscriptions.length, 2)
ok('subscriptions union by deviceId (both phones accumulate)')

m = mergeDocs(stored({ notifPrefs: prefs(true), notifPrefsUpdatedAt: at(100) }), shot({ notifPrefs: prefs(false), notifPrefsUpdatedAt: at(200) }), NOW)
assert.equal(m.notifPrefs?.weekendNudge, false)
ok('notifPrefs LWW by timestamp')

m = mergeDocs(emptyDoc(), shot({ sealedNotes: [note('s1', 999)] }), NOW)
assert.equal(m.sealedNotes.length, 1)
ok('sealed note syncs through merge')

// thinking-of-you pings: a sent ping syncs to the partner, both partners' pings accumulate,
// and an "unsend" tombstone removes one (the history is the durable record behind the push).
m = mergeDocs(emptyDoc(), shot({ thinkingPings: [ping('p1', at(100), 'Miss you 🥺')] }), NOW)
assert.equal(m.thinkingPings.length, 1)
assert.equal(m.thinkingPings[0].message, 'Miss you 🥺')
ok('thinking-of-you ping syncs through merge')

m = mergeDocs(stored({ thinkingPings: [ping('p1', at(100), 'hi', 'A')] }), shot({ thinkingPings: [ping('p2', at(200), 'hey', 'B')] }), NOW)
assert.equal(m.thinkingPings.length, 2)
ok('thinking pings from both partners accumulate')

m = mergeDocs(stored({ thinkingPings: [ping('p1', at(100))] }), shot({ tombstones: [{ id: 'p1', table: 'thinkingPings', deletedAt: at(200) }] }), NOW)
assert.equal(m.thinkingPings.length, 0)
ok('thinking ping tombstone → removed (unsend)')

// field-union: A checked in (older) on one phone, B (newer) on the other — both must survive
m = mergeDocs(
  stored({ dailyMoodChecks: [moodRec('2026-06-14', { moodA: 4, updatedAt: at(100) })] }),
  shot({ dailyMoodChecks: [moodRec('2026-06-14', { moodB: 5, updatedAt: at(200) })] }),
  NOW,
)
assert.equal(m.dailyMoodChecks[0].moodA, 4)
assert.equal(m.dailyMoodChecks[0].moodB, 5)
ok('daily mood: both partners’ moods survive merge (field-union, not LWW)')

// idempotency: merging the same snapshot twice yields the same collections
const snap = shot({ todos: [todo('a', at(100)), todo('b', at(100))] })
const once = mergeDocs(emptyDoc(), snap, NOW)
const twice = mergeDocs(once, snap, NOW)
assert.equal(twice.todos.length, 2)
ok('idempotent: re-merging the same snapshot does not duplicate')

// ── dueReminders ──────────────────────────────────────────────────────────────
const doc = (over: Partial<SyncDoc>) => stored({ couple: couple(), notifPrefs: prefs(false), ...over })

let ev = dueReminders(doc({ todos: [todoDue('t1', 0)] }), NOW)
assert.ok(ev.some((e) => e.key === `todo:t1:due:${NOW}`))
ok('to-do due now → reminder')

const firstDueKey = ev.find((e) => e.key.startsWith('todo:t1:'))?.key
ev = dueReminders(doc({ todos: [todoDue('t1', 1)] }), NOW + HOUR)
const movedDueKey = ev.find((e) => e.key.startsWith('todo:t1:'))?.key
assert.ok(firstDueKey && movedDueKey && firstDueKey !== movedDueKey)
ok('moving a to-do reminder creates a fresh dedupe key')

assert.notEqual(reminderDeliveryKey(movedDueKey, 'device-a'), reminderDeliveryKey(movedDueKey, 'device-b'))
ok('reminder delivery deduplicates per device')

ev = dueReminders(doc({ todos: [todoDue('t2', 48)] }), NOW)
assert.ok(!ev.some((e) => e.key.startsWith('todo:t2')))
ok('to-do far in the future → no reminder yet')

ev = dueReminders(doc({ todos: [todoDue('t3', 0)], notifPrefs: prefs(false, [11, 13]) }), NOW)
assert.equal(ev.length, 0)
ok('quiet hours (11–13, now 12) suppress everything')

ev = dueReminders(doc({ couple: couple({ anniversaryDate: '2020-06-13' }) }), NOW)
assert.ok(ev.some((e) => e.key.startsWith('anniv:')))
ok('anniversary today → anniversary greeting')

ev = dueReminders(doc({ sealedNotes: [note('n1', -1)] }), NOW)
assert.ok(ev.some((e) => e.key === 'capsule:n1:unlocked'))
ok('time capsule just unlocked → reminder')

ev = dueReminders(doc({ sealedNotes: [note('n2', 48)] }), NOW)
assert.ok(!ev.some((e) => e.key.startsWith('capsule:n2')))
ok('still-sealed capsule → no reminder')

// weekend nudge: NOW is a Saturday; make a Friday instant to trigger it
const FRI = Date.UTC(2026, 5, 12, 12, 0, 0)
ev = dueReminders(doc({ notifPrefs: prefs(true) }), FRI)
assert.ok(ev.some((e) => e.key.startsWith('weekend:')))
ok('Friday + weekend nudge on → weekend reminder')

console.log(`\nAll ${n} sync/reminder checks passed ✅`)
