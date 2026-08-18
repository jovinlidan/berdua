# Berdua 💞

Berdua is a private, installable PWA for two people. It is local-first, works offline, and can sync a
couple's shared data between two phones through a private pairing code.

## What is included

- Shared Wishlist with categories, reminders, swipe actions, and optional map locations
- Routines on their own screen: daily, weekly, or monthly rules with per-day check-offs and streaks
- Calendar for dated Wishlist items, routine occurrences, capsules, and anniversaries
- One-tap export of a dated item or a whole routine to each phone's own calendar app (.ics)
- Bucket list, daily mood check-ins, time capsules, and Thinking-of-you history
- Food map powered by MapLibre and keyless OpenStreetMap search
- Shared pixel pets with a habitat and care actions
- Local-only secret space with optional PIN and private photos
- English and Bahasa Indonesia, light/dark mode, accent themes, backup/restore, and offline support
- Two-device sync with Upstash Redis and Web Push reminders when deployed

## Prerequisites

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+
- [pnpm](https://pnpm.io/installation)
- Git

Check your tools:

```bash
node --version
pnpm --version
git --version
```

## 1. Clone and install

```bash
git clone https://github.com/jovinlidan/berdua.git
cd berdua
pnpm install --frozen-lockfile
```

## 2. Create the local environment file

```bash
cp .env.example .env.local
```

The app can run locally with every value left empty:

- Place search uses Photon/OpenStreetMap by default. `VITE_MAPBOX_TOKEN` is only an optional upgrade.
- Local sync uses an in-memory development API.
- Real cross-phone sync and push notifications require the production variables described below.

Never commit `.env.local` or expose server-only credentials through a `VITE_` variable.

## 3. Start the development server

```bash
pnpm dev
```

Open the URL printed by Vite, usually [http://localhost:5173](http://localhost:5173). On the Welcome
screen, enter your name and a private couple code.

To test pairing locally:

1. Keep the development server running.
2. Open the app in two browser profiles, or one regular and one private window.
3. Enter a different name on each browser and use the same couple code.
4. Add or edit an item and wait for it to appear in the other browser.

The local sync store is memory-only and resets whenever the Vite server restarts. Browser data remains
in IndexedDB until the site data is cleared.

## 4. Validate the project

```bash
pnpm build
pnpm typecheck:api
pnpm lint
pnpm exec tsx scripts/test-pairing.ts
pnpm exec tsx scripts/test-sync.ts
pnpm exec tsx scripts/test-pet.ts
pnpm exec tsx scripts/test-routine.ts
```

The build, API type-check, and logic checks are expected to pass. `pnpm lint` currently reports 14
known errors; cleaning that baseline is tracked in [tasks/todo.md](./tasks/todo.md). Do not introduce
additional lint errors in new work.

Preview the production build locally:

```bash
pnpm preview
```

The service worker and install experience are best tested from a production build over HTTPS.

## Production setup

Production sync and reminders use Vercel, Upstash Redis, VAPID keys, and an external cron trigger.
Set these variables in Vercel:

| Variable | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST credential |
| `VITE_VAPID_PUBLIC_KEY` | Client-visible Web Push public key |
| `VAPID_PRIVATE_KEY` | Server-only Web Push private key |
| `VAPID_SUBJECT` | Contact URI, usually `mailto:you@example.com` |
| `CRON_SECRET` | Secret protecting `/api/cron` |
| `VITE_MAPBOX_TOKEN` | Optional Mapbox place-search upgrade |

Follow [DEPLOY.md](./DEPLOY.md) for the complete deployment, cron, phone installation, and reminder
test tutorial.

## Project structure

```text
api/             Vercel functions for sync, reminders, pings, and map-link resolution
public/          PWA icons and bundled pet sprites
scripts/         Logic and Playwright verification scripts
src/components/  Shared UI and interaction components
src/db/          Dexie database, hooks, and repository operations
src/lib/         Dates, maps, notifications, pets, themes, and utilities
src/screens/     Route-level screens (Wishlist is for one-off tasks; Routines for repeating ones)
src/store/       Per-device Zustand session state
src/sync/        Client sync engine and status tracking
src/sw.ts        Offline cache, push, and notification service worker
tasks/           Compact backlog and engineering lessons
```

## Data and privacy model

- IndexedDB is the local source of truth; the app remains usable offline.
- Shared records sync as one couple document with last-write-wins merging and tombstones.
- Pairing is limited to two member slots. A matching name can reclaim its slot after reinstalling.
- Secret-space entries and photos never enter the shared sync document.
- Photo blobs remain device-local; use Export/Restore when moving them between devices.

## Useful commands

| Command | Action |
| --- | --- |
| `pnpm dev` | Start Vite with the in-memory sync API |
| `pnpm build` | Type-check the client and create `dist/` |
| `pnpm typecheck:api` | Type-check Vercel API functions |
| `pnpm lint` | Run ESLint |
| `pnpm preview` | Serve the production build locally |
| `pnpm icons` | Regenerate PWA icons |

Current work and remaining improvements are tracked in [tasks/todo.md](./tasks/todo.md).
