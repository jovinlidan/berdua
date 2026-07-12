// Berdua domain model. Local-first (Dexie) with optional phase-2 cloud sync.
// Every syncable entity carries `updatedAt` (epoch ms) so sync can do per-record
// last-write-wins; deletes propagate via Tombstone rows.

export type PartnerKey = 'A' | 'B'

export type WishLevel = 'soon' | 'this_year' | 'someday'

/** Single shared record for the couple. id is always 'couple'. */
export interface Couple {
  id: 'couple'
  partnerAName: string
  partnerBName: string
  anniversaryDate: string | null // ISO yyyy-mm-dd
  coupleSpaceCode: string | null // the shared key that links both phones (phase-2 sync)
  themeAccent: string
  tzOffsetMinutes?: number // minutes east of UTC — lets the cron reason in local time
  createdAt: number
  updatedAt: number
}

/**
 * A private item — LOCAL ONLY. Deliberately NOT part of SyncDoc, so it never reaches the
 * couple's shared document or the partner's phone. Owner-filtered + PIN-gated in the UI.
 */
export interface Secret {
  id: string
  owner: PartnerKey
  text: string
  done: boolean
  photos: Blob[] // local-only, like the secret itself
  createdAt: number
  updatedAt: number
}

export type LinkSource = 'tiktok' | 'instagram' | 'youtube' | 'link'

export interface BucketItem {
  id: string
  title: string
  note?: string
  wishLevel: WishLevel
  addedBy: PartnerKey
  isComplete: boolean
  completedAt?: number
  link?: string // a saved IG/TikTok/etc. URL this dream came from
  linkSource?: LinkSource
  linkThumb?: string // thumbnail URL (best-effort, from oEmbed)
  createdAt: number
  updatedAt: number
}

export type TodoCategory = 'food' | 'movie' | 'game' | 'travel'

/** A to-do category (the 6 built-ins are seeded; couples can add their own). Synced. */
export interface TodoGroup {
  id: string
  label: string
  emoji: string
  tint: string
  order: number
  createdAt: number
  updatedAt: number
}

/**
 * A pinned place a to-do is tied to (used by Food todos; absent on everything else). Travels
 * INSIDE the Todo record, so it syncs via the existing per-record LWW — no new table or API change.
 */
export interface Place {
  name: string // venue name (from search, or typed)
  lat: number
  lng: number
  address?: string // readable full address, when known
}

export interface Todo {
  id: string
  title: string
  note?: string // optional description / details
  category: string // a TodoGroup id (built-in key or a custom group id)
  done: boolean
  doneAt?: number
  dueAt?: number // optional reminder time
  addedBy: PartnerKey
  place?: Place // optional location — Food todos with a place are the dots on the Map screen
  createdAt: number
  updatedAt: number
}

/** One per day (id = ISO yyyy-mm-dd). A 1–5 mood + note per partner. Never deleted. */
export interface DailyMoodCheck {
  id: string
  moodA?: number
  moodB?: number
  noteA?: string
  noteB?: string
  createdAt: number
  updatedAt: number
}

/** A note that stays locked until unlockAt, then reveals (and pushes a notification). */
export interface SealedNote {
  id: string
  fromPartner: PartnerKey
  title?: string
  body: string
  unlockAt: number
  createdAt: number
  updatedAt: number
}

/**
 * A "thinking of you" ping, kept as synced history so a cleared notification isn't lost.
 * Immutable once created (`updatedAt === createdAt`), so per-record LWW is always a no-op.
 */
export interface ThinkingPing {
  id: string
  fromPartner: PartnerKey
  message: string
  createdAt: number
  updatedAt: number
}

// ── Sync wire types (shared in spirit with the /api serverless functions) ──────
export interface NotifPrefs {
  quietHoursStart: number
  quietHoursEnd: number
  weekendNudge: boolean
  anniversaryReminder: boolean
  partnerActivity: boolean
}

export type SyncTable = 'bucketItems' | 'todos' | 'todoGroups' | 'sealedNotes' | 'pets' | 'thinkingPings'

export interface Tombstone {
  id: string // the deleted row's id
  table: SyncTable
  deletedAt: number
}

export interface PushSub {
  deviceId: string
  partner: PartnerKey
  endpoint: string
  p256dh: string
  auth: string
  updatedAt: number
}

/** One claimed slot in a couple space — which physical device owns partner A or B. */
export interface CoupleMember {
  deviceId: string
  joinedAt: number
}

export type PetSpecies = 'chicken' | 'sheep' | 'pig' | 'cow' | 'llama'

/** A shared virtual pet (the couple can keep up to 3). Stats are stored as a snapshot at `statsAt`
 *  and decayed forward in time on read, so both phones compute the same value. */
export interface Pet {
  id: string
  name: string
  species: PetSpecies
  bornAt: number // when adopted — drives the growth stage (egg → baby → kid → adult)
  fullness: number // 0–100, drifts down (hunger)
  happiness: number // 0–100, drifts down
  energy: number // 0–100, regenerates over time (rest)
  statsAt: number // epoch ms the three stats above were last settled
  createdAt: number
  updatedAt: number
}

/** The single JSON document stored per couple in Upstash (keyed by coupleSpaceCode). */
export interface SyncDoc {
  version: number
  updatedAt: number
  /** Slot ownership: a code holds at most two devices (A and B). Server-owned. */
  members?: { A?: CoupleMember; B?: CoupleMember }
  couple: Couple | null
  pets: Pet[]
  notifPrefs: NotifPrefs | null
  notifPrefsUpdatedAt: number
  bucketItems: BucketItem[]
  todos: Todo[]
  todoGroups: TodoGroup[]
  sealedNotes: SealedNote[]
  thinkingPings: ThinkingPing[]
  dailyMoodChecks: DailyMoodCheck[]
  tombstones: Tombstone[]
  subscriptions: PushSub[]
  remindersSent: string[] // dedupe keys so the cron never double-sends
}

/** What a client pushes — the server owns version/updatedAt/remindersSent. */
export type SyncSnapshot = Pick<
  SyncDoc,
  | 'couple'
  | 'pets'
  | 'notifPrefs'
  | 'notifPrefsUpdatedAt'
  | 'bucketItems'
  | 'todos'
  | 'todoGroups'
  | 'sealedNotes'
  | 'thinkingPings'
  | 'dailyMoodChecks'
  | 'tombstones'
  | 'subscriptions'
>
