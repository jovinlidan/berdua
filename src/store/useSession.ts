import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Lang } from '../lib/i18n'
import { getDeviceId } from '../lib/id'
import type { ThemeMode } from '../lib/theme'
import { notifyChange } from '../sync/bus'
import type { NotifPrefs, PartnerKey, PushSub } from '../types'

// First-run default: follow the phone's language (type-only import of Lang avoids an i18n cycle).
const detectLang = (): Lang =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en'

interface SessionState {
  /** Phase 1: which of the two of you is currently "acting" on this shared device. */
  activePartner: PartnerKey
  setActivePartner: (p: PartnerKey) => void

  notifPrefs: NotifPrefs
  notifPrefsUpdatedAt: number
  setNotifPrefs: (p: Partial<NotifPrefs>) => void

  /** Stable per-device id + this device's push subscription (synced so the cron can reach it). */
  deviceId: string
  pushSub: PushSub | null
  setPushSub: (s: PushSub | null) => void

  /** Per-device light/dark preference (NOT synced — each phone its own). */
  themeMode: ThemeMode
  setThemeMode: (m: ThemeMode) => void

  /** Per-device UI language (NOT synced — each phone its own). */
  lang: Lang
  setLang: (l: Lang) => void

  /** Hashed PIN for the local Secret space (per-device, never synced). null = no lock. */
  secretPin: string | null
  setSecretPin: (hash: string | null) => void

  /** Collapsed to-do category ids (per-device UI state). */
  collapsedTodoGroups: string[]
  toggleTodoGroupCollapsed: (id: string) => void

  /** Newest received "thinking of you" ping this device has seen (per-device, drives the unread dot). */
  lastSeenThinkingAt: number
  setLastSeenThinking: (ts: number) => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      activePartner: 'A',
      setActivePartner: (p) => set({ activePartner: p }),

      notifPrefs: {
        quietHoursStart: 22,
        quietHoursEnd: 8,
        weekendNudge: true,
        anniversaryReminder: true,
        partnerActivity: true,
      },
      notifPrefsUpdatedAt: 0,
      setNotifPrefs: (p) => {
        set((s) => ({ notifPrefs: { ...s.notifPrefs, ...p }, notifPrefsUpdatedAt: Date.now() }))
        notifyChange()
      },

      deviceId: getDeviceId(),
      pushSub: null,
      setPushSub: (s) => {
        set({ pushSub: s })
        notifyChange()
      },

      themeMode: 'light',
      setThemeMode: (m) => set({ themeMode: m }),

      lang: detectLang(),
      setLang: (l) => set({ lang: l }),

      secretPin: null,
      setSecretPin: (hash) => set({ secretPin: hash }),

      collapsedTodoGroups: [],
      toggleTodoGroupCollapsed: (id) =>
        set((s) => ({
          collapsedTodoGroups: s.collapsedTodoGroups.includes(id)
            ? s.collapsedTodoGroups.filter((x) => x !== id)
            : [...s.collapsedTodoGroups, id],
        })),

      lastSeenThinkingAt: 0,
      setLastSeenThinking: (ts) =>
        set((s) => (ts > s.lastSeenThinkingAt ? { lastSeenThinkingAt: ts } : s)),
    }),
    { name: 'berdua-session' },
  ),
)
