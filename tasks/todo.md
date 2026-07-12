# Berdua — compact build plan

This file tracks current status and remaining engineering work. Historical implementation notes were
condensed after the main product phases shipped; durable lessons live in `tasks/lessons.md`.

## Product direction

- Private, installable PWA for exactly two people
- Cozy shared-journal visual language; warm palette, restrained motion, and no gamified clutter
- Local-first and offline-capable; cloud sync enhances the app but is not required to use it
- English and Bahasa Indonesia
- iPhone and Android home-screen installation

## Shipped

- [x] PWA shell, offline service worker, install flow, responsive mobile UI, and error handling
- [x] Two-device pairing by private code with fixed member slots and reinstall-by-name recovery
- [x] Dexie/IndexedDB repository with Upstash Redis sync, LWW merging, and tombstones
- [x] Wishlist with custom groups, notes, reminders, swipe actions, search, and map locations
- [x] Calendar, bucket list, daily mood check-in, time capsules, and Thinking-of-you history
- [x] Food map with MapLibre, OpenFreeMap tiles, Photon search, navigation links, and offline tile caching
- [x] Shared pixel pets: up to three pets, care actions, growth, roaming, dragging, and habitat
- [x] Local-only secret space with optional PIN and private photos
- [x] Web Push pings and scheduled reminders with VAPID and an external cron trigger
- [x] Theme modes, nine accents, EN/ID localization, backup/restore, and sync controls
- [x] Production route code-splitting and local in-memory API parity for core sync flows

Date Ideas and Memories were intentionally removed. Their old implementation notes are not active backlog.

## Next — reliability and maintainability

- [ ] Enable TypeScript `strict` and `noImplicitOverride`; add the required `override` keywords
- [ ] Include `pnpm typecheck:api` in the default build pipeline
- [ ] Fix all current ESLint errors before adding CI
- [ ] Exclude `/api` from the service worker's generic cache route and bound runtime caches
- [ ] Precache all pet sprites for a reliable first offline visit
- [ ] Pause sync polling while the page is hidden or the device is offline
- [ ] Remove `maximum-scale=1.0` from the viewport for accessibility
- [ ] Reduce bundled font weights and prefer Latin subsets
- [ ] Add explicit Vite build targets and remove obsolete cache-size configuration

## Later — measured improvements

- [ ] Add sliding Redis TTL and clean stale couple IDs during cron reads
- [ ] Batch remote Dexie reads/writes and completed-item deletion transactions
- [ ] Memoize Wishlist group/row rendering only after profiling a realistically large list
- [ ] Lazy-load the Indonesian dictionary and locale without flashing English
- [ ] Split stable vendor chunks when bundle analysis confirms a useful cache win
- [ ] Add photo sync through a dedicated blob store while preserving local-only secrets
- [ ] Add CI after build, API type-check, and lint are consistently green

## Important constraints

- Pairing supports two member slots; a third unrecognized device receives `couple_full`.
- Partner-owned fields must use the field-union merge path to avoid concurrent overwrite.
- Local tombstones must shadow stale server records so deleted items do not reappear.
- Secret entries and secret photos must never be added to `SyncDoc`.
- Photos are device-local unless a future blob-sync design explicitly changes that.
- Map search remains keyless by default; Mapbox is optional.
- Google Maps short links without trustworthy coordinates must fail safely instead of creating a wrong pin.
- The live app uses read-mostly sync: GET while clean, POST only when dirty or explicitly forced.

## Verification baseline

Run before marking work complete:

```bash
pnpm build
pnpm typecheck:api
pnpm lint
pnpm exec tsx scripts/test-pairing.ts
pnpm exec tsx scripts/test-sync.ts
pnpm exec tsx scripts/test-pet.ts
```

For affected user flows, also run the matching `scripts/test-*.mjs` Playwright scenario and inspect its
screenshots and console output. Offline, pairing, sync, map, and destructive-reset changes require their
dedicated regression scenarios.

## References

- Local setup and project tour: `README.md`
- Production deployment: `DEPLOY.md`
- Durable implementation lessons: `tasks/lessons.md`
- Environment variable template: `.env.example`
