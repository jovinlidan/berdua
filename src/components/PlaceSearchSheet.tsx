// Add or re-pin a place by typing its name (Mapbox Search Box), tapping a result, naming it, saving.
// Falls back to "pin my current spot" (works even with no Mapbox token — address just stays blank).
import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Link2, LocateFixed, MapPin, Search } from 'lucide-react'
import { addFoodPlace, setTodoPlace } from '../db/repo'
import { haversineKm, HOME_CENTER, HOME_CITY } from '../lib/geo'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { openGmapsSearch } from '../lib/navlinks'
import { resolveGmapsLink, resolveSuggestion, reversePlace, searchPlaces, type Suggestion } from '../lib/places'
import { useSession } from '../store/useSession'
import type { Place, Todo } from '../types'
import { BottomSheet } from './BottomSheet'

export function PlaceSearchSheet({
  open,
  onClose,
  todo,
  userLocation,
}: {
  open: boolean
  onClose: () => void
  todo?: Todo
  userLocation?: { lat: number; lng: number } | null
}) {
  const t = useT()
  const { activePartner } = useSession()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<Place | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [resolvingLink, setResolvingLink] = useState(false)
  const [linkError, setLinkError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSuggestions([])
    setSearching(false)
    setPicked(todo?.place ?? null)
    setTitle(todo?.title ?? todo?.place?.name ?? '')
    setBusy(false)
    setLinkInput('')
    setResolvingLink(false)
    setLinkError('')
  }, [open, todo])

  // Debounced suggest as the user types. All state updates happen inside the timeout (async),
  // never synchronously in the effect body.
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const q = query.trim()
      if (q.length < 2) {
        setSuggestions([])
        setSearching(false)
        return
      }
      setSearching(true)
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      searchPlaces(q, ac.signal)
        .then((res) => setSuggestions(res))
        .catch(() => {
          /* aborted or network — ignore */
        })
        .finally(() => setSearching(false))
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open])

  async function pick(s: Suggestion) {
    setBusy(true)
    try {
      const place = await resolveSuggestion(s)
      if (place) {
        setPicked(place)
        if (!todo) setTitle(place.name)
        setSuggestions([])
        setQuery('')
      }
    } finally {
      setBusy(false)
    }
  }

  async function useCurrent() {
    if (!userLocation) return
    setBusy(true)
    try {
      const place = await reversePlace(userLocation.lat, userLocation.lng)
      setPicked(place)
      if (!todo && place.name) setTitle(place.name)
    } finally {
      setBusy(false)
    }
  }

  // Resolve a pasted Google Maps share link into a place.
  async function resolveLink() {
    const link = linkInput.trim()
    if (!link) return
    setResolvingLink(true)
    setLinkError('')
    try {
      const place = await resolveGmapsLink(link)
      if (place && haversineKm(HOME_CENTER, place) > 5000) {
        // a resolve this far from home is wrong (e.g. the server's region leaked through) — don't pin it
        setLinkError(t('That link resolved far outside your area — open it in Google Maps and copy the link again'))
      } else if (place) {
        setPicked(place)
        if (!todo && place.name) setTitle(place.name)
        setLinkInput('')
      } else {
        setLinkError(t("Couldn't read that — long-press the spot in Google Maps and paste its coordinates"))
      }
    } catch {
      setLinkError(t("Couldn't read that — long-press the spot in Google Maps and paste its coordinates"))
    } finally {
      setResolvingLink(false)
    }
  }

  // What the "Search in Google Maps" button looks up: the item's title (or typed query) + home city.
  const gmapsQuery = [todo?.title || query.trim(), HOME_CITY].filter(Boolean).join(' ')

  const canSave = !!picked && title.trim().length > 0

  async function save() {
    if (!picked || !canSave) return
    const place: Place = { ...picked, name: title.trim() }
    if (todo) await setTodoPlace(todo.id, place)
    else await addFoodPlace({ place, title: title.trim(), addedBy: activePartner })
    haptic(8)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={todo ? t('Pin a place') : t('Add a food spot')}>
      <div className="space-y-4">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/70" />
          <input
            className="field pl-10"
            placeholder={t('Search a place by name…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {userLocation && (
          <button type="button" className="btn-soft w-full" onClick={useCurrent} disabled={busy}>
            <LocateFixed size={18} /> {t('Pin my current spot')}
          </button>
        )}

        {searching && <p className="px-1 text-sm text-ink-soft">{t('Searching…')}</p>}

        {suggestions.length > 0 && (
          <ul className="space-y-1.5">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  disabled={busy}
                  className="flex w-full items-start gap-3 rounded-2xl bg-cream-deep p-3 text-left active:scale-[0.99]"
                >
                  <MapPin size={18} className="mt-0.5 shrink-0 text-coral" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{s.name}</span>
                    {s.address && <span className="block truncate text-xs text-ink-soft">{s.address}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Card-free Google route: open Google Maps with the title pre-filled, then paste the link back. */}
        <div className="space-y-2 rounded-2xl bg-cream-deep/50 p-3">
          <p className="text-xs font-bold text-ink-soft">{t("Can't find it? Use Google Maps")}</p>
          <button
            type="button"
            className="btn-soft w-full !justify-start"
            onClick={() => openGmapsSearch(gmapsQuery || HOME_CITY)}
          >
            <ExternalLink size={16} />
            {gmapsQuery ? t("Search '{q}' in Google Maps", { q: gmapsQuery }) : t('Open Google Maps')}
          </button>
          <div className="flex gap-2">
            <input
              className="field flex-1"
              placeholder={t('Paste a link or coordinates')}
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
            />
            <button
              type="button"
              aria-label={t('Pin from link')}
              className="btn-primary shrink-0 !px-4"
              disabled={!linkInput.trim() || resolvingLink}
              onClick={resolveLink}
            >
              <Link2 size={16} /> {resolvingLink ? t('Reading…') : t('Pin')}
            </button>
          </div>
          <p className="text-[11px] leading-snug text-ink-soft/80">
            {t('Tip: in Google Maps, long-press the spot → tap the coordinates to copy → paste them here.')}
          </p>
          {linkError && <p className="text-xs text-coral-deep">{linkError}</p>}
        </div>

        {picked && (
          <div className="space-y-3 rounded-2xl bg-coral/10 p-3 ring-1 ring-coral/20">
            <div className="flex items-start gap-2.5">
              <span className="text-xl">📍</span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{picked.name || t('Dropped pin')}</p>
                {picked.address && <p className="truncate text-xs text-ink-soft">{picked.address}</p>}
              </div>
            </div>
            <input
              className="field"
              placeholder={t('Name this spot…')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        )}

        <button type="button" className="btn-primary w-full" disabled={!canSave || busy} onClick={save}>
          {todo ? t('Save place') : t('Add to our map')}
        </button>
      </div>
    </BottomSheet>
  )
}
