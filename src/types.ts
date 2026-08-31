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

// ── Routines (an activity that repeats over many days) ─────────────────────────
/** How often a routine comes back around. */
export type RoutineFreq = 'daily' | 'weekly' | 'monthly'

/**
 * The repeat rule that turns a one-off activity into a routine. Days are plain ISO `yyyy-mm-dd`
 * keys and the time is a local `HH:mm` wall-clock string, never absolute instants, so the same
 * rule means the same thing on both phones AND inside the serverless cron, which only knows the
 * couple's stored `tzOffsetMinutes`. Occurrences are derived on read (see `lib/recurrence.ts`);
 * nothing is ever materialised into extra rows.
 */
export interface Routine {
  freq: RoutineFreq
  interval: number // every N days / weeks / months (≥ 1)
  weekdays?: number[] // weekly only: 0=Sun to 6=Sat (defaults to the start day's weekday)
  startDate: string // ISO yyyy-mm-dd, the first day it can happen
  time?: string // 'HH:mm' local wall-clock for the nudge (absent = all-day, no push)
  until?: string | null // ISO yyyy-mm-dd, inclusive last day (absent/null = keeps going)
  count?: number | null // stop after N occurrences (absent/null = no limit)
  /**
   * Switched off: it stops coming around (no calendar days, no nudges, not due today) but keeps its
   * rule and its whole tick history, so switching it back on resumes rather than restarts. Absent
   * means running, so every routine that existed before this field stays exactly as it was.
   */
  paused?: boolean
  /**
   * The day it was switched off (ISO yyyy-mm-dd). A pause ends the series HERE rather than erasing
   * it: days before this one still happened, so they stay on the calendar with whatever was ticked
   * on them, and only this day onwards stops being expected.
   */
  pausedAt?: string
  /**
   * One-off days this routine also happens on (ISO yyyy-mm-dd), added by hand from the calendar.
   *
   * The rule stays untouched, which is the point: putting a Tuesday routine on one Thursday must not
   * move every other Tuesday or renumber the occurrences that `count` and the progress figures are
   * built on. These days sit OUTSIDE the counted series, so they ignore `until` and `count` (a person
   * said this day explicitly) but a switched-off routine still shows nothing.
   */
  extraDates?: string[]
}

/**
 * One occurrence's state. `at` is per-day, so the merge can union two phones' ticks instead of
 * last-write-wins clobbering them, so both partners can check off different days while offline.
 */
export interface RoutineTick {
  done: boolean
  at: number // epoch ms this tick was last flipped
  by: PartnerKey
}

/** occurrence day (ISO yyyy-mm-dd) → its tick. Rides inside the synced Todo record. */
export type RoutineLog = Record<string, RoutineTick>

export interface Todo {
  id: string
  title: string
  note?: string // optional description / details
  category: string // a TodoGroup id (built-in key or a custom group id)
  done: boolean
  doneAt?: number
  dueAt?: number // optional reminder time (one-off; a routine carries its own time instead)
  addedBy: PartnerKey
  place?: Place // optional location — Food todos with a place are the dots on the Map screen
  routine?: Routine // present → this is a repeating activity (a "routine")
  routineLog?: RoutineLog // per-occurrence ticks; merged per day, not last-write-wins
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
