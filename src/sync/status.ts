import { create } from 'zustand'

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'offline'

interface SyncStatusState {
  status: SyncStatus
  lastSyncedAt: number | null
  set: (status: SyncStatus) => void
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  set: (status) =>
    set((s) => ({ status, lastSyncedAt: status === 'ok' ? Date.now() : s.lastSyncedAt })),
}))
