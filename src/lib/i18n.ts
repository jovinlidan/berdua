// Lightweight i18n. The KEY is the English copy itself, so English needs no dictionary and a
// missing translation always falls back to readable English (never a blank or "missing.key").
// A second language is just an English→translated map. Interpolate with {token} placeholders.
import { id as idLocale } from 'date-fns/locale/id'
import type { Locale } from 'date-fns'
import { useSession } from '../store/useSession'
import { ID } from './i18n.id'

export type Lang = 'en' | 'id'
export const LANGS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' },
]

const DICT: Record<Lang, Record<string, string>> = { en: {}, id: ID }

export type TParams = Record<string, string | number>

/** Resolve a string for a language, falling back to the English key, then apply {token} params. */
export function translate(lang: Lang, key: string, params?: TParams): string {
  let out = (lang !== 'en' && DICT[lang]?.[key]) || key
  if (params) for (const k of Object.keys(params)) out = out.split(`{${k}}`).join(String(params[k]))
  return out
}

/** Detect the device's preferred language (used as the first-run default). */
export function detectLang(): Lang {
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('id')) return 'id'
  return 'en'
}

/** date-fns locale for the active language (English uses the built-in default → undefined). */
export const localeFor = (lang: Lang): Locale | undefined => (lang === 'id' ? idLocale : undefined)
export const activeDateLocale = (): Locale | undefined => localeFor(useSession.getState().lang)

/** Reactive translator hook — components re-render when the language changes. */
export const useT = () => {
  const lang = useSession((s) => s.lang)
  return (key: string, params?: TParams) => translate(lang, key, params)
}

/** Non-reactive translate for use outside React (e.g. date helpers). Reads the current language. */
export const tNow = (key: string, params?: TParams) => translate(useSession.getState().lang, key, params)
