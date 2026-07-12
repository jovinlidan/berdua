# Berdua 💞

> _A warm little pocket-world for just the two of you._

A private, installable **PWA** for one couple — shared date ideas, a bucket list of dreams,
and the memories you make together. No app store, no accounts for strangers, no feed. Just you two.

Built for a **mixed iPhone + Android** household: it installs to the home screen on both and
(in phase 2) sends gentle reminders via Web Push that work on iOS 16.4+ once installed.

## Features (phase 1 — works today, fully offline, no backend)
- **Date Ideas board** — browse/add/pick ideas, filter by vibe & budget, seeded with 31 starters.
- **Surprise Me** — a calm card-flip picker for "what should we do tonight?".
- **Bucket list** — shared dreams with wish-levels; checking one off becomes a kept memory.
- **Memories journal** — photos (compressed on-device), a handwritten-style story, location.
- **The Both-Hearts seal** — a memory only earns its golden glow once *both* of you rate it 💛.
- **Home dashboard** — days-together, anniversary countdown, "on this day", upcoming date, your story stats.
- **Plan a date**, photo lightbox, fluid page transitions, haptics + confetti on the payoff beats.
- **Shared to-do list** — quick add, satisfying check animations, optional reminders, clear-done.
- **💌 Time capsules** — write a note that stays locked until a future date, then unlocks (with a push).
- **💭 Thinking of you** — one tap sends a sweet push to your partner's phone.
- **Search** date ideas · **backup & restore** (export/import JSON) · **one-tap install**.
- **Installable** — manifest + offline service worker + add-to-home-screen flow + demo notification.

## Phase 2 — cross-phone sync + push reminders (built)
- **Sync:** one JSON doc per couple in Upstash Redis, keyed by your couple-space code. Per-record
  last-write-wins + tombstones; photos stay on-device. Three serverless functions in `api/`.
- **Push:** self-generated VAPID keys; a `cron-job.org` ping hits `/api/cron` every ~15 min to send
  date / to-do / anniversary / weekend reminders, respecting quiet hours.
- **Setup (all free, ~10 min):** see **[DEPLOY.md](./DEPLOY.md)**.
- **Test locally:** `pnpm dev` includes an in-memory sync API — open two browser profiles with the same
  couple-space code to watch sync work before deploying.

## Production touches
Animated route transitions, list stagger, springy nav indicator, count-up stats, confetti on the seal,
toast feedback, an error boundary, and a live sync-status indicator.

## Run it locally
```bash
pnpm install
pnpm dev          # http://localhost:5174 (or whatever Vite prints)
```
Build & preview the production PWA (the service worker only fully works in a build/preview or over HTTPS):
```bash
pnpm build
pnpm preview
```
Regenerate the app icons after editing `scripts/gen-icons.mjs`:
```bash
node scripts/gen-icons.mjs
```

## Put it on your phones (free, no store)
1. Deploy the `dist/` build to any static HTTPS host — **Vercel** or **Netlify** free tier is perfect
   (HTTPS is required for the service worker & notifications).
2. On the live URL:
   - **iPhone (Safari):** Share → **Add to Home Screen**. _(Push only works after this — it's an iOS rule.)_
   - **Android (Chrome):** menu ⋮ → **Install app**.
3. Open it from the home-screen icon — it runs full-screen like a native app.

## Tech
Vite + React + TypeScript · Tailwind v4 · vite-plugin-pwa (injectManifest + Workbox) · React Router ·
Zustand (session) · Dexie + dexie-react-hooks (local-first reactive store) · framer-motion ·
canvas-confetti · self-hosted Fraunces / Nunito / Caveat (@fontsource) ·
Upstash Redis + web-push (VAPID) on Vercel serverless for phase-2 sync & reminders.

## Layout
```
src/
  db/         Dexie schema, repository (only writer), reactive hooks
  data/       seed date ideas
  lib/        dates, milestones, taxonomy, photos, notifications, haptics, celebrate, partners
  store/      Zustand session (active partner + notif prefs + push sub)
  sync/       sync engine, change bus, sync-status store
  components/ AppShell, BottomNav, PartnerToggle, sheets, HeartRating, Toast, ErrorBoundary, …
  screens/    Welcome, Home, Ideas, IdeaDetail, PlanDate, Bucket, Todos, Memories, MemoryDetail, Surprise, Settings
  sw.ts       custom service worker (offline + push + notificationclick)
api/          serverless: state.ts (sync), cron.ts (reminders), _lib/ (kv, merge, reminders)
```
See `tasks/todo.md` for the full plan and phase-2 backlog.
