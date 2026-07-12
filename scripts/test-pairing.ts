// Unit checks for pairing-by-code: slot claiming, the 2-device cap, and per-slot name ownership.
// Run: pnpm exec tsx scripts/test-pairing.ts
import assert from 'node:assert'
import { emptyDoc, joinAndMerge } from '../api/_lib/merge'
import type { Couple, SyncDoc, SyncSnapshot } from '../src/types'

let n = 0
const ok = (label: string) => {
  n++
  console.log(`  ✓ ${label}`)
}

const couple = (over: Partial<Couple> = {}): Couple =>
  ({
    id: 'couple',
    partnerAName: '',
    partnerBName: '',
    anniversaryDate: null,
    coupleSpaceCode: 'loveword',
    themeAccent: '#E8927C',
    tzOffsetMinutes: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  })
const shot = (over: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  couple: null,
  notifPrefs: null,
  notifPrefsUpdatedAt: 0,
  dateIdeas: [],
  plannedDates: [],
  bucketItems: [],
  memories: [],
  todos: [],
  todoGroups: [],
  sealedNotes: [],
  dailyMoodChecks: [],
  tombstones: [],
  subscriptions: [],
  ...over,
})
// joinAndMerge always returns non-full here (we assert that first); helper unwraps the doc.
const join = (stored: SyncDoc, snap: SyncSnapshot, deviceId: string, myName: string, t: number) =>
  joinAndMerge(stored, snap, deviceId, myName, t)

// ── First device claims slot A ────────────────────────────────────────────────
let r = join(emptyDoc(), shot({ couple: couple({ partnerAName: 'Alex', updatedAt: 100 }) }), 'devA', 'Alex', 100)
assert.ok(!r.full)
assert.equal(r.assignedPartner, 'A')
assert.equal(r.doc.members?.A?.deviceId, 'devA')
assert.equal(r.doc.couple?.partnerAName, 'Alex')
assert.equal(r.doc.couple?.partnerBName, '') // partner not joined yet → empty → "waiting"
ok('first device claims slot A, partner name empty (waiting state)')

const afterA = r.doc

// ── Second device (different phone) joins as B ─────────────────────────────────
r = join(afterA, shot({ couple: couple({ partnerAName: 'Sayang', updatedAt: 200 }) }), 'devB', 'Sayang', 200)
assert.ok(!r.full)
assert.equal(r.assignedPartner, 'B')
assert.equal(r.doc.members?.B?.deviceId, 'devB')
assert.equal(r.doc.couple?.partnerBName, 'Sayang') // B's name lands in slot B…
assert.equal(r.doc.couple?.partnerAName, 'Alex') // …and does NOT clobber A's name
ok("second device joins as B; B's name fills slot B without clobbering A")

const paired = r.doc

// ── Third device with the same code is rejected ───────────────────────────────
r = join(paired, shot({ couple: couple({ partnerAName: 'Intruder', updatedAt: 300 }) }), 'devC', 'Intruder', 300)
assert.ok(r.full)
ok('third device with the same code is rejected (couple_full)')

// ── Idempotent re-sync: device A keeps slot A, never grabs B ───────────────────
r = join(paired, shot({ couple: couple({ partnerAName: 'Alex', updatedAt: 400 }) }), 'devA', 'Alex', 400)
assert.ok(!r.full)
assert.equal(r.assignedPartner, 'A')
assert.equal(r.doc.couple?.partnerAName, 'Alex')
assert.equal(r.doc.couple?.partnerBName, 'Sayang') // partner name preserved on A's re-sync
ok('device A re-syncs → keeps slot A, both names intact')

// ── A device may not overwrite the OTHER slot's name ───────────────────────────
// B posts a snapshot that (maliciously or staly) carries a different partnerAName.
r = join(paired, shot({ couple: couple({ partnerAName: 'HACK', partnerBName: 'Sayang', updatedAt: 500 }) }), 'devB', 'Sayang', 500)
assert.equal(r.full ? null : r.doc.couple?.partnerAName, 'Alex') // A's name protected
ok("a device cannot overwrite its partner's name")

// ── Renaming yourself updates only your slot ───────────────────────────────────
r = join(paired, shot({ couple: couple({ updatedAt: 600 }) }), 'devB', 'Sayangku', 600)
assert.equal(r.full ? null : r.doc.couple?.partnerBName, 'Sayangku')
assert.equal(r.full ? null : r.doc.couple?.partnerAName, 'Alex')
ok('renaming yourself updates only your own slot')

// ── Shared field (anniversary) set by A is not wiped by B's empty value ────────
const withAnniv = join(afterA, shot({ couple: couple({ partnerAName: 'Alex', anniversaryDate: '2020-02-02', updatedAt: 700 }) }), 'devA', 'Alex', 700)
const bEmpty = join(withAnniv.full ? afterA : withAnniv.doc, shot({ couple: couple({ anniversaryDate: null, updatedAt: 800 }) }), 'devB', 'Sayang', 800)
assert.equal(bEmpty.full ? null : bEmpty.doc.couple?.anniversaryDate, '2020-02-02')
ok("partner's empty anniversary does not wipe the set one")

// ── Slot reclaim: same person on a new device jar (iOS install / reinstall) ───────────────────
// Paired couple: A=Alex (devA), B=Sayang (devB). Alex reinstalls → brand-new deviceId devA2.
r = join(paired, shot({ couple: couple({ partnerAName: 'Alex', updatedAt: 900 }) }), 'devA2', 'Alex', 900)
assert.ok(!r.full)
assert.equal(r.assignedPartner, 'A') // reclaims A by name, does NOT take B or get rejected
assert.equal(r.doc.members?.A?.deviceId, 'devA2')
assert.equal(r.doc.members?.B?.deviceId, 'devB') // partner slot untouched
ok('same-name new device reclaims its own slot (does not consume the partner slot)')

// Reinstall while the partner slot is still FREE must NOT grab the empty slot (would duplicate).
r = join(afterA, shot({ couple: couple({ partnerAName: 'Alex', updatedAt: 950 }) }), 'devA3', 'Alex', 950)
assert.equal(r.full ? null : r.assignedPartner, 'A')
assert.equal(r.full ? null : r.doc.members?.B, undefined)
ok('reinstall with a free partner slot still reclaims own slot, leaves partner slot open')

// A genuinely different person still gets the free slot (normal pairing), not a reclaim.
r = join(afterA, shot({ couple: couple({ partnerBName: 'Sayang', updatedAt: 960 }) }), 'devB9', 'Sayang', 960)
assert.equal(r.full ? null : r.assignedPartner, 'B')
ok('a different name still joins the free slot normally')

// ── Distinct-name enforcement + clear rejects ────────────────────────────────────────────────
// Owner of slot A tries to rename themselves to the partner's (B's) name → name_taken.
r = join(paired, shot({ couple: couple({ partnerAName: 'Sayang', updatedAt: 1000 }) }), 'devA', 'Sayang', 1000)
assert.ok(r.full)
assert.equal(r.error, 'name_taken')
ok('renaming yourself to your partner’s name is rejected (name_taken)')

// A third, unknown person on a full code → couple_full (the "wrong name + taken code" error).
r = join(paired, shot({ couple: couple({ updatedAt: 1010 }) }), 'devX', 'Stranger', 1010)
assert.ok(r.full)
assert.equal(r.error, 'couple_full')
ok('unknown name on a full code is rejected (couple_full)')

console.log(`\nAll ${n} pairing checks passed ✅`)
