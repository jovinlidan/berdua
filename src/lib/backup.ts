// Export/import all text data as a JSON file. Photos are excluded (kept on-device / in sync).
import { db } from '../db/database'
import { notifyChange } from '../sync/bus'

export async function exportBackup(): Promise<void> {
  const [couple, bucketItems, todos, todoGroups, sealedNotes] = await Promise.all([
    db.couples.get('couple'),
    db.bucketItems.toArray(),
    db.todos.toArray(),
    db.todoGroups.toArray(),
    db.sealedNotes.toArray(),
  ])
  const data = {
    berdua: 'backup' as const,
    version: 2,
    exportedAt: Date.now(),
    couple,
    bucketItems,
    todos,
    todoGroups,
    sealedNotes,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `berdua-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File): Promise<void> {
  const data = JSON.parse(await file.text())
  if (data?.berdua !== 'backup') throw new Error('Not a Berdua backup file')
  await db.transaction('rw', [db.couples, db.bucketItems, db.todos, db.todoGroups, db.sealedNotes], async () => {
    if (data.couple) await db.couples.put(data.couple)
    if (Array.isArray(data.bucketItems)) await db.bucketItems.bulkPut(data.bucketItems)
    if (Array.isArray(data.todos)) await db.todos.bulkPut(data.todos)
    if (Array.isArray(data.todoGroups)) await db.todoGroups.bulkPut(data.todoGroups)
    if (Array.isArray(data.sealedNotes)) await db.sealedNotes.bulkPut(data.sealedNotes)
  })
  notifyChange()
}
