// Client side of phase-2 sync. One JSON doc per couple (keyed by coupleSpaceCode).
// We POST a photo-free snapshot; the server merges it (per-record last-write-wins +
// tombstones) and returns the merged doc, which we apply back into Dexie. Photos stay
// local. If the API is unreachable (e.g. local dev, offline), every call no-ops quietly.
import { db } from '../db/database'
import { mergeRoutineLogs, sameRoutineLog } from '../lib/recurrence'
import { useSession } from '../store/useSession'
import type { Couple, PartnerKey, SyncDoc, SyncSnapshot } from '../types'
import { onChange } from './bus'
import { useSyncStatus } from './status'

const ENDPOINT = '/api/state'

// Redis-frugal sync: writes (POST) cost get+set+sadd; reads (GET) cost one op. We only POST when
// there's an unsynced LOCAL change; an idle device just GETs to pull the partner's updates. This
// keeps a two-phone couple comfortably inside Upstash's free tier even while both apps are open.
let dirty = false
let appliedOnce = false // force the first cycle to be a POST (upload our local seeds + claim presence)
onChange(() => {
  dirty = true
})

/** The POST response is the merged doc plus which slot (A/B) this device was assigned. */
type SyncResponse = SyncDoc & { assignedPartner?: PartnerKey }

const myNameFor = (couple: Pick<Couple, 'partnerAName' | 'partnerBName'> | undefined, slot: PartnerKey) =>
  (slot === 'A' ? couple?.partnerAName : couple?.partnerBName)?.trim() || ''

async function buildSnapshot(): Promise<SyncSnapshot> {
  const s = useSession.getState()
  const [couple, pets, bucketItems, todos, todoGroups, sealedNotes, thinkingPings, dailyMoodChecks, tombstones] =
    await Promise.all([
      db.couples.get('couple'),
      db.pets.toArray(),
      db.bucketItems.toArray(),
      db.todos.toArray(),
      db.todoGroups.toArray(),
      db.sealedNotes.toArray(),
      db.thinkingPings.toArray(),
      db.dailyMoodChecks.toArray(),
      db.tombstones.toArray(),
    ])
  return {
    couple: couple ?? null,
    pets,
    notifPrefs: s.notifPrefs,
    notifPrefsUpdatedAt: s.notifPrefsUpdatedAt,
    bucketItems,
    todos,
    todoGroups,
    sealedNotes,
    thinkingPings,
    dailyMoodChecks,
    tombstones,
    subscriptions: s.pushSub ? [s.pushSub] : [],
  }
}

const newer = (a: { updatedAt: number } | undefined, b: { updatedAt: number }) =>
  !a || b.updatedAt > a.updatedAt

/**
 * Field-union merge for daily records (each partner owns separate fields). Whole-record
 * LWW would clobber one partner's answer if both wrote offline; instead the newer record
 * wins for shared fields but we backfill any field it's missing from the older one.
 */
function unionDaily<T extends { updatedAt: number }>(local: T | undefined, remote: T, fields: (keyof T)[]): T {
  if (!local) return remote
  const newest = remote.updatedAt >= local.updatedAt ? remote : local
  const older = newest === remote ? local : remote
  const out = { ...newest }
  for (const f of fields) if (out[f] === undefined || out[f] === null) out[f] = older[f]
  return out
}

/**
 * Merge the server's couple record into the local one. Mirror of the server's per-slot rule:
 * always trust the server for the PARTNER's name (the slot this device doesn't own), while
 * keeping our own freshly-edited name if the local record is newer (an edit not yet synced).
 */
function applyCoupleLocal(local: Couple | undefined, remote: Couple, mySlot: PartnerKey): Couple {
  if (!local) return remote
  const base = remote.updatedAt >= local.updatedAt ? remote : local
  const out: Couple = { ...base }
  const myField = mySlot === 'A' ? 'partnerAName' : 'partnerBName'
  const partnerField = mySlot === 'A' ? 'partnerBName' : 'partnerAName'
  out[partnerField] = remote[partnerField] || base[partnerField] // partner owns it → server wins
  out[myField] = (local.updatedAt > remote.updatedAt ? local[myField] : remote[myField]) || base[myField]
  return out
}

/** Apply the server's merged doc into local Dexie + session, respecting updatedAt. */
async function applyRemote(doc: SyncDoc): Promise<void> {
  // Newest deletion per id from BOTH the server's tombstones AND our own local ones. We must honor
  // our OWN pending delete: otherwise a pull whose server copy predates that delete would re-insert
  // the row (it "comes back"), until our delete finally syncs and removes it again.
  const tombs = new Map<string, number>()
  for (const t of await db.tombstones.toArray()) tombs.set(t.id, t.deletedAt)
  for (const t of doc.tombstones) {
    const cur = tombs.get(t.id)
    if (cur === undefined || t.deletedAt > cur) tombs.set(t.id, t.deletedAt)
  }
  // A record is shadowed if a tombstone is at least as new as it → don't (re)insert it.
  const shadowed = (id: string, updatedAt: number) => {
    const d = tombs.get(id)
    return d !== undefined && d >= updatedAt
  }

  // 1) tombstones first: delete local rows the other device removed (unless we edited later)
  for (const t of doc.tombstones) {
    const local = await db.table(t.table).get(t.id)
    if (local && (local.updatedAt ?? 0) <= t.deletedAt) await db.table(t.table).delete(t.id)
    await db.tombstones.put(t)
  }

  // 2) upsert collections when the remote copy is newer AND not shadowed by a tombstone
  await db.transaction(
    'rw',
    [db.bucketItems, db.todos, db.todoGroups, db.sealedNotes, db.thinkingPings, db.dailyMoodChecks, db.couples, db.pets],
    async () => {
    // To-dos are per-record LWW like everything else, EXCEPT `routineLog`: a partner's tick on one
    // occurrence day must survive even when our copy of the record is newer (say we renamed the
    // routine after they ticked yesterday), so the log is unioned per day in both directions.
    for (const r of doc.todos) {
      if (shadowed(r.id, r.updatedAt)) continue
      const local = await db.todos.get(r.id)
      const log = mergeRoutineLogs(local?.routineLog, r.routineLog)
      if (newer(local, r)) {
        await db.todos.put(log ? { ...r, routineLog: log } : r)
      } else if (log && !sameRoutineLog(log, local?.routineLog)) {
        // Leave `updatedAt` alone: a per-day union is order-independent, so it needs no new clock,
        // and bumping it here would make our record spuriously win the next field-level merge.
        await db.todos.update(r.id, { routineLog: log })
      }
    }
    for (const r of doc.todoGroups ?? []) {
      const local = await db.todoGroups.get(r.id)
      if (!shadowed(r.id, r.updatedAt) && newer(local, r)) await db.todoGroups.put(r)
    }
    for (const r of doc.sealedNotes) {
      const local = await db.sealedNotes.get(r.id)
      if (!shadowed(r.id, r.updatedAt) && newer(local, r)) await db.sealedNotes.put(r)
    }
    for (const r of doc.thinkingPings ?? []) {
      const local = await db.thinkingPings.get(r.id)
      if (!shadowed(r.id, r.updatedAt) && newer(local, r)) await db.thinkingPings.put(r)
    }
    for (const r of doc.dailyMoodChecks) {
      if (shadowed(r.id, r.updatedAt)) continue
      const local = await db.dailyMoodChecks.get(r.id)
      await db.dailyMoodChecks.put(unionDaily(local, r, ['moodA', 'moodB', 'noteA', 'noteB']))
    }
    for (const r of doc.bucketItems) {
      const local = await db.bucketItems.get(r.id)
      if (!shadowed(r.id, r.updatedAt) && newer(local, r)) await db.bucketItems.put(r)
    }
    if (doc.couple) {
      const local = await db.couples.get('couple')
      const mySlot = useSession.getState().activePartner
      await db.couples.put(applyCoupleLocal(local, doc.couple, mySlot))
    }
    for (const r of doc.pets ?? []) {
      const local = await db.pets.get(r.id)
      if (!shadowed(r.id, r.updatedAt) && newer(local, r)) await db.pets.put(r)
    }
  })

  // 3) singletons in the session store
  const s = useSession.getState()
  if (doc.notifPrefs && doc.notifPrefsUpdatedAt > s.notifPrefsUpdatedAt) {
    useSession.setState({ notifPrefs: doc.notifPrefs, notifPrefsUpdatedAt: doc.notifPrefsUpdatedAt })
  }
}

/** Adopt the slot (A/B) the server assigned this device, fixing our identity + push tag. */
function adoptAssignedPartner(assigned?: PartnerKey) {
  if (!assigned) return
  const s = useSession.getState()
  if (s.activePartner !== assigned) s.setActivePartner(assigned)
  if (s.pushSub && s.pushSub.partner !== assigned) {
    s.setPushSub({ ...s.pushSub, partner: assigned, updatedAt: Date.now() })
  }
}

export type JoinResult =
  | { status: 'ok'; assignedPartner: PartnerKey }
  | { status: 'full' } // the code already holds two other people
  | { status: 'name_taken' } // that name is already used by the partner in this code
  | { status: 'offline' } // couldn't reach the server

/**
 * Claim a couple-space code from this device: become A (creator) or B (joiner), or be turned
 * away if two devices already hold it. On success the couple is persisted locally and this
 * device's identity is fixed to the assigned slot.
 */
export async function joinCouple(input: {
  name: string
  code: string
  anniversary: string | null
}): Promise<JoinResult> {
  const code = input.code.trim()
  const name = input.name.trim()
  if (!code || !name) return { status: 'offline' }
  const { deviceId } = useSession.getState()

  const snapshot = await buildSnapshot()
  const nowMs = Date.now()
  const couple: Couple = {
    id: 'couple',
    partnerAName: name, // tentative; the server places this name into the slot it assigns
    partnerBName: '',
    anniversaryDate: input.anniversary,
    coupleSpaceCode: code,
    themeAccent: snapshot.couple?.themeAccent ?? '#E8927C',
    tzOffsetMinutes: -new Date().getTimezoneOffset(),
    createdAt: snapshot.couple?.createdAt ?? nowMs,
    updatedAt: nowMs,
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, deviceId, myName: name, doc: { ...snapshot, couple } }),
    })
    if (res.status === 409) {
      const reason = await res.json().catch(() => ({}) as { error?: string })
      return { status: reason?.error === 'name_taken' ? 'name_taken' : 'full' }
    }
    if (!res.ok) return { status: 'offline' }
    const merged = (await res.json()) as SyncResponse
    adoptAssignedPartner(merged.assignedPartner)
    await applyRemote(merged) // persists the couple locally → opens the app
    useSyncStatus.getState().set('ok')
    return { status: 'ok', assignedPartner: merged.assignedPartner ?? 'A' }
  } catch {
    return { status: 'offline' }
  }
}

let inFlight = false

/**
 * Run one sync cycle. By default it's read-mostly: if there are no unsynced local changes it does a
 * cheap GET (pull the partner's updates); only a dirty state (or the first cycle) does a POST that
 * merges our snapshot. `force: true` always POSTs — used by the manual "Sync now" button.
 */
export async function syncOnce(force = false): Promise<boolean> {
  if (inFlight) return false
  const couple = await db.couples.get('couple')
  const code = couple?.coupleSpaceCode?.trim()
  if (!code) return false // sync only activates once a couple-space code is set

  const status = useSyncStatus.getState()
  inFlight = true
  status.set('syncing')
  const wantPush = dirty || force || !appliedOnce
  try {
    let merged: SyncResponse
    if (wantPush) {
      // Consume `dirty` BEFORE building the snapshot. Any change made WHILE this push is in flight
      // re-sets dirty and is preserved for the next cycle — otherwise that change would be stranded
      // (cleared by this push that never carried it) and a stale GET could keep reverting it.
      dirty = false
      const snapshot = await buildSnapshot()
      const myName = myNameFor(couple, useSession.getState().activePartner)
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, deviceId: useSession.getState().deviceId, myName, doc: snapshot }),
      })
      if (!res.ok) {
        // A 409 is a logical rejection (e.g. name collides with the partner) — don't loop on it.
        // Transient errors (offline / 5xx) keep the change pending for a retry.
        if (res.status !== 409) dirty = true
        status.set('offline')
        return false
      }
      merged = (await res.json()) as SyncResponse
    } else {
      // Read-only pull — one Redis op, no write.
      const res = await fetch(`${ENDPOINT}?code=${encodeURIComponent(code)}`, { method: 'GET' })
      if (!res.ok) {
        status.set('offline')
        return false
      }
      merged = (await res.json()) as SyncResponse
    }
    appliedOnce = true
    adoptAssignedPartner(merged.assignedPartner)
    await applyRemote(merged)
    status.set('ok')
    return true
  } catch {
    status.set('offline') // offline / no backend yet — stay local-only
    return false
  } finally {
    inFlight = false
  }
}

/**
 * Erase this couple's shared document from the server (Redis) — frees both A/B slots so the code can
 * be re-paired fresh. Called by "Start over" before the local store is wiped. Best-effort.
 */
export async function eraseRemote(code: string): Promise<void> {
  const c = code.trim()
  if (!c) return
  try {
    await fetch(`${ENDPOINT}?code=${encodeURIComponent(c)}`, { method: 'DELETE' })
  } catch {
    // offline — local wipe still proceeds; the doc lingers until the cron prunes/overwrite
  }
}
