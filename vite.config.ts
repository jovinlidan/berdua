import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { emptyDoc, joinAndMerge } from './api/_lib/merge'
import { resolveGmapsUrl } from './api/_lib/resolveGmaps'
import type { SyncDoc } from './src/types'

// Dev-only stand-in for the deployed /api/state (in-memory). Lets sync work in `pnpm dev`
// so you can test cross-device sync locally. In production, Vercel serves api/state.ts instead.
function devSyncApi(): Plugin {
  const store = new Map<string, SyncDoc>()
  return {
    name: 'berdua-dev-sync-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/state', (req, res) => {
        const send = (code: number, body: unknown) => {
          res.statusCode = code
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        const codeOf = () => new URL(req.url ?? '', 'http://x').searchParams.get('code') ?? ''
        if (req.method === 'GET') {
          send(200, store.get(codeOf()) ?? emptyDoc())
          return
        }
        if (req.method === 'DELETE') {
          store.delete(codeOf())
          send(200, { ok: true })
          return
        }
        if (req.method === 'POST') {
          let raw = ''
          req.on('data', (c) => (raw += c))
          req.on('end', () => {
            try {
              const { code, deviceId, myName, doc } = JSON.parse(raw)
              const result = joinAndMerge(store.get(code) ?? emptyDoc(), doc, deviceId, myName, Date.now())
              if (result.full || !result.doc) {
                send(409, { error: result.error ?? 'couple_full' })
                return
              }
              store.set(code, result.doc)
              send(200, { ...result.doc, assignedPartner: result.assignedPartner })
            } catch (e) {
              send(400, { error: String(e) })
            }
          })
          return
        }
        send(405, { error: 'method not allowed' })
      })
      // dev stub for the ping endpoint (no real push locally)
      server.middlewares.use('/api/ping', (_req, res) => {
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ ok: true, sent: 0 }))
      })
      // resolve a pasted Google Maps link to coordinates (same logic as the deployed function)
      server.middlewares.use('/api/resolve-place', (req, res) => {
        const u = new URL(req.url ?? '', 'http://x').searchParams.get('url') ?? ''
        res.setHeader('content-type', 'application/json')
        resolveGmapsUrl(u)
          .then((place) => {
            if (!place) {
              res.statusCode = 422
              res.end(JSON.stringify({ error: 'no_location' }))
              return
            }
            res.statusCode = 200
            res.end(JSON.stringify(place))
          })
          .catch(() => {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'resolve_failed' }))
          })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devSyncApi(),
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest lets us own the service worker (custom push + notificationclick handlers)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: null, // we register manually in main.tsx
      includeAssets: ['icons/apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Berdua',
        short_name: 'Berdua',
        description: 'A warm little pocket-world for just the two of you.',
        lang: 'en',
        theme_color: '#e8927c',
        background_color: '#fff6f0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // photos can be large; allow precaching the app shell comfortably
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: true, // service worker active in `pnpm dev` so notifications are testable locally
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
})
