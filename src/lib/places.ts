// Provider-agnostic place search for the food map.
//   • Default: Photon (https://photon.komoot.io) — keyless, no signup, OpenStreetMap-based. Search
//     suggestions already carry coordinates, so there's no separate "retrieve" step.
//   • Upgrade: if VITE_MAPBOX_TOKEN is set, use Mapbox Search Box (better Indonesia POI coverage),
//     which needs suggest → retrieve. The UI calls resolveSuggestion() either way.
// The map canvas itself uses MapLibre + OpenFreeMap and never needs a key.
import { HOME_BBOX, HOME_CENTER } from './geo'
import type { Place } from '../types'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
// Results near the couple's home city rank first (single source of truth in lib/geo.ts).
const BIAS = HOME_CENTER

/** Search is ALWAYS available (Photon is keyless); Mapbox is an automatic upgrade when a token exists. */
export const searchEnabled = true
export const usingMapbox = Boolean(MAPBOX_TOKEN)

export interface Suggestion {
  id: string
  name: string
  address?: string
  /** Coords resolved inline (Photon). For Mapbox this is undefined until resolveSuggestion() retrieves. */
  place?: Place
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  return MAPBOX_TOKEN ? mapboxSuggest(q, MAPBOX_TOKEN, signal) : photonSearch(q, signal)
}

/** Turn a tapped suggestion into a Place with coordinates. */
export async function resolveSuggestion(s: Suggestion): Promise<Place | null> {
  if (s.place) return s.place // Photon already resolved
  return MAPBOX_TOKEN ? mapboxRetrieve(s.id, MAPBOX_TOKEN) : null
}

/**
 * Resolve pasted text to a Place. Accepts raw "lat, lng" coordinates directly (always reliable),
 * or a Google Maps link (resolved by our serverless function — works for URLs that carry coords).
 */
export async function resolveGmapsLink(input: string): Promise<Place | null> {
  const text = input.trim()
  // Raw coordinates pasted directly, e.g. "3.5684, 98.6677" — no lookup needed.
  const m = text.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (m) {
    const lat = +m[1]
    const lng = +m[2]
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) return { name: '', lat, lng }
  }
  const res = await fetch(`/api/resolve-place?url=${encodeURIComponent(text)}`)
  if (!res.ok) return null
  const d = (await res.json()) as { name?: string; lat?: number; lng?: number }
  if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return null
  return { name: d.name ?? '', lat: d.lat, lng: d.lng }
}

/** Reverse-geocode a coordinate (for "pin my current spot"). Coords are authoritative. */
export async function reversePlace(lat: number, lng: number): Promise<Place> {
  const fallback: Place = { name: '', lat, lng }
  try {
    return MAPBOX_TOKEN ? await mapboxReverse(lat, lng, MAPBOX_TOKEN) : await photonReverse(lat, lng)
  } catch {
    return fallback
  }
}

// ── Photon (keyless, default) ──────────────────────────────────────────────────
async function photonSearch(q: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const url = new URL('https://photon.komoot.io/api/')
  // bbox restricts results to the home region; lat/lon ranks the closest first within it.
  url.search = new URLSearchParams({
    q,
    limit: '8',
    bbox: HOME_BBOX,
    lat: String(BIAS.lat),
    lon: String(BIAS.lng),
  }).toString()
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Photon ${res.status}`)
  const data = (await res.json()) as { features?: PhotonFeature[] }
  return (data.features ?? []).map((f, i) => {
    const place = photonToPlace(f)
    return { id: `${place.lat},${place.lng},${i}`, name: place.name, address: place.address, place }
  })
}

async function photonReverse(lat: number, lng: number): Promise<Place> {
  const url = new URL('https://photon.komoot.io/reverse')
  url.search = new URLSearchParams({ lat: String(lat), lon: String(lng) }).toString()
  const res = await fetch(url)
  if (!res.ok) return { name: '', lat, lng }
  const data = (await res.json()) as { features?: PhotonFeature[] }
  const f = data.features?.[0]
  return f ? { ...photonToPlace(f), lat, lng } : { name: '', lat, lng }
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string
    street?: string
    housenumber?: string
    district?: string
    city?: string
    state?: string
    country?: string
  }
}

function photonToPlace(f: PhotonFeature): Place {
  const p = f.properties ?? {}
  const [lng, lat] = f.geometry?.coordinates ?? [0, 0]
  const name = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || 'Tempat'
  const address =
    [p.street, p.district, p.city, p.state, p.country].filter((x) => x && x !== name).join(', ') || undefined
  return { name, lat, lng, address }
}

// ── Mapbox Search Box (optional upgrade) ────────────────────────────────────────
function newSession(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}
// One session_token groups every keystroke `suggest` + the final `retrieve` into ONE billed session.
let mbSession = newSession()

async function mapboxSuggest(q: string, token: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const url = new URL('https://api.mapbox.com/search/searchbox/v1/suggest')
  url.search = new URLSearchParams({
    q,
    session_token: mbSession,
    access_token: token,
    country: 'id',
    language: 'id',
    types: 'poi',
    proximity: `${BIAS.lng},${BIAS.lat}`,
    bbox: HOME_BBOX,
    limit: '8',
  }).toString()
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Mapbox suggest ${res.status}`)
  const data = (await res.json()) as { suggestions?: MapboxSuggestion[] }
  return (data.suggestions ?? []).map((s) => ({
    id: s.mapbox_id,
    name: s.name,
    address: s.full_address || s.place_formatted || undefined,
  }))
}

async function mapboxRetrieve(id: string, token: string): Promise<Place | null> {
  const url = new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(id)}`)
  url.search = new URLSearchParams({ session_token: mbSession, access_token: token }).toString()
  const res = await fetch(url)
  mbSession = newSession() // retrieve closes the session; the next search bills separately
  if (!res.ok) throw new Error(`Mapbox retrieve ${res.status}`)
  const data = (await res.json()) as { features?: MapboxFeature[] }
  const f = data.features?.[0]
  return f ? mapboxToPlace(f) : null
}

async function mapboxReverse(lat: number, lng: number, token: string): Promise<Place> {
  const fallback: Place = { name: '', lat, lng }
  const url = new URL('https://api.mapbox.com/search/geocode/v6/reverse')
  url.search = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    language: 'id',
    access_token: token,
    limit: '1',
  }).toString()
  const res = await fetch(url)
  if (!res.ok) return fallback
  const data = (await res.json()) as { features?: MapboxFeature[] }
  const f = data.features?.[0]
  return f ? { ...mapboxToPlace(f), lat, lng } : fallback
}

interface MapboxSuggestion {
  mapbox_id: string
  name: string
  full_address?: string
  place_formatted?: string
}
interface MapboxFeature {
  properties?: {
    name?: string
    full_address?: string
    place_formatted?: string
    coordinates?: { longitude?: number; latitude?: number }
  }
  geometry?: { coordinates?: [number, number] }
}

function mapboxToPlace(f: MapboxFeature): Place {
  const p = f.properties ?? {}
  const lng = p.coordinates?.longitude ?? f.geometry?.coordinates?.[0] ?? 0
  const lat = p.coordinates?.latitude ?? f.geometry?.coordinates?.[1] ?? 0
  return { name: p.name ?? '', lat, lng, address: p.full_address || p.place_formatted || undefined }
}
