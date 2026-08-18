import Dexie, { type Table } from 'dexie'
import type {
  BucketItem,
  Couple,
  DailyMoodCheck,
  Pet,
  SealedNote,
  Secret,
  ThinkingPing,
  Todo,
  TodoGroup,
  Tombstone,
} from '../types'

// Local-first store. Everything behind db lives in IndexedDB and works fully offline.
// The repository (repo.ts) is the only writer; components read via the reactive hooks.
export class BerduaDB extends Dexie {
  couples!: Table<Couple, string>
  pets!: Table<Pet, string>
  bucketItems!: Table<BucketItem, string>
  todos!: Table<Todo, string>
  sealedNotes!: Table<SealedNote, string>
  dailyMoodChecks!: Table<DailyMoodCheck, string>
  secrets!: Table<Secret, string>
  todoGroups!: Table<TodoGroup, string>
  thinkingPings!: Table<ThinkingPing, string>
  tombstones!: Table<Tombstone, string>

  constructor() {
    super('berdua')
    this.version(1).stores({
      couples: 'id',
      dateIdeas: 'id, status, category, createdAt',
      plannedDates: 'id, dateIdeaId, scheduledAt',
      bucketItems: 'id, isComplete, createdAt',
      memories: 'id, sourceId, occurredOn, createdAt',
    })
    // v2: add updatedAt (for sync LWW) + a tombstones table (so deletes propagate).
    this.version(2)
      .stores({
        couples: 'id',
        dateIdeas: 'id, status, category, createdAt, updatedAt',
        plannedDates: 'id, dateIdeaId, scheduledAt, updatedAt',
        bucketItems: 'id, isComplete, createdAt, updatedAt',
        memories: 'id, sourceId, occurredOn, createdAt, updatedAt',
        tombstones: 'id, table',
      })
      .upgrade(async (tx) => {
        for (const name of ['couples', 'dateIdeas', 'plannedDates', 'bucketItems', 'memories']) {
          await tx
            .table(name)
            .toCollection()
            .modify((row: { createdAt?: number; updatedAt?: number }) => {
              row.updatedAt ??= row.createdAt ?? Date.now()
            })
        }
      })
    // v3: shared to-do list. (no boolean index — IndexedDB can't key on booleans)
    this.version(3).stores({
      todos: 'id, dueAt, createdAt, updatedAt',
    })
    // v4: time-capsule notes.
    this.version(4).stores({
      sealedNotes: 'id, unlockAt, createdAt, updatedAt',
    })
    // v5: to-do categories (backfill existing rows).
    this.version(5)
      .stores({ todos: 'id, category, dueAt, createdAt, updatedAt' })
      .upgrade(async (tx) => {
        await tx
          .table('todos')
          .toCollection()
          .modify((row: { category?: string }) => {
            row.category ??= 'other'
          })
      })
    // v6: daily question + daily mood check-in (id = ISO date).
    this.version(6).stores({
      dailyQuestions: 'id, createdAt, updatedAt',
      dailyMoodChecks: 'id, createdAt, updatedAt',
    })
    // v7: Daily Question feature removed — drop its table (link fields need no index).
    this.version(7).stores({
      dailyQuestions: null,
    })
    // v8: local-only private "secrets" (never synced).
    this.version(8).stores({
      secrets: 'id, owner, createdAt, updatedAt',
    })
    // v9: custom to-do categories (synced).
    this.version(9).stores({
      todoGroups: 'id, order, createdAt, updatedAt',
    })
    // v10: reset to the new default categories (Food/Movie/Game/Travel). Clears groups so
    // ensureDefaultTodoGroups reseeds; custom groups are re-added on next sync if synced.
    this.version(10)
      .stores({ todoGroups: 'id, order, createdAt, updatedAt' })
      .upgrade(async (tx) => {
        await tx.table('todoGroups').clear()
      })
    // v11: the couple's shared virtual pet (synced singleton, id='pet').
    this.version(11).stores({ pets: 'id, updatedAt' })
    // v12: removed the Date Ideas + Memories features — drop their stores.
    this.version(12).stores({ dateIdeas: null, plannedDates: null, memories: null })
    // v13: "thinking of you" ping history (synced collection). Additive — no upgrade needed.
    this.version(13).stores({ thinkingPings: 'id, createdAt, fromPartner, updatedAt' })
    // v14: optional place location on Food todos (Todo.place). Payload-only field — no new index
    // and no .upgrade() (existing rows just read place === undefined). Re-declared with the EXISTING
    // index string purely to advance the schema version; IndexedDB stores the new field transparently.
    this.version(14).stores({ todos: 'id, category, dueAt, createdAt, updatedAt' })
    // v15: routines. A repeat rule (Todo.routine) plus its per-occurrence ticks (Todo.routineLog).
    // Both are payload-only (an object and a map can't be indexed anyway), so this mirrors v14:
    // the index string is unchanged and the bump only records the shape change. Existing rows read
    // routine === undefined and stay plain one-off to-dos.
    this.version(15).stores({ todos: 'id, category, dueAt, createdAt, updatedAt' })
  }
}

export const db = new BerduaDB()
