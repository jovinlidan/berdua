// Geo helpers for the food map: great-circle distance + a permission-aware geolocation hook.
import { useEffect, useRef, useState } from 'react'

export interface LatLng {
  lat: number
  lng: number
}

/** The couple's home city — biases place search and sets the map's default view. (Medan city centre.) */
export const HOME_CENTER: LatLng = { lat: 3.5952, lng: 98.6722 }
/** Home city name (used in copy / optional query hints). */
export const HOME_CITY = 'Medan'
/** Search bounding box "minLon,minLat,maxLon,maxLat" — restricts geocoding to the greater-Medan
 *  region so a fuzzy match can never land in another city/province. */
export const HOME_BBOX = '98.2,3.1,99.2,4.0'

const EARTH_KM = 6371

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Human distance label: "220 m" under 1 km, else "1.2 km". Plain text — no bars/percentages. */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

export type GeoStatus = 'idle' | 'prompting' | 'ready' | 'denied' | 'unsupported'

export interface GeoState {
  status: GeoStatus
  coords: LatLng | null
  retry: () => void
}

/**
 * Watches the device's location (one permission prompt, then live updates). Starts on mount;
 * `retry()` re-asks after a denial. Geolocation needs HTTPS (works on localhost for dev).
 */
const geoSupported = () => typeof navigator !== 'undefined' && !!navigator.geolocation

export function useGeolocation(): GeoState {
  // Start in 'prompting' (we begin watching on mount) so the effect needs no synchronous setState.
  const [status, setStatus] = useState<GeoStatus>(() => (geoSupported() ? 'prompting' : 'unsupported'))
  const [coords, setCoords] = useState<LatLng | null>(null)
  const watchId = useRef<number | null>(null)

  // Register the watch; all state changes here are async (geolocation callbacks), not synchronous.
  function watch() {
    if (!geoSupported()) return
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus('ready')
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'idle'),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    )
  }

  // Re-ask after a denial (called from a click, not an effect → setState here is fine).
  function retry() {
    setStatus(geoSupported() ? 'prompting' : 'unsupported')
    watch()
  }

  useEffect(() => {
    watch()
    return () => {
      if (watchId.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current)
    }
  }, [])

  return { status, coords, retry }
}
