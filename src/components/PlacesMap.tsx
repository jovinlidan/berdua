// MapLibre GL canvas with custom teardrop pin markers + a live-location dot. Map tiles come from
// OpenFreeMap (no API key). Only loads on the /map route (the screen is lazy). All map state
// lives in refs so React re-renders only diff markers, never recreate the GL context.
import { useEffect, useRef } from 'react'
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { HOME_CENTER } from '../lib/geo'

export interface MapPlace {
  id: string
  lat: number
  lng: number
  title: string
}

const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
// Default view when there are no pins yet — the couple's home city.
const HOME: [number, number] = [HOME_CENTER.lng, HOME_CENTER.lat]

export function PlacesMap({
  places,
  userLocation,
  selectedId,
  onSelect,
}: {
  places: MapPlace[]
  userLocation?: { lat: number; lng: number } | null
  selectedId?: string | null
  onSelect: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const userMarkerRef = useRef<Marker | null>(null)
  const didFitRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // Create the GL map once. Guarded so a missing WebGL context degrades to "no map" rather
  // than throwing up the whole screen (the Nearby list still works).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: STYLE,
        center: places[0] ? [places[0].lng, places[0].lat] : HOME,
        zoom: 12,
      })
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    } catch (err) {
      console.warn('[map] WebGL unavailable — pins list still works', err)
      return
    }
    mapRef.current = map
    const markers = markersRef.current
    return () => {
      map.remove()
      mapRef.current = null
      markers.clear()
      userMarkerRef.current = null
      didFitRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Diff place markers whenever the list changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = markersRef.current
    const seen = new Set<string>()
    for (const p of places) {
      seen.add(p.id)
      const existing = markers.get(p.id)
      if (existing) {
        existing.setLngLat([p.lng, p.lat])
        continue
      }
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'place-pin'
      el.setAttribute('aria-label', p.title)
      el.innerHTML =
        '<svg class="place-pin__svg" viewBox="0 0 24 32" width="28" height="37" aria-hidden="true">' +
        '<path class="pin-body" d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z"/>' +
        '<circle class="pin-dot" cx="12" cy="12" r="4.4"/>' +
        '</svg>'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectRef.current(p.id)
      })
      markers.set(p.id, new Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map))
    }
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }
    // Frame all pins the first time we have any.
    if (!didFitRef.current && places.length > 0) {
      didFitRef.current = true
      if (places.length === 1) {
        map.easeTo({ center: [places[0].lng, places[0].lat], zoom: 14, duration: 0 })
      } else {
        const bounds = new LngLatBounds()
        for (const p of places) bounds.extend([p.lng, p.lat])
        map.fitBounds(bounds, { padding: { top: 90, left: 60, right: 60, bottom: 340 }, maxZoom: 15, duration: 0 })
      }
    }
  }, [places])

  // Highlight + recenter on the selected pin.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [id, marker] of markersRef.current) {
      marker.getElement().classList.toggle('place-pin--active', id === selectedId)
    }
    if (!selectedId) return
    const p = places.find((x) => x.id === selectedId)
    if (p) map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 15), duration: 500 })
  }, [selectedId, places])

  // Live-location dot (distinct from the heart pins).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!userLocation) {
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      return
    }
    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'user-dot'
      userMarkerRef.current = new Marker({ element: el }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map)
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat])
    }
  }, [userLocation])

  return <div ref={containerRef} className="h-full w-full" />
}
