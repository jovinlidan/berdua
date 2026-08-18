// The only writer to the local store. UI calls these; reads happen via hooks.ts.
// Every mutation stamps updatedAt and pings the sync bus; deletes leave a tombstone
// so the change propagates to the other phone in phase-2 sync.
import { todayIso } from '../lib/dates'
import { newId } from '../lib/id'
import { MAX_PETS, type PetAction, applyAction } from '../lib/pet'
import { normalizeRoutine, routineActiveKey, toggleTickIn } from '../lib/recurrence'
import { notifyChange } from '../sync/bus'
import type {
  BucketItem,
  Couple,
  LinkSource,
  PartnerKey,
  Pet,
  PetSpecies,
  Place,
  Routine,
  SyncTable,
  Todo,
  TodoGroup,
  WishLevel,
} from '../types'
import { TODO_CATEGORIES, TODO_CATEGORY_ORDER } from '../lib/taxonomy'
import { db } from './database'

const now = () => Date.now()
const tzOffset = () => -new Date().getTimezoneOffset() // minutes east of UTC

/** Record a deletion so sync removes it on the other device too. Call inside a txn that includes db.tombstones. */
async function tombstone(table: SyncTable, id: string) {
  await db.tombstones.put({ id, table, deletedAt: now() })
}

// ── Couple ─────────────────────────────────────────────────────────────────
export const COUPLE_ID = 'couple' as const

export async function getCouple(): Promise<Couple | undefined> {
  return db.couples.get(COUPLE_ID)
}

// Couples are created by pairing (see `joinCouple` in sync/sync.ts), not written directly here.
export async function updateCouple(patch: Partial<Omit<Couple, 'id'>>): Promise<void> {
  await db.couples.update(COUPLE_ID, { tzOffsetMinutes: tzOffset(), ...patch, updatedAt: now() })
  notifyChange()
}

// ── Pets (shared, synced — up to MAX_PETS) ─────────────────────────────────────
export async function getPets(): Promise<Pet[]> {
  return db.pets.toArray()
}

/** Adopt a new pet (capped at MAX_PETS). Starts as an egg with comfortable stats. Returns its id. */
export async function adoptPet(input: { name: string; species: PetSpecies }): Promise<string | null> {
  const id = newId()
  const t = now()
  const created = await db.transaction('rw', db.pets, async () => {
    if ((await db.pets.count()) >= MAX_PETS) return null
    await db.pets.add({
      id,
      name: input.name.trim() || 'Buddy',
      species: input.species,
      bornAt: t,
      fullness: 80,
      happiness: 80,
      energy: 90,
      statsAt: t,
      createdAt: t,
      updatedAt: t,
    })
    return id
  })
  if (created) notifyChange()
  return created
}

/** Feed / play / pet a specific pet — settles decay then bumps the right stats (logic in lib/pet). */
export async function carePet(id: string, action: PetAction): Promise<void> {
  await db.transaction('rw', db.pets, async () => {
    const pet = await db.pets.get(id)
    if (!pet) return
    await db.pets.put(applyAction(pet, action, now()))
  })
  notifyChange()
}

export async function renamePet(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await db.pets.update(id, { name: trimmed, updatedAt: now() })
  notifyChange()
}

/** Release a pet back to the wild (frees a slot). Tombstoned so it disappears on both phones. */
export async function releasePet(id: string): Promise<void> {
  await db.transaction('rw', db.pets, db.tombstones, async () => {
    await db.pets.delete(id)
    await tombstone('pets', id)
  })
  notifyChange()
}

// ── Bucket list ────────────────────────────────────────────────────────────────
export async function addBucket(input: {
  title: string
  note?: string
  wishLevel: WishLevel
  addedBy: PartnerKey
  link?: string
  linkSource?: LinkSource
  linkThumb?: string
}): Promise<string> {
  const id = newId()
  await db.bucketItems.add({ id, isComplete: false, createdAt: now(), updatedAt: now(), ...input })
  notifyChange()
  return id
}

export async function updateBucket(id: string, patch: Partial<BucketItem>): Promise<void> {
  await db.bucketItems.update(id, { ...patch, updatedAt: now() })
  notifyChange()
}

export async function deleteBucket(id: string): Promise<void> {
  await db.transaction('rw', db.bucketItems, db.tombstones, async () => {
    await db.bucketItems.delete(id)
    await tombstone('bucketItems', id)
  })
  notifyChange()
}

/** Check off a dream as done together. */
export async function completeBucketItem(id: string): Promise<void> {
  await db.bucketItems.update(id, { isComplete: true, completedAt: now(), updatedAt: now() })
  notifyChange()
}

export async function uncompleteBucketItem(id: string): Promise<void> {
  await db.bucketItems.update(id, { isComplete: false, completedAt: undefined, updatedAt: now() })
  notifyChange()
}

// ── To-dos (shared checklist) ──────────────────────────────────────────────────
export async function addTodo(input: {
  title: string
  note?: string
  category: string
  addedBy: PartnerKey
  dueAt?: number
  routine?: Routine
}): Promise<string> {
  const id = newId()
  const routine = input.routine ? normalizeRoutine(input.routine) : undefined
  await db.todos.add({
    id,
    title: input.title,
    note: input.note?.trim() || undefined,
    category: input.category,
    done: false,
    // A routine carries its own schedule, so it never also holds a one-off `dueAt`, which would
    // notify twice for the same activity (see api/_lib/reminders.ts).
    dueAt: routine ? undefined : input.dueAt,
    addedBy: input.addedBy,
    routine,
    createdAt: now(),
    updatedAt: now(),
  })
  notifyChange()
  return id
}

export async function updateTodo(id: string, patch: Partial<Todo>): Promise<void> {
  await db.todos.update(id, { ...patch, updatedAt: now() })
  notifyChange()
}

// ── To-do places (the dots on the Map screen) ──────────────────────────────────
/** Attach or replace the place a to-do is pinned to. Rides along in the synced Todo record. */
export async function setTodoPlace(id: string, place: Place): Promise<void> {
  await updateTodo(id, { place })
}

/** Unpin a to-do from its place (the to-do itself stays). */
export async function clearTodoPlace(id: string): Promise<void> {
  await updateTodo(id, { place: undefined })
}

/** Create a Food to-do already pinned to a place (the Map "add a spot" flow). */
export async function addFoodPlace(input: {
  place: Place
  title?: string
  addedBy: PartnerKey
  foodCategoryId?: string
}): Promise<string> {
  const id = newId()
  const t = now()
  await db.todos.add({
    id,
    title: (input.title?.trim() || input.place.name).trim(),
    category: input.foodCategoryId ?? 'food',
    done: false,
    addedBy: input.addedBy,
    place: input.place,
    createdAt: t,
    updatedAt: t,
  })
  notifyChange()
  return id
}

export interface PlaceImport {
  name: string // venue name → the to-do title + place.name
  area?: string // neighbourhood/city label → folded into the note
  lat: number
  lng: number
  address?: string
}

export interface ImportFoodPlacesResult {
  added: number // new located food to-dos created
  updated: number // existing same-title food to-dos that gained/moved a place
  skipped: number // blank/invalid rows, or a match already pinned to this exact spot
  ids: string[]
}

/**
 * Seed/enrich Food to-dos with locations. Idempotent UPSERT keyed on title (case-insensitive,
 * trimmed) within the Food category: an existing match gets its `place` set; otherwise a new
 * located food to-do is created. Re-running never duplicates. One notifyChange() per batch.
 */
export async function importFoodPlaces(
  rows: PlaceImport[],
  addedBy: PartnerKey = 'A',
  foodCategoryId = 'food',
): Promise<ImportFoodPlacesResult> {
  const result: ImportFoodPlacesResult = { added: 0, updated: 0, skipped: 0, ids: [] }
  if (rows.length === 0) return result

  await db.transaction('rw', db.todos, async () => {
    const existing = await db.todos.where('category').equals(foodCategoryId).toArray()
    const byTitle = new Map(existing.map((row) => [row.title.trim().toLowerCase(), row]))
    const t = now()

    for (const row of rows) {
      const title = row.name.trim()
      if (!title || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) {
        result.skipped++
        continue
      }
      const place: Place = { name: title, lat: row.lat, lng: row.lng, address: row.address?.trim() || undefined }
      const match = byTitle.get(title.toLowerCase())
      if (match) {
        if (match.place && match.place.lat === place.lat && match.place.lng === place.lng) {
          result.skipped++ // already pinned to this exact spot — nothing to do
          continue
        }
        await db.todos.update(match.id, { place, updatedAt: t })
        result.updated++
        result.ids.push(match.id)
      } else {
        const id = newId()
        const todo: Todo = {
          id,
          title,
          note: row.area?.trim() || undefined,
          category: foodCategoryId,
          done: false,
          addedBy,
          place,
          createdAt: t,
          updatedAt: t,
        }
        await db.todos.add(todo)
        byTitle.set(title.toLowerCase(), todo)
        result.added++
        result.ids.push(id)
      }
    }
  })

  if (result.added > 0 || result.updated > 0) notifyChange()
  return result
}

/**
 * Check a to-do off. A ROUTINE is never "done" as a whole. One tap ticks the occurrence it's
 * currently standing on instead (today's, or the nearest one; see `routineActiveKey`), so the
 * activity keeps coming back and `clearDoneTodos` never sweeps it away.
 */
export async function toggleTodo(id: string, by: PartnerKey = 'A'): Promise<void> {
  await db.transaction('rw', db.todos, async () => {
    const t = await db.todos.get(id)
    if (!t) return
    if (t.routine) {
      const key = routineActiveKey(t.routine, todayIso())
      if (!key) return
      await db.todos.update(id, { routineLog: toggleTickIn(t.routineLog, key, by, now()), updatedAt: now() })
      return
    }
    await db.todos.update(id, { done: !t.done, doneAt: !t.done ? now() : undefined, updatedAt: now() })
  })
  notifyChange()
}

// ── Routines (a to-do that repeats over many days) ─────────────────────────────
/**
 * Turn a to-do into a routine (or replace its repeat rule). Clears the one-off reminder, and also
 * `done`: a routine is never finished as a whole, and a `done` routine would be invisible to the
 * reminders and to Home while `clearDoneTodos` quietly deleted it along with its tick history.
 */
export async function setTodoRoutine(id: string, routine: Routine): Promise<void> {
  await updateTodo(id, { routine: normalizeRoutine(routine), dueAt: undefined, done: false, doneAt: undefined })
}

/** Stop repeating. The tick history stays, so re-enabling the routine brings its streak back. */
export async function clearTodoRoutine(id: string): Promise<void> {
  await updateTodo(id, { routine: undefined })
}

/** Tick (or untick) one specific occurrence day, used by the calendar's day detail. */
export async function toggleRoutineOccurrence(id: string, dayKey: string, by: PartnerKey): Promise<void> {
  await db.transaction('rw', db.todos, async () => {
    const t = await db.todos.get(id)
    if (!t?.routine) return
    await db.todos.update(id, { routineLog: toggleTickIn(t.routineLog, dayKey, by, now()), updatedAt: now() })
  })
  notifyChange()
}

export async function deleteTodo(id: string): Promise<void> {
  await db.transaction('rw', db.todos, db.tombstones, async () => {
    await db.todos.delete(id)
    await tombstone('todos', id)
  })
  notifyChange()
}

export async function clearDoneTodos(): Promise<void> {
  await db.transaction('rw', db.todos, db.tombstones, async () => {
    const all = await db.todos.toArray()
    for (const t of all) {
      if (!t.done) continue
      await db.todos.delete(t.id)
      await tombstone('todos', t.id)
    }
  })
  notifyChange()
}

// ── To-do categories (groups) ────────────────────────────────────────────────
const GROUP_TINTS = ['#E8927C', '#7C8A6F', '#D98C5F', '#C99A6B', '#E8B4A0', '#9CA77F', '#9d8ec9', '#6f93d9', '#e07a9b']
let groupGuard: Promise<void> | null = null

/** Seed the 6 built-in categories once (deterministic ids = existing todo.category values). */
export function ensureDefaultTodoGroups(): Promise<void> {
  groupGuard ??= (async () => {
    if ((await db.todoGroups.count()) > 0) return
    const t = now()
    await db.todoGroups.bulkPut(
      TODO_CATEGORY_ORDER.map((key, i) => ({
        id: key,
        label: TODO_CATEGORIES[key].label,
        emoji: TODO_CATEGORIES[key].emoji,
        tint: TODO_CATEGORIES[key].tint,
        order: i,
        createdAt: t,
        updatedAt: t,
      })),
    )
  })()
  return groupGuard
}

export async function addTodoGroup(label: string, emoji = '🏷️'): Promise<string> {
  const id = newId()
  const all = await db.todoGroups.toArray()
  const order = all.reduce((m, g) => Math.max(m, g.order), -1) + 1
  await db.todoGroups.add({
    id,
    label: label.trim(),
    emoji,
    tint: GROUP_TINTS[all.length % GROUP_TINTS.length],
    order,
    createdAt: now(),
    updatedAt: now(),
  })
  notifyChange()
  return id
}

export async function updateTodoGroup(id: string, patch: Partial<TodoGroup>): Promise<void> {
  await db.todoGroups.update(id, { ...patch, updatedAt: now() })
  notifyChange()
}

/** Move a category one slot up/down by swapping its order with the adjacent group. */
export async function moveTodoGroup(id: string, dir: 'up' | 'down'): Promise<void> {
  await db.transaction('rw', db.todoGroups, async () => {
    const all = (await db.todoGroups.toArray()).sort((a, b) => a.order - b.order)
    const i = all.findIndex((g) => g.id === id)
    const j = dir === 'up' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= all.length) return
    await db.todoGroups.update(all[i].id, { order: all[j].order, updatedAt: now() })
    await db.todoGroups.update(all[j].id, { order: all[i].order, updatedAt: now() })
  })
  notifyChange()
}

/** Delete a category. Its to-dos become uncategorised (shown under "Uncategorised"). */
export async function deleteTodoGroup(id: string): Promise<void> {
  await db.transaction('rw', db.todoGroups, db.tombstones, async () => {
    await db.todoGroups.delete(id)
    await tombstone('todoGroups', id)
  })
  notifyChange()
}

// ── Time-capsule notes ─────────────────────────────────────────────────────────
export async function addSealedNote(input: {
  fromPartner: PartnerKey
  title?: string
  body: string
  unlockAt: number
}): Promise<string> {
  const id = newId()
  await db.sealedNotes.add({ id, createdAt: now(), updatedAt: now(), ...input })
  notifyChange()
  return id
}

export async function deleteSealedNote(id: string): Promise<void> {
  await db.transaction('rw', db.sealedNotes, db.tombstones, async () => {
    await db.sealedNotes.delete(id)
    await tombstone('sealedNotes', id)
  })
  notifyChange()
}

// ── "Thinking of you" pings (synced history) ─────────────────────────────────────
/** Record a sent ping. Immutable, so updatedAt = createdAt. Syncs to the partner's history. */
export async function addThinkingPing(fromPartner: PartnerKey, message: string): Promise<string> {
  const id = newId()
  const t = now()
  await db.thinkingPings.add({ id, fromPartner, message: message.trim(), createdAt: t, updatedAt: t })
  notifyChange()
  return id
}

/** Remove one ping from the shared history (tombstoned so it clears on both phones). */
export async function deleteThinkingPing(id: string): Promise<void> {
  await db.transaction('rw', db.thinkingPings, db.tombstones, async () => {
    await db.thinkingPings.delete(id)
    await tombstone('thinkingPings', id)
  })
  notifyChange()
}

// ── Secrets (LOCAL ONLY — never synced, intentionally no notifyChange) ───────────
export async function addSecret(owner: PartnerKey, text: string): Promise<void> {
  await db.secrets.add({ id: newId(), owner, text: text.trim(), done: false, photos: [], createdAt: now(), updatedAt: now() })
}

export async function toggleSecret(id: string): Promise<void> {
  await db.transaction('rw', db.secrets, async () => {
    const s = await db.secrets.get(id)
    if (s) await db.secrets.update(id, { done: !s.done, updatedAt: now() })
  })
}

export async function addSecretPhotos(id: string, blobs: Blob[]): Promise<void> {
  await db.transaction('rw', db.secrets, async () => {
    const s = await db.secrets.get(id)
    if (!s) return
    await db.secrets.update(id, { photos: [...(s.photos ?? []), ...blobs], updatedAt: now() })
  })
}

export async function removeSecretPhoto(id: string, index: number): Promise<void> {
  await db.transaction('rw', db.secrets, async () => {
    const s = await db.secrets.get(id)
    if (!s) return
    await db.secrets.update(id, { photos: (s.photos ?? []).filter((_, i) => i !== index), updatedAt: now() })
  })
}

export async function deleteSecret(id: string): Promise<void> {
  await db.secrets.delete(id)
}

// ── Daily mood check-in ─────────────────────────────────────────────────────────
export async function checkInMood(partner: PartnerKey, mood: number, note?: string): Promise<void> {
  const id = todayIso()
  const trimmed = note?.trim() || undefined
  const patch = partner === 'A' ? { moodA: mood, noteA: trimmed } : { moodB: mood, noteB: trimmed }
  await db.transaction('rw', db.dailyMoodChecks, async () => {
    const existing = await db.dailyMoodChecks.get(id)
    if (existing) await db.dailyMoodChecks.update(id, { ...patch, updatedAt: now() })
    else await db.dailyMoodChecks.add({ id, ...patch, createdAt: now(), updatedAt: now() })
  })
  notifyChange()
}
