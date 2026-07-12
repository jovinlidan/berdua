// Couple-chosen accent. Tailwind v4 utilities reference --color-coral via var(), so
// overriding it at runtime re-tints the whole app. Stored on couple.themeAccent (synced).
export interface Accent {
  key: string
  label: string
  coral: string
  deep: string
}

export const ACCENTS: Accent[] = [
  { key: 'coral', label: 'Coral', coral: '#e8927c', deep: '#d87862' },
  { key: 'rose', label: 'Rose', coral: '#e07a9b', deep: '#c9628a' },
  { key: 'sunset', label: 'Sunset', coral: '#e8915f', deep: '#d2724e' },
  { key: 'honey', label: 'Honey', coral: '#e0a93f', deep: '#c8902a' },
  { key: 'forest', label: 'Forest', coral: '#6f9c7d', deep: '#588268' },
  { key: 'ocean', label: 'Ocean', coral: '#5f9ea0', deep: '#4d8587' },
  { key: 'sky', label: 'Sky', coral: '#6f93d9', deep: '#577ac4' },
  { key: 'berry', label: 'Berry', coral: '#a86fae', deep: '#8c5792' },
  { key: 'lavender', label: 'Lavender', coral: '#9d8ec9', deep: '#8273b3' },
]

export function resolveAccent(value?: string | null): Accent {
  const v = value?.toLowerCase()
  return ACCENTS.find((a) => a.key === v || a.coral === v) ?? ACCENTS[0]
}

export function applyAccent(value?: string | null): void {
  const a = resolveAccent(value)
  const root = document.documentElement
  root.style.setProperty('--color-coral', a.coral)
  root.style.setProperty('--color-coral-deep', a.deep)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', a.coral)
}

// ── Light / dark mode (per-device) ───────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'auto'

export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return mode
}

/** Sets data-theme on <html> — the dark palette overrides live in index.css under [data-theme='dark']. */
export function applyMode(mode: ThemeMode): void {
  const resolved = resolveMode(mode)
  document.documentElement.dataset.theme = resolved
  // keep the bare <html> bg in sync (matches the pre-paint inline script in index.html)
  document.documentElement.style.backgroundColor = resolved === 'dark' ? '#211c1a' : '#fff6f0'
}
