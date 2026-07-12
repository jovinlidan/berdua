// Our food map: a full-bleed MapLibre canvas with pin markers, plus a draggable bottom sheet
// listing the same spots ranked by distance. Tap a pin or row → details + one-tap Navigate.
import { useMemo, useState } from 'react'
import { motion, type PanInfo } from 'framer-motion'
import { MapPin, Navigation, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { BottomSheet } from '../components/BottomSheet'
import { PlaceSearchSheet } from '../components/PlaceSearchSheet'
import { PlacesMap, type MapPlace } from '../components/PlacesMap'
import { useToast } from '../components/Toast'
import { SEED_PLACES } from '../data/seedPlaces'
import { useCouple, useLocatedTodos, useTodoGroups, useTodos } from '../db/hooks'
import { clearTodoPlace, importFoodPlaces, setTodoPlace } from '../db/repo'
import { formatDistance, haversineKm, HOME_CENTER, useGeolocation } from '../lib/geo'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { openNavigation } from '../lib/navlinks'
import { resolveSuggestion, searchPlaces } from '../lib/places'
import { useSession } from '../store/useSession'
import type { Todo } from '../types'

// The sheet rests just above the global bottom nav.
const ABOVE_NAV = 'calc(env(safe-area-inset-bottom) + 3.6rem)'
// A pin farther than this from home is a wrong-city fuzzy match, not a real local spot → re-locate it.
const FAR_FROM_HOME_KM = 400
// Only accept an auto-located match within this radius of home.
const ACCEPT_KM = 150

export default function Map() {
  const t = useT()
  const toast = useToast()
  const couple = useCouple()
  const { activePartner } = useSession()
  const located = useLocatedTodos()
  const allTodos = useTodos()
  const groups = useTodoGroups()
  const geo = useGeolocation()
  const userLocation = geo.coords

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editTodo, setEditTodo] = useState<Todo | undefined>()
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // Located todos, ranked by distance from the user when we know where they are.
  const ranked = useMemo(() => {
    const list = (located ?? []).filter((td) => td.place)
    if (!userLocation) return list
    return [...list].sort((a, b) => haversineKm(userLocation, a.place!) - haversineKm(userLocation, b.place!))
  }, [located, userLocation])

  const mapPlaces: MapPlace[] = useMemo(
    () => ranked.map((td) => ({ id: td.id, lat: td.place!.lat, lng: td.place!.lng, title: td.title })),
    [ranked],
  )

  // Which category ids count as "food" — the built-in 'food' plus any custom group that looks like
  // a food list (🍜 emoji or a food/kuliner/makan label), so auto-locate catches a renamed category.
  const foodGroupIds = useMemo(() => {
    const ids = new Set<string>(['food'])
    for (const g of groups ?? []) {
      if (g.emoji === '🍜' || /\b(food|kuliner|makan)\b/i.test(g.label)) ids.add(g.id)
    }
    return ids
  }, [groups])

  // Food items that need locating: no place yet, OR a place that's clearly in the wrong city
  // (a previous fuzzy mis-match) — both get (re)processed by one-tap auto-locate.
  const needsLocating = useMemo(
    () =>
      (allTodos ?? []).filter(
        (td) =>
          foodGroupIds.has(td.category) &&
          !td.done &&
          (!td.place || haversineKm(HOME_CENTER, td.place) > FAR_FROM_HOME_KM),
      ),
    [allTodos, foodGroupIds],
  )

  const selected = ranked.find((td) => td.id === selectedId) ?? null

  if (!couple) return null

  function onHandleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.y < -40) setExpanded(true)
    else if (info.offset.y > 40) setExpanded(false)
  }

  async function importSeed() {
    setImporting(true)
    try {
      await importFoodPlaces(SEED_PLACES, activePartner)
      haptic(10)
    } finally {
      setImporting(false)
    }
  }

  // Geocode each item by its title (keyless, restricted to the home region) and pin it. The pin
  // keeps the wishlist title as its label; coords/address come from the lookup. A match too far
  // from home is rejected; an existing wrong-city pin with no local match is cleared (not left wrong).
  async function autoLocate() {
    const todos = needsLocating
    if (todos.length === 0 || progress) return
    let found = 0
    let cleared = 0
    setProgress({ done: 0, total: todos.length })
    for (let i = 0; i < todos.length; i++) {
      try {
        const results = await searchPlaces(todos[i].title)
        const place = results[0]?.place ?? (results[0] ? await resolveSuggestion(results[0]) : null)
        if (place && haversineKm(HOME_CENTER, place) <= ACCEPT_KM) {
          await setTodoPlace(todos[i].id, { ...place, name: todos[i].title })
          found++
        } else if (todos[i].place) {
          await clearTodoPlace(todos[i].id) // drop a wrong-city pin so it isn't shown in the wrong place
          cleared++
        }
      } catch {
        /* skip titles that don't geocode — they can be pinned manually */
      }
      setProgress({ done: i + 1, total: todos.length })
      await new Promise((r) => setTimeout(r, 200)) // be polite to the geocoder
    }
    setProgress(null)
    haptic(found ? 10 : 4)
    toast(
      found
        ? t('Found {n} of {total} on the map', { n: found, total: todos.length })
        : cleared
          ? t('Removed {n} wrong pin(s) — add them manually', { n: cleared })
          : t('No matches — try renaming or pin manually'),
    )
  }

  return (
    <>
      {/* Full-bleed map — escapes the app's padded phone column. */}
      <div className="fixed inset-0 z-0">
        <PlacesMap
          places={mapPlaces}
          userLocation={userLocation}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            setExpanded(false)
            haptic(6)
          }}
        />
      </div>

      {/* Draggable bottom sheet with the Nearby list. */}
      <motion.section
        className="fixed inset-x-0 z-20 mx-auto flex max-w-md flex-col overflow-hidden rounded-t-[2rem] bg-paper shadow-[0_-10px_40px_-12px_rgba(58,46,43,0.32)]"
        style={{ bottom: ABOVE_NAV }}
        initial={false}
        animate={{ height: expanded ? '72vh' : '34vh' }}
        transition={{ type: 'spring', damping: 34, stiffness: 320 }}
      >
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.18}
          onDragEnd={onHandleDragEnd}
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 cursor-grab pt-3 active:cursor-grabbing"
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-ink/15" />
          <div className="flex items-center justify-between px-5 pb-3 pt-2.5">
            <div>
              <h1 className="font-serif text-xl font-semibold text-ink">{t('Nearby')}</h1>
              <p className="text-xs text-ink-soft">
                {ranked.length ? t('{n} places pinned', { n: ranked.length }) : t('places for the two of you')}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setEditTodo(undefined)
                setAddOpen(true)
              }}
              className="btn-primary !px-4 !py-2.5"
            >
              <Plus size={18} /> {t('Add')}
            </button>
          </div>
        </motion.div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {needsLocating.length > 0 && (
            <button
              type="button"
              aria-label={t('Auto-locate food spots')}
              onClick={autoLocate}
              disabled={!!progress}
              className="btn-soft mb-3 w-full"
            >
              <Sparkles size={16} />
              {progress
                ? t('Locating… {done}/{total}', { done: progress.done, total: progress.total })
                : t('Find {n} from your wishlist on the map', { n: needsLocating.length })}
            </button>
          )}
          {ranked.length === 0 ? (
            <div className="mt-4 px-2 text-center">
              <p className="text-4xl">📍</p>
              <p className="mt-3 font-serif text-lg font-semibold text-ink">{t('No places yet')}</p>
              <p className="mt-1 text-sm text-ink-soft">{t('Add a food spot to drop your first pin.')}</p>
              {SEED_PLACES.length > 0 && (
                <button type="button" className="btn-soft mx-auto mt-4 flex" onClick={importSeed} disabled={importing}>
                  <Upload size={16} /> {importing ? t('Importing…') : t('Import our spots')}
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {ranked.map((td) => {
                const dist = userLocation ? formatDistance(haversineKm(userLocation, td.place!)) : ''
                return (
                  <li key={td.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(td.id)
                        setExpanded(false)
                      }}
                      className={`card flex w-full items-center gap-3 p-3 text-left active:scale-[0.99] ${
                        selectedId === td.id ? 'ring-2 ring-coral/40' : ''
                      }`}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral/15 text-coral">
                        <MapPin size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{td.title}</span>
                        {td.place?.address && <span className="block truncate text-xs text-ink-soft">{td.place.address}</span>}
                      </span>
                      {dist && <span className="shrink-0 text-sm font-semibold text-ink-soft">{dist}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </motion.section>

      {/* Tap a pin/row → details + actions. */}
      <BottomSheet open={!!selected} onClose={() => setSelectedId(null)} title={selected?.title}>
        {selected && (
          <div className="space-y-4">
            {selected.place?.address && <p className="text-sm text-ink-soft">{selected.place.address}</p>}
            {userLocation && (
              <p className="text-sm font-semibold text-ink-soft">
                {t('{dist} away', { dist: formatDistance(haversineKm(userLocation, selected.place!)) })}
              </p>
            )}
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => {
                haptic(10)
                openNavigation(selected.place!.lat, selected.place!.lng, selected.title)
              }}
            >
              <Navigation size={18} /> {t('Navigate')}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-soft flex-1"
                onClick={() => {
                  setEditTodo(selected)
                  setSelectedId(null)
                  setAddOpen(true)
                }}
              >
                {t('Edit place')}
              </button>
              <button
                type="button"
                className="btn-soft flex-1 !text-coral-deep"
                onClick={async () => {
                  await clearTodoPlace(selected.id)
                  haptic(6)
                  setSelectedId(null)
                }}
              >
                <Trash2 size={16} /> {t('Remove')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Add a spot, or re-pin an existing one, by searching its name. */}
      <PlaceSearchSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          setEditTodo(undefined)
        }}
        todo={editTodo}
        userLocation={userLocation}
      />
    </>
  )
}
