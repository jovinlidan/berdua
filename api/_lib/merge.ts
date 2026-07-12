import type {
  BucketItem,
  Couple,
  DailyMoodCheck,
  PartnerKey,
  Pet,
  PushSub,
  SealedNote,
  SyncDoc,
  SyncSnapshot,
  SyncTable,
  ThinkingPing,
  Todo,
  TodoGroup,
  Tombstone,
} from '../../src/types.js'

const TOMBSTONE_TTL = 90 * 24 * 60 * 60 * 1000 // prune deletes older than 90 days

export function emptyDoc(): SyncDoc {
  return {
    version: 0,
    updatedAt: 0,
    members: {},
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
    remindersSent: [],
  }
}

function mergeTombstones(a: Tombstone[], b: Tombstone[], nowMs: number): Tombstone[] {
  const map = new Map<string, Tombstone>()
  for (const t of [...a, ...b]) {
    const existing = map.get(t.id)
    if (!existing || t.deletedAt > existing.deletedAt) map.set(t.id, t)
  }
  return [...map.values()].filter((t) => nowMs - t.deletedAt < TOMBSTONE_TTL)
}

/** Last-write-wins by id; drop rows shadowed by a newer tombstone. */
function mergeCollection<T extends { id: string; updatedAt: number }>(
  a: T[],
  b: T[],
  tombstones: Tombstone[],
  table: SyncTable,
): T[] {
  const map = new Map<string, T>()
  for (const r of [...a, ...b]) {
    const existing = map.get(r.id)
    if (!existing || r.updatedAt > existing.updatedAt) map.set(r.id, r)
  }
  const deletedAt = new Map(tombstones.filter((t) => t.table === table).map((t) => [t.id, t.deletedAt]))
  return [...map.values()].filter((r) => {
    const d = deletedAt.get(r.id)
    return d === undefined || r.updatedAt > d
  })
}

/** Like mergeCollection but unions partner-owned fields (daily records). */
function mergeSplitCollection<T extends { id: string; updatedAt: number }>(
  a: T[],
  b: T[],
  fields: (keyof T)[],
  tombstones: Tombstone[],
  table?: SyncTable,
): T[] {
  const map = new Map<string, T>()
  for (const r of [...a, ...b]) {
    const existing = map.get(r.id)
    if (!existing) {
      map.set(r.id, r)
      continue
    }
    const newest = r.updatedAt >= existing.updatedAt ? r : existing
    const older = newest === r ? existing : r
    const out = { ...newest }
    for (const f of fields) if (out[f] === undefined || out[f] === null) out[f] = older[f]
    map.set(r.id, out)
  }
  if (!table) return [...map.values()]
  const deletedAt = new Map(tombstones.filter((t) => t.table === table).map((t) => [t.id, t.deletedAt]))
  return [...map.values()].filter((r) => {
    const d = deletedAt.get(r.id)
    return d === undefined || r.updatedAt > d
  })
}

function newerCouple(a: Couple | null, b: Couple | null): Couple | null {
  if (!a) return b
  if (!b) return a
  return b.updatedAt > a.updatedAt ? b : a
}


function mergeSubs(a: PushSub[], b: PushSub[]): PushSub[] {
  const map = new Map<string, PushSub>()
  for (const s of [...a, ...b]) {
    const existing = map.get(s.deviceId)
    if (!existing || s.updatedAt > existing.updatedAt) map.set(s.deviceId, s)
  }
  return [...map.values()]
}

/** Merge a client's incoming snapshot into the stored doc. Commutative-ish + idempotent. */
export function mergeDocs(stored: SyncDoc, incoming: SyncSnapshot, nowMs: number): SyncDoc {
  const tombstones = mergeTombstones(stored.tombstones, incoming.tombstones ?? [], nowMs)
  return {
    version: stored.version + 1,
    updatedAt: nowMs,
    couple: newerCouple(stored.couple, incoming.couple ?? null),
    pets: mergeCollection<Pet>(stored.pets ?? [], incoming.pets ?? [], tombstones, 'pets'),
    notifPrefs:
      (incoming.notifPrefsUpdatedAt ?? 0) > stored.notifPrefsUpdatedAt
        ? (incoming.notifPrefs ?? stored.notifPrefs)
        : stored.notifPrefs,
    notifPrefsUpdatedAt: Math.max(stored.notifPrefsUpdatedAt, incoming.notifPrefsUpdatedAt ?? 0),
    bucketItems: mergeCollection<BucketItem>(stored.bucketItems, incoming.bucketItems ?? [], tombstones, 'bucketItems'),
    todos: mergeCollection<Todo>(stored.todos, incoming.todos ?? [], tombstones, 'todos'),
    todoGroups: mergeCollection<TodoGroup>(stored.todoGroups ?? [], incoming.todoGroups ?? [], tombstones, 'todoGroups'),
    sealedNotes: mergeCollection<SealedNote>(stored.sealedNotes, incoming.sealedNotes ?? [], tombstones, 'sealedNotes'),
    thinkingPings: mergeCollection<ThinkingPing>(
      stored.thinkingPings ?? [],
      incoming.thinkingPings ?? [],
      tombstones,
      'thinkingPings',
    ),
    dailyMoodChecks: mergeSplitCollection<DailyMoodCheck>(
      stored.dailyMoodChecks,
      incoming.dailyMoodChecks ?? [],
      ['moodA', 'moodB', 'noteA', 'noteB'],
      tombstones,
    ),
    tombstones,
    subscriptions: mergeSubs(stored.subscriptions, incoming.subscriptions ?? []),
    remindersSent: stored.remindersSent, // server-owned (the cron writes these)
  }
}

/**
 * Couple merge with per-slot name ownership. Each device may only write the name for
 * its OWN slot (`myName` into `slot`); the other partner's name is always preserved from
 * the stored doc, so two phones never clobber each other's names. Shared fields
 * (anniversary, accent, code, tz) are last-write-wins but never overwritten by an empty value.
 */
function mergeCouple(
  stored: Couple | null,
  incoming: Couple | null,
  slot: PartnerKey,
  myName: string | undefined,
  nowMs: number,
): Couple | null {
  if (!stored && !incoming) return null
  const incomingNewer = !!incoming && (incoming.updatedAt ?? 0) >= (stored?.updatedAt ?? 0)
  const pick = <K extends keyof Couple>(k: K): Couple[K] | undefined => {
    const iv = incoming?.[k]
    const sv = stored?.[k]
    const has = (v: unknown) => v !== undefined && v !== null && v !== ''
    if (incomingNewer && has(iv)) return iv
    if (has(sv)) return sv
    return has(iv) ? iv : sv
  }
  const result: Couple = {
    id: 'couple',
    partnerAName: stored?.partnerAName ?? '',
    partnerBName: stored?.partnerBName ?? '',
    anniversaryDate: (pick('anniversaryDate') as string | null | undefined) ?? null,
    coupleSpaceCode: (pick('coupleSpaceCode') as string | null | undefined) ?? null,
    themeAccent: (pick('themeAccent') as string | undefined) ?? '#E8927C',
    tzOffsetMinutes: incoming?.tzOffsetMinutes ?? stored?.tzOffsetMinutes,
    createdAt: Math.min(stored?.createdAt ?? nowMs, incoming?.createdAt ?? nowMs),
    updatedAt: nowMs,
  }
  // The posting device owns exactly its own slot's name.
  const ownName = myName ?? (slot === 'A' ? incoming?.partnerAName : incoming?.partnerBName)
  if (slot === 'A') {
    if (ownName) result.partnerAName = ownName
  } else {
    if (ownName) result.partnerBName = ownName
  }
  return result
}

/**
 * Claim a slot for `deviceId` and merge. A code holds at most two devices. Slot selection, in order:
 *  1. The device already owns a slot → keep it.
 *  2. A slot's name matches the joiner's name → RECLAIM it. This is what lets the same person move to
 *     a new storage jar (iOS "Add to Home Screen" gives the installed app its own storage, separate
 *     from Safari) or reinstall, and pull their cloud data back WITHOUT consuming the partner's slot
 *     or duplicating themselves.
 *  3. A free slot → take it.
 *  4. Both taken by different people → reject ({ full: true }).
 *
 * Back-compat: a client that sends no deviceId falls back to plain whole-record couple merge.
 */
export type JoinReject = 'couple_full' | 'name_taken'

export function joinAndMerge(
  stored: SyncDoc,
  incoming: SyncSnapshot,
  deviceId: string | undefined,
  myName: string | undefined,
  nowMs: number,
): { full: boolean; doc?: SyncDoc; assignedPartner?: PartnerKey; error?: JoinReject } {
  if (!deviceId) return { full: false, doc: mergeDocs(stored, incoming, nowMs) }

  const members = { ...(stored.members ?? {}) }
  const mine = (myName ?? '').trim().toLowerCase()
  const nameOf = (s: PartnerKey) =>
    ((s === 'A' ? stored.couple?.partnerAName : stored.couple?.partnerBName) ?? '').trim().toLowerCase()

  let slot: PartnerKey
  if (members.A?.deviceId === deviceId) slot = 'A'
  else if (members.B?.deviceId === deviceId) slot = 'B'
  else if (mine && nameOf('A') === mine) slot = 'A' // same person, new device jar → reclaim my slot
  else if (mine && nameOf('B') === mine) slot = 'B'
  else if (!members.A) slot = 'A'
  else if (!members.B) slot = 'B'
  else return { full: true, error: 'couple_full' } // both slots held by other people

  // The two partners must have distinct names. Reject anything that would make my name equal the
  // OTHER slot's name (e.g. joining/renaming into your partner's name).
  const otherSlot: PartnerKey = slot === 'A' ? 'B' : 'A'
  if (mine && nameOf(otherSlot) === mine) return { full: true, error: 'name_taken' }

  members[slot] = { deviceId, joinedAt: members[slot]?.joinedAt ?? nowMs }
  const doc = mergeDocs(stored, incoming, nowMs)
  doc.members = members
  doc.couple = mergeCouple(stored.couple, incoming.couple ?? null, slot, myName, nowMs)
  return { full: false, doc, assignedPartner: slot }
}
