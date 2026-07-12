# Berdua — build plan

> A private, installable PWA date-ideas + bucket-list + memories app for **two people** (iPhone + Android).
> Phase 1 = runnable, installable, delightful, **local-first (no backend)**. Phase 2 = Supabase sync + Web Push reminders.

## Design (locked from design workflow)
- **Name:** Berdua · **Tagline:** "A warm little pocket-world for just the two of you."
- **Vibe:** cozy, warm-sunset, shared paper journal. NOT gamified. Memories are the heart.
- **Palette:** primary `#E8927C` · secondary `#7C8A6F` · accent `#E8B4A0` · bg `#FFF6F0` · text `#3A2E2B`
- **Fonts:** Fraunces (titles) · Nunito (UI) · Caveat (handwritten accents) — self-hosted via @fontsource
- **Signature:** Both-Hearts seal (both partners must rate → golden glow + confetti). Confetti/haptics only at payoff beats.

## Stack
Vite + React + TS · Tailwind v4 · vite-plugin-pwa (injectManifest) · React Router · Zustand (session) ·
Dexie + dexie-react-hooks (local-first reactive store, repository interface for phase-2 swap) ·
@fontsource fonts · canvas-confetti + Vibration API · framer-motion.

## Phase 1 tasks — ✅ DONE
- [x] 1. Theme: Tailwind tokens (palette), font imports, base global styles, index.html
- [x] 2. PWA: vite.config (tailwind + PWA injectManifest), manifest, generated icons (two-hearts squircle)
- [x] 3. Domain types (`types.ts`)
- [x] 4. Data layer: Dexie schema + repository + reactive hooks + 31 seeded date ideas (race-safe seeding)
- [x] 5. Session store (Zustand): active partner toggle, notif prefs
- [x] 6. App shell + router + bottom nav + shared primitives (Chip, BottomSheet, HeartRating, PartnerToggle, Avatar)
- [x] 7. Onboarding/Welcome
- [x] 8. Home/Together (+ anniversary countdown, on-this-day, "our story" stats — bonus)
- [x] 9. Date Ideas + Add/Edit sheet + Idea Detail (filters, who-added)
- [x] 10. Bucket List (wish-levels, check-off → memory → Both-Hearts seal)
- [x] 11. Plan a Date → Upcoming; Surprise Me card-flip + reroll
- [x] 12. Memories + capture (photo blobs, lightbox, story, dual hearts, golden seal + confetti)
- [x] 13. Settings (names, anniversary, notif prefs, demo notification, install help, reset)
- [x] 14. Custom service worker (push + notificationclick); permission + subscribe helper; demo notification
- [x] 15. Verify: typecheck + `pnpm build` green, headless walkthrough (11 screens, 0 console errors), adversarial review

## Bonus polish added
- Fluid route transitions (AnimatePresence) + staggered list entrances + tap micro-interactions
- Anniversary countdown, "on this day" nostalgia, "our story so far" stats, photo lightbox

## Phase 2 — ✅ BUILT (deploy via DEPLOY.md)
- [x] Cross-phone **sync** — one JSON doc per couple in **Upstash Redis** (NOT Supabase; simpler/no-DB feel),
      keyed by couple-space code. Per-record LWW + tombstones; photos stay on-device. `api/state.ts` +
      client `src/sync/`. Verified with a 2-context e2e test + 14 merge/reminder unit checks.
- [x] **Web Push** reminders (VAPID) from `cron-job.org` → `api/cron.ts` every ~15 min (date/to-do/anniversary/
      weekend nudges, quiet-hours aware via stored tz offset). **NOT Vercel Hobby cron (1×/day cap).**
- [x] Dev-only in-memory sync API in `vite.config.ts` so sync is testable in `pnpm dev`.

## Phase 3 — ✅ added (animation + functionality + production)
- [x] **Shared to-do list** (synced) with check animations, reminders, clear-done
- [x] **To-do categories** (Date prep / Errands / Home / Travel / Gifts / Other) — filter chips double as the
      new-item category, animated progress bar, per-row color accents + badges, layout animations (Dexie v5 backfill)
- [x] Animated category sections (framer `layout` → reorder/collapse glides) + confetti on hitting 100% done.
- [x] **Rename / delete / reorder categories** — pencil on each section header opens an edit sheet (emoji + name),
      Move up/down (swaps `order`, synced), and Delete (todos become uncategorised). Verified via walkthrough capture.
- [x] Default categories set to **Food / Movie / Game / Travel** (user request) — Dexie v10 clears + reseeds so it
      applies to existing installs; `deleteTodoGroup` now leaves todos uncategorised (removed the 'other' fallback).
- [x] **Custom categories + collapsible groups** (user request): new synced `TodoGroup` entity (Dexie v9, seeded with
      the built-ins). To-dos render as collapsible category sections (animated height, per-device collapse state in
      session); a "New tasks go to" chip selector + a ＋New chip to create categories. Delete reassigns todos to Other.
      Verified: build/api/18 logic/sync-e2e + walkthrough (created "Movie nights", grouped sections render).
- [x] **💌 Time capsules** — synced sealed notes that unlock on a future date + push (`api/cron` + `/capsule`)
- [x] **💭 Thinking of you** — instant push to the other partner (`api/ping.ts` + dev stub)
- [x] **Search** in Date Ideas · **backup/restore** (export/import JSON) · **one-tap install** (beforeinstallprompt)
- [x] Animations: route transitions, list stagger + layout, springy nav indicator, count-up days, confetti
- [x] Production: toast feedback, error boundary, live sync-status indicator, Settings moved to Home gear
- [x] Verified: build + api typecheck green, 17 logic checks, 2-device e2e sync PASS, 14-screen walkthrough (0 errors)

## /loop iterations (every 30m: "improve ui, animation, add features, fix bugs")
- [x] #1 — Favorite/pin date ideas: synced ★ toggle (spring pop), favorites sort to top, "★ Loved" filter chip
- [x] #2 — Bucket list polish: wish-level filter chips + counts, color accents, popLayout animations, "kept" count
- [x] #3 — Memory **mood** (🥰😄😌🤩😂🥹): animated picker on capture, shown on timeline, synced; + fixed pluralization
      bugs ("1 moment(s)", "1 day(s)")
- [x] #4 — **"Our Story" recap screen** (`/story`): count-up days hero, anniversary pill, 6-stat grid (animated),
      "your vibe leans", first/latest memory; linked from Home "Our story so far"
- [x] #5 — **Accent personalization** (Coral/Rose/Sunset/Berry/Ocean): Settings picker re-tints the whole app via
      Tailwind v4 `--color-coral` var override, synced on `couple.themeAccent` (wired up the previously-dead field)
- [x] #6 — **Cancel plan** (bug/gap fix): idea detail now shows the planned "Coming up" date/place + a Cancel plan
      action (`unplanDate` reverts status + tombstones the plan). Verified via dedicated e2e (scripts/test-unplan.mjs)
- [x] #7 — **Plan-a-date quick presets** (Tonight / Tomorrow / This weekend @ 7pm): one-tap date picking with active
      highlight, above the custom datetime picker
- [x] #8 — **Memories search + mood filter**: search title/story/location; mood chips (only moods present), popLayout
      filter animations — ties the moods feature together
- [x] #9 — **Bug fix**: marking a *planned* date done left a ghost "Coming up" forever → `markIdeaDone` now clears the
      plan (+tombstone) and `useNextUpcoming` skips done/missing ideas. + Home countdown ("Today/Tomorrow/in N days").
      Verified via scripts/test-done.mjs + full regression (17 logic + sync e2e)
- [x] #10 — **Actionable empty states**: reusable `<EmptyState>` with a gently floating illustration + CTA button
      (reduced-motion aware), across Bucket/Capsule/Ideas/Memories/To-dos

## Fixes (user-reported)
- [x] Dark theme white flash on refresh (FOUC) → theme was applied in a React effect after mount. Added a blocking
      inline `<head>` script that sets `data-theme` + `<html>` bg from localStorage before first paint (auto resolves
      via system). `applyMode` keeps the html bg in sync. Verified: data-theme='dark' + dark bg at reload (test-theme-flash.mjs).
- [x] Route-transition flicker → was `AnimatePresence mode="wait"` + unfrozen `<Outlet>` (outgoing screen showed the
      new route mid-exit). Switched to an enter-only transition + scroll-to-top on nav. No more overlap/flash.
- [x] FAB jumping to bottom-right on screen enter → the transition's `transform` (y-slide) made a containing block for
      the `position: fixed` FAB, which snapped when the transform cleared. Transition is now **opacity-only** (no transform).
- [x] FAB/sheet flicker when a bottom-sheet opens → ROOT CAUSE was the sheet backdrop's `backdrop-blur` re-compositing
      fixed/animating content every frame (Chrome). Removed the blur → plain `bg-ink/50` dim. (FAB also fades out while a
      sheet is open, across Bucket/Ideas/Capsule.)

## Workflow-driven feature batch (ultracode: ideation workflow → judged picks → built)
- [x] **🌈 How are we today** — daily 1–5 mood check-in per partner + optional note; animated dual-line SVG `MoodChart`
      (framer-motion pathLength draw). New synced entity `DailyMoodCheck`. Home card + `/checkin` route.
- [x] **Field-union sync merge** (`mergeSplitCollection` server + `unionDaily` client) so the two partner-owned fields
      on a daily record never clobber each other under offline/concurrent edits (whole-record LWW would). Tested.
- [~] ~~🗓️ Daily Question~~ — built then **removed at user request** (not wanted). Dexie v7 drops the table.

## Wishlist: paste-a-link → auto bucket dream (user request)
- [x] Paste a **TikTok / Instagram / YouTube** URL in the bucket sheet → auto-fills the title + saves the link.
      `lib/links.ts` (offline URL parse) + `/api/oembed` serverless proxy (real TikTok/YouTube title + thumbnail;
      IG falls back to parsed title). BucketItem gains `link`/`linkSource`/`linkThumb` (synced). Row shows source +
      an open-link button. Verified via scripts/test-link.mjs.
- [x] **Extended paste-a-link to Date Ideas** (same flow): `IdeaFormSheet` paste input → auto-title + source +
      thumbnail; `DateIdea` gains `link`/`linkSource`/`linkThumb` (synced); Ideas card meta shows the source emoji;
      IdeaDetail shows an "Open on …" row (thumbnail + ExternalLink). Build + typecheck:api + 11-screen walkthrough
      all clean (0 console errors).

## Offline-friendly (verified against the production preview build)
- [x] SW runtime caching: images/link-thumbnails (CacheFirst + expiry) + same-origin GET (StaleWhileRevalidate),
      on top of the precached app shell + all code-split chunks (33 entries) → full app works offline.
- [x] **Offline banner** ("saved here, syncs when you're back") via `useOnline`, shown in AppShell.
- [x] **Auto-sync on reconnect** — `useSync` listens to `online`/`offline` (immediate sync when back; mark offline when lost).
- [x] **Proven** with `scripts/test-offline.mjs` (Playwright, network toggled off against `pnpm preview`): cached shell
      loads, banner shows, lazy route + IndexedDB write work offline, banner clears on reconnect. PASS.

## Secret space (user request: "something our partner can't know")
- [x] **Local-only private list** (`Secret` entity, Dexie v8) — deliberately NOT in SyncDoc, so it never enters the
      shared couple doc or reaches the partner's phone. Owner-filtered by activePartner. Add/check/delete (animated).
- [x] **Optional PIN lock** (per-device, hashed in session store, never synced) gating the `/secrets` screen.
- [x] Discreet entry via Settings → "Just for you → Secret space". Honest copy: "stays on this device, never synced".
- [x] Discoverability fix (user couldn't find it): added a "🔒 Private list" button at the top of the To-do tab → /secrets.
- [x] **Proven private** by scripts/test-secret.mjs: secret added on phone A (same couple code) NEVER appears on B. PASS.
- [x] **Private photos** in secrets — attach photos (compressed blobs, local-only) with thumbnail strip + lightbox +
      remove. Verified the secret + its photo still never sync to the partner.

## Theming
- [x] **Glanceable theme toggle** on Home (top-left, beside the gear) — animated sun/moon swap, one-tap light↔dark.
- [x] **Dark theme** — cozy warm-dark palette via `[data-theme='dark']` CSS-var overrides (bg/paper/ink/cream-deep).
      Light / Dark / **Auto** (follows system, live-reacts) selector in Settings. Per-device (not synced) via session store.
- [x] **More accents** — expanded to 9 (Coral, Rose, Sunset, Honey, Forest, Ocean, Sky, Berry, Lavender); accent stays
      synced and composes with dark mode (accent var is independent of the dark palette vars).

## Sync controls
- [x] Settings → "Sync between phones": **"last synced X ago"** + a **"Sync now"** button (RefreshCw spins while
      syncing) with a toast result. Shown only when a couple-space code is set.

## Bug fixes
- [x] **To-dos: removed the percentage progress** (user: "no need percentage progress"). Dropped the "X% there"
      card + animated bar; kept the plain "X of Y done" header count and the all-done confetti moment. "Clear N
      completed" moved to a small action at the bottom of the list. See tasks/lessons.md.
- [x] **To-dos: completed tasks stay in their category** (user correction: "dont move the complete to separate
      category"). Was: finishing a task pulled it into one global "Done ✓" section. Now each task stays in its own
      category, struck through + sorted last; the category badge shows tasks **remaining** (✓ when all done); a
      small "Clear N completed" lives in the progress card. See tasks/lessons.md. Verified via
      scripts/test-todos-complete.mjs (add to Food → complete → stays in Food, struck, no Done section, 0 errors).
- [x] **Anniversary off-by-one in negative-UTC timezones** — `daysTogether` + `nextAnniversary` parsed the
      `yyyy-MM-dd` anniversary with `new Date()` (→ UTC midnight) then did local-time calendar math, so e.g. in
      New York "2022-07-01" was read as Jun 30 (wrong anniversary day + day count off by one). Fixed at root with
      date-fns `parseISO` (local-midnight parse). Jakarta (the user's TZ) was unaffected, but it's now correct
      everywhere. Proven by scripts/test-anniversary-tz.mjs across Jakarta/NY/LA/Honolulu (all land on Jul 1).

## Features
- [x] **Home surfaces due/overdue to-dos** — the Home to-dos card now reads "⏰ N overdue" / "📌 N due today"
      (coral accent) from each todo's local `dueAt`, since push reminders only fire once sync is on. Plain count
      fallback otherwise; no percentage chrome. Verified: build + typecheck + walkthrough, 0 console errors.
- [x] **Add a planned date to your phone calendar** — `lib/calendar.ts` builds a standards-compliant `.ics`
      (UTC times, RFC-escaped, with a 2h-before VALARM) and downloads it; an "Add to calendar" button sits on the
      idea's "Coming up" card. Works offline on iPhone + Android, and the calendar alarm nudges you even before
      cloud push is set up. Verified: scripts/test-ics.mjs (pure builder, TZ-independent) + scripts/test-ics-download.mjs
      (plan a date → button appears → clicking downloads the .ics).
- [x] **Daily check-in: read your partner's note** — the check-in lets each of you write "a word about your
      day", but you could never see the other's. Now their note appears as a handwritten bubble ("Alex today: 😄
      …") on /checkin, and Home's check-in card nudges "💬 {partner} left you a note" so it actually gets seen.
      Verified via scripts/test-checkin-note.mjs (A writes note → switch to B → bubble + Home nudge, 0 errors).

## Animation polish
- [x] **Memory lightbox → swipeable gallery** — was one photo at a time (close + reopen to see the next). Now
      swipe (framer drag), on-screen chevrons (disabled at the ends), and ←/→/Esc keys page through all photos
      with a directional slide + a "2 / 5" counter; backdrop/X both close. Verified via scripts/test-lightbox.mjs
      (3 photos: open → next-chevron → arrow-key → end-disabled → back-to-start → Esc closes, 0 console errors).
- [x] **Surprise = slot-machine reveal** — "Surprise us" now flashes through candidate ideas and decelerates to a
      landing (6 flips, eased delays) with building haptics (light ticks → firm land); spinner icon rotates and the
      CTA reads "Shuffling…" → "Plan this one"; card/buttons disabled mid-spin so you can't navigate on a flash.
      No confetti (kept exclusive to the Both-Hearts seal per the locked design). Timeouts cleared on unmount.
      Verified via scripts/test-surprise.mjs (spin → shuffling state → lands → reroll offered, 0 console errors).

## Performance
- [x] **Route code-splitting** — screens lazy-loaded (React.lazy + a content-area Suspense fallback); entry bundle
      ~550KB→~239KB (76KB gzip), per-screen chunks 2–19KB. SW precaches all 33 chunks (offline intact). 0 nav errors.
- [x] Bucket rows show the link **thumbnail** (doubles as the open-link tap target).

## Backlog (future)
- Sealed-note time capsule, daily love note, milestones, "on this day" expansion, thinking-of-you ping, yearly recap
- Photo sync via a blob store (Vercel Blob / Cloudinary)
- Indonesian (Bahasa) i18n

## Review
Built phase-1 fully, verified by `pnpm build` (tsc + vite + PWA) and a headless 11-screen walkthrough
(0 console errors). Ran an adversarial 4-dimension code-review workflow (20 agents): 18 raw findings,
14 confirmed after verification.

**Fixed:**
- Seeding race (StrictMode double-effect) → module promise guard + deterministic ids + bulkPut (no dupes).
- Data integrity: `rateMemory`, `completeBucketItem`, `deleteMemory`, `uncompleteBucketItem` now read-modify-write
  inside a Dexie transaction (no lost updates / orphaned memories — important before phase-2 sync).
- `sealedAt` no longer drifts on re-rating (first-seal time preserved).
- Photo add/remove via atomic repo fns (`addMemoryPhotos`/`removeMemoryPhoto`) — fixes the stale-closure.
- UX: PartnerToggle no longer overlaps headers (header right-padding + Home top clearance); back/close buttons
  → 44px; heart tap targets enlarged.

**Skipped (justified):** `useState(defaultWhen)` "bug" (correct lazy-init; made explicit anyway); photo `key={i}`
(non-issue — no entrance animation, lightbox closed during edits); BottomSheet focus-trap (over-engineering for a
2-person touch app — Escape + backdrop dismiss already present); null/undefined hook split (intentional).

---

## Pairing-by-code rework (2026-06-16, user request)

Replace "one shared phone, type both names, toggle A/B" with real two-device pairing:
- Each phone enters **only its own name** + a **required code**.
- First phone to use a code claims slot **A**, shows "waiting for partner".
- Second phone with the same code joins as **B** → paired; names appear via sync.
- A **3rd** phone with that code is rejected ("code already taken").
- The manual A/B toggle is removed — each phone is fixed to its person.

### Decisions (confirmed)
- Remove the manual A/B toggle (each phone = one fixed person).
- App fully usable while waiting; show a gentle "waiting for partner" banner.
- Reset the live `cintah` couple doc so it adopts the new model.

### Server (`api/`)
- [x] `types.ts` → `SyncDoc.members?: { A?: CoupleMember; B?: CoupleMember }`.
- [x] `_lib/merge.ts` → `mergeCouple` (per-slot name ownership, no empty-clobber) + `joinAndMerge`.
- [x] `state.ts` POST reads `{ code, deviceId, myName, doc }`; assigns slot / **409 `couple_full`** /
      responds `{ ...doc, assignedPartner }`. `emptyDoc()` → `members: {}`. Dev stub shares `joinAndMerge`.

### Client (`src/`)
- [x] `sync/sync.ts` → `joinCouple()` + identity-aware `syncOnce()` + `applyCoupleLocal()`.
- [x] `lib/id.ts` → `getDeviceId()` durable id (fixes the reload-409 bug); used by `store/useSession.ts`.
- [x] `screens/Welcome.tsx` → own name + required code, join states (waiting / full / offline).
- [x] `db/repo.ts` → removed `saveCouple` (pairing creates the couple).
- [x] `components/AppShell.tsx` → `WaitingBanner` in place of the deleted `PartnerToggle`.
- [x] `screens/Settings.tsx` → edit only my name; partner + code read-only.

### Cleanup + verify
- [x] Reset live `cintah` doc (del key + srem from set).
- [x] `pnpm typecheck:api` + `pnpm build` clean; deployed to https://berdua.vercel.app.
- [x] e2e: device1 claims → waiting; device2 joins → both names sync; device3 → 409.

---

## Indonesian locale / i18n (2026-06-16, user request) — ✅ DONE
Built `lib/i18n.ts` (`t()` = English-key→override, {token} interpolation, date-fns `id` locale) +
per-device `lang` in session (auto-detects phone language) + Settings EN/ID switcher + locale-aware
`lib/dates.ts`. Wrapped every user-facing string across all screens+components in `t()` (6 parallel
subagents on disjoint files; Calendar done by hand incl. locale weekday initials). Compiled one
consistent Indonesian dictionary in `lib/i18n.id.ts` (~250 entries). Coverage check: all 338 `t()`
keys have an ID entry, 0 missing. Verified: typecheck+build clean; e2e toggles to ID → nav/Settings/
Calendar/Todos translate, month renders "Juni 2026", switch back to EN works; screenshots reviewed.
Note: seeded *content* (date-idea titles, default category names) stays English — it's data, not UI.

## Indonesian locale / i18n — (superseded by the entry above)
Whole-app Bahasa Indonesia with an EN/ID switcher (auto-detects phone language).
Approach: English-string-as-key `t('...')` with an `id` override map (missing key → English fallback,
so English needs no dictionary and nothing ever shows blank). Per-device `lang` in session (like theme).
- [ ] `lib/i18n.ts` — `Lang`, `translate()`, `useT()`, `{param}` interpolation, date-fns `id` locale getter.
- [ ] `store/useSession.ts` — `lang` (default = navigator.language), `setLang`, persisted.
- [ ] `lib/dates.ts` — format with the active locale (id when chosen).
- [ ] `screens/Settings.tsx` — Language segmented control (English / Bahasa Indonesia).
- [ ] Wrap every user-facing string across screens + components in `t()` (subagents, disjoint files).
- [ ] Compile one consistent Indonesian dictionary (warm tone) from the collected strings.
- [ ] Verify: build + typecheck + e2e toggling to ID shows translated UI + Indonesian dates; deploy.

## Distinct partner names + clearer join errors (2026-06-16, user request) — ✅ DONE
- Partners can't share a name: `joinAndMerge` rejects with `name_taken` if a join/rename would make
  your name equal the OTHER slot's name. Settings "You" field also guards client-side (toast).
- Taken code + unrecognized name → `couple_full` (distinct from name_taken). Errors plumbed through
  state.ts + dev stub (409 `{error}`) → `joinCouple` returns 'full' | 'name_taken' → Welcome shows a
  specific message for each. `syncOnce` no longer infinite-retries a 409 (logical reject).
- Reclaim-by-name (iOS reinstall) still works; same-name is impossible since entering an existing
  name reclaims that slot rather than duplicating it.
- Verified: 12 pairing unit checks (+name_taken, +couple_full) PASS; e2e (stranger on full code sees
  the error + blocked; reinstall reclaims) PASS; build + 0 missing i18n keys.

## iOS "Add to Home Screen" data didn't carry over (2026-06-16, user report) — ✅ FIXED
iOS gives the installed PWA its OWN storage jar, separate from Safari — Apple never shares it, so
local data (IndexedDB/localStorage) created in Safari isn't in the home-screen app. The data IS in the
cloud under the couple code; re-pairing pulls it. But the slot model would have made re-entering the
code grab the SECOND slot (locking the partner out / duplicating the user).
Fix: `joinAndMerge` now reclaims a slot whose stored name matches the joiner's name (deviceId match →
name reclaim → free slot → reject). So the same person on a new jar / reinstall reclaims their own slot
and pulls their data, without consuming the partner slot. Added an onboarding hint ("Already set up in
your browser? Enter the same code and name here to bring everything over.") + Indonesian.
Verified: 3 new reclaim unit checks in test-pairing (10 total) PASS; typecheck + build clean.
Caveat: photos are local-only (not synced) → use Export/Restore to move those; same-name partners is
an inherent ambiguity for name-based reclaim (rare).

## Bug: deleted/added items reappear then vanish (2026-06-16, user report) — ✅ FIXED
Root causes (both worsened by the read-mostly sync):
1. `applyRemote` only honored the SERVER's tombstones, so a stale GET (server copy predating your
   delete) re-inserted the row via `newer(undefined,row)` → item "comes back"; once the delete
   POSTed, the next pull removed it again → "goes away after a while".
   Fix: build a tombstone map from LOCAL + remote tombstones and skip upserting any row a tombstone
   shadows (deletedAt >= row.updatedAt) — mirrors the server merge rule.
2. `dirty` was cleared AFTER a push, so a change made DURING an in-flight POST got stranded (never
   pushed). Fix: consume `dirty` BEFORE building the snapshot; restore it on failure.
Verified: new `test-delete-stale` deterministic repro (force every GET to return a stale doc with the
item → it must stay deleted) PASS; cross-device sync e2e + todo-features e2e still PASS; build clean.

## Rename To-do → Wishlist + compact rows (2026-06-20, user request) — ✅ DONE
- Renamed the feature brand: bottom-nav tab `To-do`→`Wishlist`, screen heading `To-do, together`→
  `Wishlist, together`, Calendar event-type label `To-do`→`Wishlist`, Home summary card
  `{count} to-do{s} together`→`{count} on the wishlist`. Route stays `/todos`; inner "task" microcopy
  kept. Bahasa added (Wishlist kept as loanword). 0 missing translations.
- Compacted `TodoRow`: padding p-3.5→p-2.5, checkbox h-8→h-6 (ring 2px, check 14), title text-sm,
  note text-xs/line-clamp-1, avatar 20→16, delete 16→14, accent bar 1.5→1, row gap 2.5→1.5.
- Verified: build clean; screenshot shows "Wishlist" nav + heading + tighter rows.

## Google-search icon on Wishlist items (2026-06-20, user request) — ✅ DONE
Each `TodoRow` has a 🔍 button (before the avatar) that opens `google.com/search?q=` with the item's
title + note (URL-encoded), in a new tab (`noopener,noreferrer`). Drag-guarded + closes an open row
instead of searching. EN/ID label. Verified: build clean, 0 missing i18n, e2e confirms the exact URL
(`…q=Book%20a%20cabin%20lakeside%2C%202%20nights`), screenshot reviewed.

## Swipe: easy close (2026-06-20, user report) — ✅ DONE
Open rows were hard to dismiss: onDragEnd decided by drag DELTA, so a small drag-back from one open
side flipped to the other; and only the title closed. Fixed: decide by the card's final position
(`x.get()`) so any small drag toward center closes; tapping anywhere on an open row (title OR checkbox)
now closes it instead of acting. Verified: build clean; close e2e (small swipe-back closes, tap closes,
not deleted) + full swipe e2e PASS ×2.

## Swipe = reveal-then-tap + delete confirm (2026-06-20, user request) — ✅ DONE
Changed swipe from auto-fire to LATCHED reveal: swiping latches the row open (sage Done / coral Delete),
the user taps the revealed action to perform it (no accidental delete). Delete now opens a confirmation
BottomSheet ("Delete this task? — '{title}' will be removed for both of you…") shared at the Todos level
via `onRequestDelete`/`pendingDelete`. Latch driven by a framer motion value + imperative `settle()` on
dragEnd (dragMomentum off); a `dragged` ref suppresses the stray release-click so it can't toggle/edit.
Trailing ✕ removed (delete is swipe→confirm). Verified: build clean, 0 missing i18n, `test-wishlist-swipe`
e2e (no auto-delete, no stray edit, dialog shows, confirm deletes, swipe-right done) PASS + screenshots.

## Swipe gestures on Wishlist items (2026-06-20, user request) — ✅ SUPERSEDED (was auto-fire)
`TodoRow` is now a framer `drag="x"` card over an action layer: swipe right → toggle done (sage
"Done/Undo" reveal), swipe left → delete (coral "Delete" reveal), threshold 72px, `dragDirectionLock`
+ `touch-action: pan-y` so vertical list scroll still works; existing checkbox/edit/delete taps intact.
Verified: build clean, 0 missing i18n keys, swipe e2e (left=delete, right=done, tap still works) PASS,
screenshot of the Delete reveal reviewed.

## Remove Date Ideas + Memories, theme fixes, Wishlist UI (2026-06-20, user request) — ✅ DONE
- Removed the **Date Ideas** feature (Ideas tab, browse/add, Surprise, Plan-a-date, planned dates,
  idea-of-day, "Coming up", seeds) and the **Memories** feature (Memories tab/screens, ratings/photos/
  seal, bucket→memory flow). Stripped from nav (now 4 tabs: Home/Calendar/Wishlist/Bucket), routes,
  Home, Story, Calendar, types, Dexie (v12 drops dateIdeas/plannedDates/memories stores), server
  merge, client sync, backup, reminders (date reminders gone; todo/capsule/anniversary/weekend kept),
  notifications. Bucket "done together" no longer makes a memory (toggle complete/undo).
- Removed the **"Clear N completed"** button on the Wishlist.
- Theme now applies everywhere: hardcoded `#e8927c` hearts → `currentColor`/`var(--color-coral)` so
  the accent re-tints them; Chip + (removed) HeartRating defaults use the coral var; pet habitat scene
  is dark-aware via `.pet-scene`/`.pet-scene-ground` overrides.
- Wishlist: "New tasks go to" chips now scroll (Chip gets `shrink-0 whitespace-nowrap`); item cards
  less rounded / more modern (`!rounded-xl` + lighter shadow).
- Verified: build clean; 17 sync + 11 pet + 12 pairing unit checks; screenshots (dark Home + Wishlist,
  4-tab nav, chips scroll 974>390px) reviewed.

## Pixel-art sprite pets (2026-06-20, user request) — ✅ DONE
Switched pets from emoji to real animated pixel sprites sourced online (LPC farm animals by Daniel
Eddeland, OpenGameArt, CC-BY 3.0) — downloaded & BUNDLED into public/sprites (offline-safe, ~80KB).
- Species lineup → chicken / sheep / pig / cow / llama (each 4×4 sheet: rows up/left/down/right ×
  4 walk + 4 eat frames; chicken 32px, others 128px). types `PetSpecies` + `lib/pet` SPECIES +
  `spriteMeta()` + `SPRITE_ROWS` + `stageScale()`; removed the emoji `spriteFor`/`SPRITES`.
- `components/PixelPet.tsx`: CSS sprite-sheet renderer — JS frame ticker cycles walk frames while
  moving (or eat frames on feed), picks the row by facing direction, idle = down-facing frame 0,
  `image-rendering: pixelated`; egg stage draws a little CSS pixel egg.
- `Creature.tsx` rewritten to wrap PixelPet (the sprite's own legs walk) + shadow + held-wiggle +
  per-stage scaling. Roaming companion + habitat scene/cards + Home card + care-sheet hero all use it;
  Feed triggers the eat animation. Credits line added on the habitat screen (CC-BY).
- i18n: new species labels (EN + Bahasa). Verified: 11 pet unit checks; build clean + sprites copied
  to dist + precached; 0 missing translations; pet e2e (11) + drag e2e (171px, drag≠tap) PASS;
  screenshots of pixel animals walking in habitat + roaming on Home reviewed.

## Draggable + walking-on-feet pets (2026-06-17, user request) — ✅ DONE (sprite look superseded by pixel)
- `components/Creature.tsx`: legged creature — species emoji body + two feet that step (alternating
  gait) while walking + soft shadow + facing flip + held-wiggle. Shared by roaming + habitat.
- Roaming pets (`PetCompanion`) + habitat `SceneWalker` rewritten to: imperative wander loop on a
  framer `useMotionValue` x (so drag interrupts it cleanly) + full drag (pick up & drop anywhere;
  roamers drag the whole viewport, scene pets drag within the box). Tap (no move) still opens care —
  framer onTap vs drag distinguishes them. `touch-none` so mobile drag doesn't scroll.
- Verified: build clean; multi-pet e2e still PASS (tap→care, roam, habitat, cap); new drag e2e PASS
  (drag moves the pet 168px, does NOT open care, tap still opens care); screenshots of legged pets
  walking in habitat + roaming on Home reviewed.

## Pet habitat screen + up to 3 pets (2026-06-17, user request) — ✅ DONE
- Pivoted pet from a synced singleton to a synced COLLECTION (max 3): `SyncDoc.pets[]` + `SyncTable
  'pets'` merged via `mergeCollection` (+ tombstones); client buildSnapshot/applyRemote handle it like
  other collections (with the local-tombstone shadow guard). Dexie `pets` table now multi-row.
- repo: adoptPet (cap 3, returns id|null), carePet(id), renamePet(id), releasePet(id, tombstone).
- `screens/PetHabitat.tsx` (`/pet`): a shared scene where all pets wander together + a per-pet card
  (sprite, name+rename, species, AGE + born date, growth bar to next stage, stat bars, Feed/Play/Pet,
  Release) + "Adopt another" until 3 ("n of 3 pets"). Reached from a Home pet-corner card and the
  roaming care sheet's "Open habitat" link.
- Roaming companion now renders ALL pets (staggered), each tappable → its care sheet; hidden on /pet
  to avoid doubling the scene. Shared UI extracted to `components/petUi.tsx` + `PetAdoptSheet.tsx`.
- `lib/pet.ts`: added MAX_PETS, ageDays, growth(stage/next/progress).
- Fully i18n'd (EN + Bahasa). Verified: 11 pet unit checks + regression (12 pairing, 18 sync) PASS;
  multi-pet e2e (adopt → roam → care → habitat w/ age → adopt to 3 → cap → 3 roam → Home card) PASS;
  build + 0 missing translations; screenshots reviewed.

## Virtual pet — raise one together (2026-06-17, user request) — ✅ DONE (superseded; now up to 3)
A shared, synced pet the couple raises. Choices: adopt-a-creature (egg→baby→kid→adult), roams the
whole app, forgiving care sim.
- `types.ts` Pet/PetSpecies + `SyncDoc.pet`/`SyncSnapshot`; server `merge.ts` `newerPet` (LWW) +
  emptyDoc; client `sync.ts` buildSnapshot/applyRemote carry the pet (LWW). Dexie v11 `pets` singleton.
- `lib/pet.ts` (pure): stat decay (fullness/happiness drift down, energy regenerates), age-based
  growth stage, mood, care actions. `repo.ts` adoptPet/carePet/renamePet (settle-then-bump).
- `components/PetCompanion.tsx` mounted in AppShell → roams the bottom of every gated screen
  (framer wander + bob + flip, sleeps/eggs stay still, mood bubble), tap → care BottomSheet (stat
  bars, Feed/Play/Pet with reactions, rename). Adopt flow (pick species + name) when none yet.
- Fully i18n'd (EN + Bahasa). Verified: 8 pet unit checks + regression (12 pairing, 18 sync) PASS;
  pet e2e (adopt → roams → follows to Calendar → care sheet → feed to 100% → persists) PASS;
  typecheck + build clean; 0 missing translations; screenshots reviewed.

## Calendar (2026-06-16, user request) — ✅ DONE
A month-grid calendar as a 6th bottom-nav tab (`/calendar`) showing everything date-bearing on each
day: planned dates, to-dos with a reminder, time capsules, memories, and the recurring anniversary.
- `db/hooks.ts` → `useCalendarEvents()` flattens plannedDates(+idea join)/todos(dueAt)/sealedNotes/
  memories into one `CalendarEvent[]`. Anniversary handled in-screen (recurring, not a stored event).
- `screens/Calendar.tsx` → month grid (date-fns), per-day type dots + anniversary heart, prev/next +
  tap-month-name-for-today, selected-day detail list with colored rows that navigate to the source.
- `BottomNav.tsx` → 6th "Calendar" tab (labels shrunk to 10px/no-wrap, px-1 so 6 fit); `App.tsx` route.
- Read-only view of already-synced data — no entity, migration, or sync change.
- Verified: typecheck:api + build clean; `test-calendar` e2e (anniversary + to-do + planned date all
  surface on today, row navigates, far empty day shows empty state); screenshot reviewed.

## Todo UX + descriptions + Redis optimization + safe erase (2026-06-16, user request) — ✅ DONE
- [x] Todo check circle → "bold ring + soft tint fill" (clearly tappable) + active-scale press.
- [x] Optional `note` (description) on todos: `Todo.note`, add-UI chip+textarea, row display
      (line-clamp), and a tap-to-edit BottomSheet (title/note/reminder) — adds full edit too.
- [x] Optimize Redis: read-mostly client sync (`syncOnce` GETs when clean, POSTs only when dirty/
      forced; dirty set via the change bus), poll 15s→30s, server `set+sadd` pipelined to 1 round
      trip, cron N+1 `get` → single `mget`.
- [x] Cleared ALL `berdua:*` keys from live Redis.
- [x] "Start over" wipes the couple's Redis doc first → `DELETE /api/state` (pipeline del+srem) +
      `eraseRemote()` client + dev stub GET/DELETE; also clears the local device id.
- [x] Erase confirmation: BottomSheet requiring typed "CONFIRM" + a 5s cool-down before the button arms.
- [x] Deployed to https://berdua.vercel.app; verified.

**Verified:** typecheck:api + build clean; 7 pairing + 18 sync unit checks; new `test-todo-features`
e2e (note add/display + edit sheet + read-only GET pull + 5s erase gate + erase-frees-slot, repeatable);
checkbox screenshot reviewed; production smoke — GET 200, POST keeps `note` + assigns A, DELETE frees
`members`, re-POST reclaims freed slot, Redis empty.

## Pairing-by-code rework (2026-06-16, user request)

### Review — ✅ DONE (2026-06-16)
All server + client items above implemented and shipped.

**Server:** `members:{A,B}` slot map on the doc; `joinAndMerge()` assigns the first free slot to a
deviceId (existing device keeps its slot), rejects a 3rd device with **409 `couple_full`**;
`mergeCouple()` gives each device write access to ONLY its own slot's name (partner name preserved
from stored) and never lets an empty value clobber a shared field. `api/state.ts` + the dev stub in
`vite.config.ts` share `joinAndMerge`.

**Client:** `joinCouple()` does the online claim; `syncOnce()` sends `{code, deviceId, myName, doc}`
and adopts the server-assigned slot; `applyCoupleLocal()` mirrors the server rule (always trust the
server for the partner's name). `activePartner` is now the fixed assigned identity — `PartnerToggle`
deleted, replaced by a `WaitingBanner`. Welcome asks only your name + a required code. Settings edits
only your name; partner + code are read-only. `saveCouple` removed (pairing creates the couple).

**Critical bug found + fixed during verification:** `deviceId` was generated in the Zustand store
initializer (`newId()`), but `persist` only writes on a `set()` — onboarding triggered none, so the
id was never persisted and **regenerated on every reload**. A reloaded phone would lose its slot and
be permanently 409'd once both slots were taken. Fixed with `getDeviceId()` in `lib/id.ts` — a durable
id under its own localStorage key, independent of Zustand's change-triggered writes. See lessons.md.

**Verified:** 7 pairing unit checks + 18 sync/merge checks; pairing e2e (3 contexts, repeatable ×2);
sync e2e regression (cross-device sync still works); `typecheck:api` + `build` clean; production 3-device
smoke (A → B → 409) + `ping` 405 + root 200. Reset the old `cintah` couple; couples set is empty.

---

## Tuning audit (2026-06-22, "check what we can tune, no new features") — findings only, not yet applied
Method: 7-dimension parallel audit (build · React runtime · Dexie · service worker · API/sync · config ·
CSS/assets), each finding re-verified against the source by an adversarial pass that downgraded/threw out
anything inflated. 56 candidates → 51 confirmed. **Severity = felt impact at 2-user scale**, which is why
many textbook optimizations are parked in P2. Visual report: artifact published this session.

### P0 — quick wins (trivial/small, low risk, real value)
- [ ] Enable TS `strict` in tsconfig.app.json + tsconfig.node.json — verified **0 errors today** (free null-safety).
- [ ] Exclude `/api` from the SW catch-all SWR route + add `ExpirationPlugin` (src/sw.ts:48-51) — stale poll data + unbounded cache.
- [ ] Typecheck API in build: `tsc -b && npm run typecheck:api && vite build` (package.json:8) — api/ ships unchecked today.
- [ ] Precache pet sprites: add `'sprites/*.png'` to `includeAssets` (vite.config.ts:76) — blank habitat on first offline open. NOT globPatterns (drops shell).
- [ ] Pause 30s poll when `document.hidden || !navigator.onLine` (src/sync/useSync.ts:9,20) — background polling + offline thrash.
- [ ] Drop unused font weights (caveat 700, fraunces 500/700, nunito 800) + switch to `@fontsource/*/latin-*.css` (src/main.tsx:6-15).
- [ ] Remove `maximum-scale=1.0` from viewport (index.html:9) — WCAG 1.4.4/1.4.10; inputs are ≥16px so no iOS zoom.
- [ ] Add a `build` block: `reportCompressedSize:false`, explicit `build.target`, delete dead 4MB `maximumFileSizeToCacheInBytes` (vite.config.ts).
- [ ] `noImplicitOverride` + 3 `override` keywords in ErrorBoundary.tsx:10,16,20.
- [ ] Fix the 15 currently-failing `eslint .` errors (set-state-in-effect ×6, purity ×4, react-refresh ×3, no-useless-assignment ×2 incl sw.ts:62, cron.ts:50) — repo lint is RED now; do before any CI.

### P1 — worth doing (small/medium, solid ROI; each has a caveat)
- [ ] `manualChunks` vendor split (react / framer-motion / dexie / router), function form keyed on node_modules path — ~110KB gz cached across deploys.
- [ ] Sliding Redis TTL on couple docs (all 3 write sites: state.ts:39, ping.ts:51, cron.ts:59) + lazy `srem` of null mget hits in cron.
- [ ] applyRemote: `bulkGet`→Map + collect-and-`bulkPut` (src/sync/sync.ts:107-148); batch the OUT-OF-TX tombstone loop. Preserve unionDaily + couple-singleton merge rules.
- [ ] Memoize GroupSection + TodoRow + stable callbacks + memo per-group arrays (src/screens/Todos.tsx) — only render fix with felt payoff as list grows.
- [ ] clearDoneTodos → `bulkDelete` + `bulkPut` in one tx (src/db/repo.ts:185-195).
- [ ] Lazy-load i18n.id + date-fns id locale; await during bootstrap so id users don't flash English (src/lib/i18n.ts:4,7) — ~10-12KB gz off English path.
- [ ] Preload Fraunces-600 latin woff2 via Vite `transformIndexHtml` (hashed name — don't hand-pin); preload only that one face (index.html).
- [ ] `noUncheckedIndexedAccess` — 10 provably-safe sites → defensive narrowing (pairs with strict).
- [ ] SW cache hygiene: `ExpirationPlugin` on berdua-shell (sw.ts:25); bound image CacheFirst with smaller maxEntries + cacheableResponse[0,200] (sw.ts:39-45).
- [ ] ESLint env/coverage: node globals for api/, serviceworker for sw.ts, a `.mjs` block (eslint.config.js).
- [ ] oembed: give `stale-while-revalidate` a value (=604800) (api/oembed.ts:11); Redis cache optional/low-payoff.
- [ ] cron: pipeline writes + `Promise.allSettled` sends, collecting dead endpoints and filtering subscriptions ONCE after settling (api/cron.ts).

### P2 — real but skip here (verifier-confirmed low ROI at 2-user scale)
- React micro-memo (pet 15s ticks N≤3, useT, Calendar/MoodChart/Todos-filter) — microsecond-scale; tidy only if in the file.
- Dexie index/query tweaks (dead indexes — isComplete boolean can't index anyway; calendar index query; addTodoGroup last()+count() is net-neutral).
- Delta sync (send only changes) — large effort + merge-correctness risk; server still reads/writes whole doc.
- Conditional GET/304 — simple version needs a 2nd Redis op, fights the "1 op per GET" goal.
- Edge runtime for /api/state — it's a handler rewrite, not a flag; keep cheap lazy `import('web-push')` in ping.
- ESLint `recommendedTypeChecked` — valuable but sequence AFTER strict; slows lint.
- Drop legacy `.woff` fallbacks (~826KB dist) — needs custom transform; mostly subsumed by latin-subset switch.
- **Don't** adopt `exactOptionalPropertyTypes` — 26 benign Dexie/framer/date-fns noise errors.
- test script + CI — worthwhile but pre-team v0.1.0; CI-lint red until P0 #10 done.

### Already done right (leave alone)
Route code-splitting · read-mostly sync (1 Redis op/GET) · field-union daily merge · tombstone LWW + local-shadow
guard · photos kept out of the sync doc · inline pre-paint theme script (no dark flash) · CSS-var accent theming.

---

## 💭 Thinking-of-you HISTORY (2026-06-23, user request) — ✅ DONE
Problem: the "Thinking of you" ping was fire-and-forget (`/api/ping` only sent a Web Push; nothing persisted),
so clearing the notification lost the message. Now pings are **synced history** that survives a cleared
notification AND a reinstall (lives in IndexedDB + Redis), shown on a dedicated `/thinking` screen as a
sent + received thread (UX chosen by user: dedicated screen + both directions).
- New synced collection `ThinkingPing` (immutable, LWW-by-id) threaded through the existing pipeline exactly
  like other entities: `types.ts` (+SyncDoc/SyncSnapshot/SyncTable), `api/_lib/merge.ts` (emptyDoc + mergeDocs
  `mergeCollection`), `database.ts` v13 (additive `thinkingPings` store), `sync.ts` (buildSnapshot + applyRemote
  upsert), `repo.ts` (`addThinkingPing`/`deleteThinkingPing`), `hooks.ts` (`useThinkingPings`). `/api/ping`
  unchanged (push still fires); dev sync API unchanged (reuses merge.ts).
- Send flow (now on the `/thinking` screen): save the record FIRST, then `sendPing`, then `syncOnce(true)` so the
  partner pulls it even if the push fails. Record persists regardless of push success → syncs when back online.
- New `src/screens/Thinking.tsx` (route `/thinking`, lazy): chat-style thread (received left/cream, sent
  right/coral, handwritten message font, avatar + relative time via new `dates.relativeTime`), `EmptyState`,
  sticky "Send a ping" sheet, unsend (delete + tombstone) on your own pings only.
- `ThinkingOfYou` Home card → now navigates to `/thinking`, shows the latest received ping teaser + an **unread
  dot** (per-device `lastSeenThinkingAt` in `useSession`, cleared when the thread is opened).
- i18n: new EN strings + matching `i18n.id.ts` entries (verified all 13 thinking keys covered).
- **Verified:** `pnpm build` + `typecheck:api` clean; `pnpm lint` = the same 15 preexisting errors, 0 new in
  touched files; `test-sync.ts` 20/20 (added 3 ping merge/tombstone checks); new `scripts/test-thinking.mjs`
  2-device e2e PASS — A→B delivery, Home teaser, **and the message still present after a full reload of B**
  (proves IndexedDB persistence, the whole point), 0 console errors. Screenshots in shots/thinking-*.png.
- Deployed to https://berdua.vercel.app (prod smoke: root 200, /api/ping 405, /api/state returns `thinkingPings`).

### Composer refinement (2026-06-23, user request) — ✅ DONE
"Show the input on the page automatically, with quick auto-text, and keep it after sending so I can keep sending."
- Replaced the "Send a ping" button + BottomSheet with an **always-on chat composer** pinned to the bottom of
  `/thinking`: a scrollable row of preset quick-chips (tap = send) above a text input + send button. It stays
  put after each send (clears the field, keeps focus), so you can fire off several in a row.
- `/thinking` is now a focused conversation view: `AppShell` hides the global BottomNav + roaming PetCompanion
  there (back button handles navigation), so the composer owns the bottom.
- New i18n keys (EN + ID): empty-state subtitle + input placeholder. Thread ordering unchanged (newest first).
- **Verified:** build + lint clean (0 new); `test-thinking.mjs` updated + PASS — composer visible on open,
  persists after send, input clears, two messages sent in a row both land, B receives + survives reload.
  Screenshot shots/thinking-A-composer.png. NOT yet redeployed.

---

## 🗺️ FOOD MAP (2026-06-24, user request) — ✅ BUILT + VERIFIED (seed pending user inputs)
> "A map with dots on every food place on our wishlist — I type the name, it pins itself; see what's
> nearby and navigate." Source of dots = **🍜 Food-category todos that have a place**. Decided with user:
> type-to-search add flow · reuse Food todos · bulk-import their existing spots.

### Architecture — two independent FREE services, split (key decision)
- **Map canvas + tiles:** **MapLibre GL JS** (BSD, ~274 KB gz, GPU) + **OpenFreeMap** vector tiles
  (`tiles.openfreemap.org`, **no key, no usage cap, free commercial**). Lazy-loaded only on `/map`.
- **Name search (typeahead):** **Mapbox Search Box API** (`suggest`→`retrieve`, session-token billed) —
  best Jakarta POI coverage. Public `pk.*` token via `VITE_MAPBOX_TOKEN`, biased `country=id` +
  Jakarta `proximity` + `language=id`. **Geocoding v6 `reverse`** for the drop-pin fallback only.
- ⇒ Map loads NEVER hit Mapbox; only the search tier matters (free = 500 sessions/mo, ample for two).
- **No backend/sync changes** (verified): a new field on `Todo` rides the existing whole-record LWW
  (`merge.ts` has no field whitelist; `sync.ts` does `db.todos.put(r)` whole-record).

### Data layer (additive only)
- [ ] `types.ts`: add `interface Place { name: string; address?: string; lat: number; lng: number }`
      and `place?: Place` on `Todo`. (Auto-rides `SyncDoc`/`SyncSnapshot` — no other type edit.)
- [ ] `database.ts`: **v14** = re-declare `todos` store with its CURRENT index string
      (`'id, category, dueAt, createdAt, updatedAt'`), **no new index, no `.upgrade()`** (payload-only field).
- [ ] `repo.ts`: `setTodoPlace(id, place)` / `clearTodoPlace(id)` (thin `updateTodo` wrappers);
      `importFoodPlaces(rows, addedBy, foodCategoryId='food')` — **idempotent UPSERT by title**
      (case-insensitive, trimmed) within Food: exists → set `place`; else add located todo. One
      `notifyChange()` per batch, single `rw` txn. Returns `{added, updated, skipped}`.
      (Upsert, not skip — so it ENRICHES the user's existing Food todos AND adds new ones.)
- [ ] `hooks.ts`: `useLocatedTodos()` → Food todos where `place != null`, newest first.

### Lib
- [ ] `lib/mapbox.ts`: `searchPlaces(q)` (suggest, debounced, AbortController), `retrievePlace(id)`
      (retrieve → `{name,address,lat,lng}`), `reversePlace(lat,lng)`; per-session UUID via
      `crypto.randomUUID()`, new token after each `retrieve`. Reads `import.meta.env.VITE_MAPBOX_TOKEN`;
      degrades gracefully (disable search UI + show hint) when the token is absent.
- [ ] `lib/geo.ts`: `haversineKm(a,b)`, `formatDistance(km)` → `"220 m"` / `"1.2 km"` (**plain text,
      NO bar/percentage — per lessons**), `useGeolocation()` (watchPosition, permission-aware).
- [ ] `lib/navlinks.ts`: `navigateUrl(lat,lng,label)` — iOS/iPadOS → Apple Maps, else Google Maps
      universal HTTPS link (opens installed app, falls back to web).

### UI
- [ ] `components/PlaceSearchSheet.tsx`: `BottomSheet` (mirrors `BucketFormSheet` conventions) with a
      debounced search box → Mapbox suggestion list → tap fills the place; editable title (defaults to
      venue name). Used to (a) add a new located Food todo, (b) attach/replace a place on an existing todo.
- [ ] `components/PlacesMap.tsx`: MapLibre wrapper (lazy). Coral heart DOM markers from located todos,
      tap → `onSelect`, `fitBounds` to all pins, built-in `GeolocateControl` (distinct live-location dot).
- [ ] `screens/Map.tsx` (route `/map`, lazy): map on top (~55vh) + **Nearby** list below (located Food
      todos sorted by distance, plain "1.2 km" labels). Tap pin/row → select sheet: name · address ·
      distance · **Navigate** (deep link) · **Edit place** · **Remove**. Header "＋ Add place" → search sheet.
      Empty state "No places yet" + (when seed present) "Import our spots" → `importFoodPlaces(SEED)`.
- [ ] `components/BottomNav.tsx`: add 5th tab `/map` (lucide `MapPin`, label `'Map'`). 5 tabs fit (`flex-1`).
- [ ] `App.tsx`: lazy import + `<Route path="/map" element={<Map/>} />` inside `CoupleGate`.

### Offline + i18n + env
- [ ] `sw.ts`: `CacheFirst` route for `tiles.openfreemap.org/**/*.pbf` (ExpirationPlugin maxEntries 2000,
      `purgeOnQuotaError`) + `StaleWhileRevalidate` for style/glyph/sprite assets — placed ABOVE existing
      routes (first-match-wins) ⇒ revisited areas render offline.
- [ ] `i18n.id.ts`: ID translations for every new EN `t('…')` key (Map→Peta, Our map, Nearby→Terdekat,
      Navigate→Arahkan ke sini, Add a place, Search a place…, No places yet, Import our spots, Remove place…).
- [ ] `.env.example` + `.env.local`: add `VITE_MAPBOX_TOKEN=`. Document the Vercel env var (prod token,
      URL-restricted to berdua.vercel.app; dev token unrestricted in `.env.local`).

### Bulk-import their existing spots (needs user inputs)
- [ ] `scripts/geocode-places.mjs`: one-off — read `[{name, area}]` + city, call Mapbox per name,
      write `src/data/seedPlaces.ts` (`PlaceImport[]`). I run this once the token + list arrive.
- [ ] `src/data/seedPlaces.ts`: generated seed; consumed by the empty-state "Import our spots" button
      (idempotent upsert → also syncs to the partner's phone). Empty placeholder until inputs arrive.

### Verify (no "done" without proof)
- [ ] `pnpm build` + `pnpm typecheck:api` clean; `pnpm lint` = no NEW errors in touched files.
- [ ] `scripts/test-map.mjs` (Playwright, mirrors existing `test-*.mjs`): stub Mapbox `fetch`; assert
      pins render from located todos, Nearby sorts by distance, Navigate href correct per-platform,
      search→pin adds a Food todo, place **survives reload** (IndexedDB), 0 console errors. → `shots/map-*.png`.
- [ ] 2-context sync check: place added on A appears on B (rides existing Todo LWW).

### Inputs still needed from user (don't block the build — only the seed waits)
- Mapbox `pk.*` token → `VITE_MAPBOX_TOKEN` (live search + running the geocode script).
- Existing food spots: list of names + **city/area** (e.g. Jakarta Selatan) for disambiguation.

### UX decisions (locked with user 2026-06-24)
- Layout: **full-screen map + draggable bottom sheet** holding the Nearby list (maps-app feel).
- Entry: **5th bottom-nav tab** (📍 Map / Peta).

### Review — what shipped (all items above DONE except the seed file)
- Map canvas = **MapLibre GL JS + OpenFreeMap** (no key, lazy-loaded on /map, code-split chunk).
  `PlacesMap` diffs DOM heart-pin markers, fit-bounds once, live-location blue dot, WebGL-guarded.
- Search = **keyless by default** via `lib/places.ts`: **Photon** (OpenStreetMap, no signup/key —
  search + reverse), with **Mapbox Search Box as an automatic upgrade** when `VITE_MAPBOX_TOKEN` is
  set (better Jakarta POI coverage). Provider-agnostic `searchPlaces`/`resolveSuggestion`/`reversePlace`;
  the search box is always shown. (Pivoted off Mapbox-only after Mapbox signup rejected non-work emails.)
- `Todo.place?` field + Dexie **v14** (no index/upgrade) + `setTodoPlace`/`clearTodoPlace`/
  `addFoodPlace`/`importFoodPlaces` (idempotent upsert by title) — **zero API/sync changes** (rides
  whole-record LWW; confirmed by reading merge.ts — no field whitelist).
- Full-screen `/map` screen: draggable 2-snap sheet, Nearby list ranked by distance (plain "1.2 km"
  labels, **no bars** per lessons), tap → details + **Navigate** deep-link (iOS→Apple, else Google).
- `sw.ts` CacheFirst for `tiles.openfreemap.org/**/*.pbf` (+ SWR for style assets) ⇒ offline tiles.
- i18n EN keys + ID translations (reused existing `Remove`/`Save changes`); 5th nav tab; AppShell
  full-bleed handling (drops column padding + roaming pet on /map, keeps nav).
- **Verify:** `pnpm build` ✓ · `typecheck:api` ✓ · `pnpm lint` = 16 (15 baseline + 1 reset-on-open
  setState, identical to the accepted BucketFormSheet pattern; all warnings cleared). New
  `scripts/test-map.mjs` e2e (software WebGL, tiles stubbed, geolocation mocked) **PASS**: map+pins
  mount, add-without-token works, nearest-first sort, distance labels, Navigate URL hits Google Maps
  with correct coords, **survives reload (IndexedDB)**, 0 app console errors. `test-sync.ts` 20/20.
  Screenshot shots/map.png.

### Still pending (needs the user) — bulk-import seeding
- Home city = **Medan** (user, 2026-06-24) → `HOME_CENTER` in `src/lib/geo.ts` (single source of truth;
  biases search + sets the default map view). Photon Medan coverage spot-checked OK (Sushi Tei, Merdeka
  Walk, Ucok Durian, Tip Top all resolved). Only the **list of place names** is still needed.
- `scripts/geocode-places.mjs` written — **keyless (Photon)** by default, Mapbox if a token is set.
  Run once when the user pastes their food-spot names (NO token required). Writes
  `src/data/seedPlaces.ts`; the "Import our spots" button on the empty Map appears when it's non-empty.
- Live keyless search VERIFIED against Photon. Mapbox token now OPTIONAL (upgrade only).

### Update (2026-06-24) — change a place from the Wishlist + DEPLOYED
- **Manage place per Wishlist item:** the Todos "Edit to-do" sheet now has a **Place** section —
  "Pin a place on the map" (opens the shared `PlaceSearchSheet`), "Change", and "Remove from map".
  In-progress title/note edits are saved before swapping sheets. Each mapped row shows a `📍 <name>`
  line. Same `Todo.place` field → instantly reflected on the Map (one source of truth). No new types.
- **Deployed to production:** `npx vercel --prod` → **https://berdua.vercel.app** (READY). Smoke:
  `/`, `/map`, `/todos` all 200. Search is keyless (Photon) so NO env var was needed.
- **Verify:** `pnpm build` ✓ · lint = 16 (15 baseline + 1 known PlaceSearchSheet reset-on-open) ·
  `scripts/test-map.mjs` expanded e2e **PASS** (now also: Wishlist item → attach place via keyless
  search → shows `📍` line → appears on the Map). shots/map.png, shots/map-wishlist.png.

### Update 2 (2026-06-24) — auto-locate from existing wishlist titles + redeployed
- User: "the name is on the current wishlist food title" — so seeding now reads their OWN list, not a
  pasted one. Added **one-tap auto-locate** on the Map: a "Find {n} from your wishlist on the map"
  button (shown when there are Food todos without a place) geocodes each unlocated Food item BY TITLE
  (keyless Photon, Medan bias), pins it (label = the wishlist title, coords from the lookup), with
  live progress + a result toast. Runs on-device → no need to share the list. `useTodos` filter
  `category==='food' && !place && !done`; reuses `searchPlaces`/`resolveSuggestion`/`setTodoPlace`.
- This supersedes the manual seed/geocode-script path for this couple (script kept for completeness).
- e2e extended: add a food item with no place → button appears → tap → item lands on the map. **PASS**
  (11/11 checks, 0 console errors). Build ✓, lint still 16.
- **Redeployed** `npx vercel --prod` → https://berdua.vercel.app (READY); `/`, `/map` 200.

### Update 3 (2026-06-24) — make auto-locate catch the WHOLE food list reliably
- User wants their existing food list pinned automatically ("it's too much for me"). Clarified I can't
  do it server-side: the doc is private (keyed to their secret couple code) and `/api/state` POST caps
  the couple at 2 device slots → a 3rd-party write 409s. So the on-device one-tap button is THE path.
- Hardened detection: `foodGroupIds` now = built-in `'food'` PLUS any custom group with a 🍜 emoji or
  a food/kuliner/makan label, so a renamed Food category is still caught (`HOME_CITY='Medan'`).
- Better match rate: auto-locate retries `"<title> Medan"` when a bare title returns nothing.
- Build ✓ · lint 16 (unchanged) · e2e **PASS** (11/11) · redeployed to https://berdua.vercel.app.

### Update 4 (2026-06-24) — geocoding accuracy: keep matches in Medan
- Bug (user): "Airo Kitchen is in Medan but search doesn't show Medan nearby." Diagnosis via live
  Photon: proximity bias only RE-RANKS — "Airo Kitchen" fuzzy-matched "Aiko's kitchen" in **Sulawesi
  (2965 km)**. With a Medan bbox it returns nothing (OSM lacks it) → correct.
- Fix: `HOME_BBOX` (greater-Medan box) added to `searchPlaces` (Photon + Mapbox) → suggestions are
  now Medan-only (fixes the manual search too). Auto-locate **rejects matches >150 km** from home and,
  for items already pinned in the wrong city (>400 km), **re-locates or clears** them (no wrong pin
  left behind). Dropped the "+ city" fallback (it produced plausible-but-wrong local matches like
  "Queen Kitchen"). `needsLocating` now = food items with no place OR a clearly-wrong-city place.
- Truth: spots OSM doesn't have (e.g. Airo Kitchen) stay unpinned for manual entry — better than wrong.
- Build ✓ · lint 16 · e2e **PASS** · redeployed.

### Update 5 (2026-06-24) — card-free Google via shared links (for OSM misses like Airo Kitchen)
- Google Places API was a dead end: Indonesia GCP requires a **prepayment** to activate billing (the
  user's trial account was even closed). So we use Google's data WITHOUT the API/key/billing.
- **"Search '<title>' in Google Maps" button** in the place picker → opens the GMaps app pre-filled
  with the wishlist title + Medan (`gmapsSearchUrl` in `lib/navlinks.ts`). User finds it → Share →
  Copy link → pastes into a field → **server resolves the link to coords**.
- New `api/resolve-place.ts` + shared `api/_lib/resolveGmaps.ts`: host-allowlisted (anti-SSRF), parses
  `!3d!4d` / `@lat,lng` / `q=` / `[null,null,lat,lng]`. **Fast path**: a full URL with inline coords
  resolves with NO network; short links (maps.app.goo.gl) follow the redirect with a **6s timeout**
  (a missing timeout hung the UI on "Reading…" — see lessons). Dev parity via a vite.config middleware.
- Client `resolveGmapsLink()` in `lib/places.ts`; `PlaceSearchSheet` gets the GMaps button + paste
  field; the Google API key is now UNUSED (user can delete it).
- **Verify:** build ✓ · typecheck:api ✓ · lint 16 · e2e **PASS** (12 checks, incl. paste-link → pin,
  0 console errors) · resolver unit+live tested · **deployed**; prod `/api/resolve-place` returns
  `{lat,lng,name}` for a real Maps URL.

### Update 6 (2026-06-24) — short-link resolution: Google anti-bot defeats server scraping
- User pasted a real `maps.app.goo.gl` Airo Kitchen link → it pinned **15,262 km away (Ashburn, VA =
  Vercel's iad1 datacenter)**. Root cause: Google serves a datacenter IP a STRIPPED page containing
  only the region-localized **viewport** (`@lat,lng`), not the place's coords; the redirect chain
  carries only a place-id (`ftid`), never coords. Pinning the function to `sin1` (Singapore, via
  vercel.json `regions`) just moved the wrong answer to Singapore (628 km). The place coords only
  appear in the JS-rendered page, which a bot fetch never gets. (It works from a residential IP —
  that's why local tests passed.)
- Fix: (1) short-link resolution now trusts **place-specific signals ONLY** (`!3d!4d`, `q=`,
  embedded state) and returns null rather than the viewport → no more confidently-wrong pins;
  (2) the primary reliable path is now **pasting coordinates** — `resolveGmapsLink` parses
  `"lat, lng"` client-side (no lookup); UI placeholder "Paste a link or coordinates" + a tip to
  long-press the spot in Google Maps to copy them; (3) coords-bearing URLs still fast-path resolve;
  (4) client rejects any resolve >5000 km from home as a backstop. Function region pinned to `sin1`
  (also lower latency for the couple).
- **Verify:** build ✓ · typecheck:api ✓ · lint 16 · e2e **PASS** (12 checks, paste→pin via coords) ·
  resolver unit-tested · deployed (READY+aliased; final smoke blocked by a local DNS blip only).
- NOTE: Airo Kitchen resolved to ~**3.5684, 98.6677** when run from the user's own connection.

### Update 7 (2026-06-24) — per-row Navigate button on located wishlist items
- Each Wishlist row that has a `place` now shows a coral **Navigate** (↗) button just left of the
  Google-search icon → one tap opens directions (`openNavigation`, iOS→Apple / else Google Maps).
  Shown only when `todo.place` is set; mirrors the swipe-guard pattern of the row's other buttons.
- Build ✓ · lint 16 · e2e **PASS** (13 checks; added "Navigate button on located wishlist row") ·
  deployed to https://berdua.vercel.app (`/`, `/map`, `/todos` → 200).
