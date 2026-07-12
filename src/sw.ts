/// <reference lib="webworker" />
// Custom Berdua service worker (vite-plugin-pwa injectManifest mode).
// Owns offline precaching + the push/notificationclick handlers that make
// scheduled reminders work on a home-screen-installed PWA (iOS 16.4+ & Android).
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

self.skipWaiting()
clientsClaim()

// Precache the app shell so ideas/bucket/memories are readable offline.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA navigation: when ONLINE always fetch a fresh shell, so we never serve a stale precached
// index.html that points at JS chunks a newer deploy has already replaced (which renders blank
// until a manual refresh). When offline, fall back to the precached index.html so the app still
// opens. networkTimeoutSeconds keeps a flaky connection from hanging on a white screen.
const precachedShell = createHandlerBoundToURL('index.html')
const freshShell = new NetworkFirst({ cacheName: 'berdua-shell', networkTimeoutSeconds: 3 })
registerRoute(
  new NavigationRoute(async (options) => {
    try {
      const res = await freshShell.handle(options)
      if (res) return res
    } catch {
      // offline / network error — fall through to the precached shell below
    }
    return precachedShell(options)
  }),
)

// Map tiles & style assets from OpenFreeMap (cross-origin). Vector tiles are immutable per
// z/x/y → CacheFirst, so areas the couple has panned over render with zero network. Style /
// glyph / sprite assets change rarely → StaleWhileRevalidate. Registered first (first-match-wins)
// so they own these URLs before the generic image/same-origin routes below.
registerRoute(
  ({ url }) => url.origin === 'https://tiles.openfreemap.org' && url.pathname.endsWith('.pbf'),
  new CacheFirst({
    cacheName: 'berdua-map-tiles',
    plugins: [new ExpirationPlugin({ maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true })],
  }),
)
registerRoute(
  ({ url }) => url.origin === 'https://tiles.openfreemap.org' && !url.pathname.endsWith('.pbf'),
  new StaleWhileRevalidate({ cacheName: 'berdua-map-assets' }),
)

// Runtime-cache images not in the precache (e.g. saved-link thumbnails) so they show offline.
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'berdua-images',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true })],
  }),
)

// Same-origin GET responses fall back to cache when offline (defensive belt for any stray asset).
registerRoute(
  ({ url, request }) => url.origin === self.location.origin && request.method === 'GET',
  new StaleWhileRevalidate({ cacheName: 'berdua-runtime' }),
)

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
}

// Phase 2: the cloud cron POSTs an encrypted Web Push → we surface it here.
self.addEventListener('push', (event) => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Berdua 💌', {
      body: payload.body ?? 'A little something for the two of you.',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: payload.tag ?? 'berdua',
      data: { url: payload.url ?? '/' },
    }),
  )
})

// Tapping a notification focuses an open window (and deep-links it) or opens a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) || '/'
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'berdua-navigate', url })
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })(),
  )
})
