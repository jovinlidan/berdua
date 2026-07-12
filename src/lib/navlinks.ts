// "Navigate" hand-off: open the device's native maps app with directions to a place.
// iOS / iPadOS → Apple Maps; everything else → Google Maps. Both are HTTPS universal links, so the
// OS opens the installed app when present and falls back to the web otherwise — no URL schemes.

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS = /iP(hone|ad|od)/.test(ua)
  // iPadOS 13+ masquerades as a Mac with a touch screen.
  const iPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1
  return iOS || iPadOS
}

/** Build a directions URL to a coordinate, labelled, for the right platform. */
export function navigateUrl(lat: number, lng: number, label = ''): string {
  if (isApplePlatform()) {
    // daddr → opens straight into directions to the destination.
    return `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
}

/** Open the native maps app (new tab/app), navigating to the place. */
export function openNavigation(lat: number, lng: number, label = ''): void {
  if (typeof window === 'undefined') return
  window.open(navigateUrl(lat, lng, label), '_blank', 'noopener,noreferrer')
}

/** A Google Maps search URL — opens the Google Maps app (mobile) or web with the query pre-filled. */
export function gmapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** Open Google Maps (app on mobile) with a search query, so the user can find + share a place. */
export function openGmapsSearch(query: string): void {
  if (typeof window === 'undefined') return
  window.open(gmapsSearchUrl(query), '_blank', 'noopener,noreferrer')
}
