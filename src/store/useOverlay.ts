import { create } from 'zustand'

interface OverlayState {
  /** How many modal overlays (bottom sheets) are currently up. */
  open: number
  push: () => void
  pop: () => void
}

/**
 * Tracks whether a modal is on screen, so always-running decorative motion can stand down while
 * one is open. A sheet's spring wants the whole main thread for its ~300ms, and nobody is watching
 * the roaming pet from behind a scrim.
 */
export const useOverlay = create<OverlayState>((set) => ({
  open: 0,
  push: () => set((s) => ({ open: s.open + 1 })),
  pop: () => set((s) => ({ open: Math.max(0, s.open - 1) })),
}))
