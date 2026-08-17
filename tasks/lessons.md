# Lessons — Berdua

Patterns captured after user corrections, so the same mistake isn't repeated.

## 2026-06-15 — Don't relocate completed items to a separate section
**Correction:** "dont move the complete to separate category"

**Context:** The Todos screen rendered open tasks inside their category sections (Food/Movie/
Game/Travel) but pulled every *completed* task out into one global "Done ✓" section at the bottom.

**Lesson:** When a list is organised into user-meaningful categories, completed items should stay
**in their own category** — shown struck-through and sorted to the bottom of that section — not
moved into a separate global bucket. Moving them strips the category context the user organised by.

**How to apply:** For categorised/grouped lists, sort done-last *within each group* (e.g.
`sortDoneLast`) instead of partitioning open vs done at the top level. Keep destructive/bulk
actions (like "Clear completed") as a small action, not as a relocated listing of the items.

## 2026-06-15 — Don't add percentage/progress-bar UI
**Correction:** "no need percentage progress"

**Context:** The Todos screen had a card with "X% there" + an animated progress bar.

**Lesson:** This user dislikes percentage / progress-bar chrome. A plain count ("3 of 8 done") is
fine; a percentage and bar are unwanted visual weight. Don't add progress bars/percentages by
default — prefer a simple count, or nothing. (The one-off 100% confetti payoff is fine; it's a
moment, not a persistent progress indicator.)

## 2026-06-16 — A device identity must be persisted independently of Zustand `persist`
**Context:** Reworked onboarding to pairing-by-code: a `deviceId` claims a couple slot (A/B) on the
server, capped at 2 devices. `deviceId` was generated in the Zustand store initializer
(`deviceId: newId()`).

**Bug (caught only by e2e, not unit tests or typecheck):** Zustand `persist` writes to storage
**only on a `set()`**, never on store creation/hydration. Onboarding happened to trigger no `set()`
(the `activePartner` guard skipped it, notifs were off), so the `deviceId` was never persisted — and
was **regenerated on every page reload / PWA relaunch**. The server then saw an unknown device; once
both slots were full it returned **409 forever**, permanently breaking sync for that phone. A plain
refresh would brick it.

**Lesson:** Anything that must be stable for the lifetime of an install (a device id, an install id)
cannot live solely in a `persist`-backed store field initialized with a random value — its
persistence is conditional on an unrelated `set()` firing first. Give it its own durable storage key
read/written eagerly (`getDeviceId()` in `lib/id.ts`: read localStorage, generate+save once if
absent), independent of the store's change-triggered writes.

**How to apply:** For stable identifiers, write-on-first-read into a dedicated key; don't rely on a
store initializer + `persist` to durably keep a generated value. And verify identity-stability across
a **reload** in e2e — unit tests and typecheck can't catch "regenerates on reload".

## 2026-06-24 — Don't let `| tail` (or any pipe) mask a command's exit code
**Context:** Ran `pnpm build 2>&1 | tail -40 &` in the background. The notification reported "exit
code 0" and I nearly trusted it — but the build had actually FAILED (a TS error). The `0` was
`tail`'s exit code, not `pnpm build`'s; the pipe swallowed the real status.

**Lesson:** In a pipeline, `$?` and the process exit code come from the LAST command, not the failing
one. Piping a build/test/lint through `tail`/`grep`/`head` hides its real success/failure.

**How to apply:** When the exit code matters, capture it before piping:
`pnpm build > /tmp/out.log 2>&1; echo "EXIT:$?"; tail -25 /tmp/out.log` (or set `pipefail`). Always
read the actual EXIT line, not the harness's wrapper exit code, before declaring a step green.

## 2026-08-17 — A `.ts` module run by plain `node` may not gain relative imports
**Context:** `scripts/test-ics.mjs` runs under bare `node` and imports `src/lib/calendar.ts`
directly. Adding `import { … } from './recurrence'` to `calendar.ts` broke that script with
`ERR_MODULE_NOT_FOUND` — even though `pnpm build`, `tsc`, and the tsx-run tests were all green.

**Lesson:** Node ≥22 strips TypeScript types automatically, which is why importing a `.ts` file from
a `.mjs` script works at all — but it does **not** apply bundler resolution. Extensionless relative
specifiers (and the `.js`→`.ts` rewrite) are Vite/tsc behaviour only, so the first relative import
added to such a module breaks every plain-`node` consumer of it. A green typecheck cannot catch this.

**How to apply:** Before adding an import to a module under `src/lib/`, check whether any
`scripts/*.mjs` imports it under bare `node` (`grep -rn "lib/<name>" scripts/`). If so, keep that
module import-free and put the code that needs dependencies in a new module beside it (here:
`lib/todoIcs.ts` bridges `lib/calendar.ts` and `lib/recurrence.ts`). Always run the `.mjs` logic
tests with the runner they document, not with `tsx`, which papers the failure over.

## 2026-06-24 — Check i18n.id.ts for an existing key before adding a translation
**Context:** Added a `// Map` block of Indonesian strings to `src/lib/i18n.id.ts`; `Remove: 'Hapus'`
already existed later in the file. `tsc` failed with TS1117 (duplicate object literal property).

**Lesson:** `i18n.id.ts` is one big object literal — common words (`Remove`, `Edit`, `Save changes`,
`Add`) are very likely already translated. A duplicate key is a hard build error, not a warning.

**How to apply:** Before adding any i18n key, grep the file for it
(`grep -nE "^  '?<Key>'?:" src/lib/i18n.id.ts`) and reuse the existing entry. The English key is the
fallback, so a string with no ID entry still renders fine — only ADD what's genuinely new.

## 2026-06-24 — Don't make a feature depend on a 3rd-party signup; default to keyless + provider-agnostic
**Context:** Built the food-map name-search on Mapbox (needs a `pk.*` token). The user's Mapbox signup
was rejected — Mapbox now blocks personal/free email domains and demands a work/org email. The whole
feature's "type a name" flow was gated on an account the user couldn't easily create.

**Lesson:** This app is private/no-accounts/free by design. Hanging a core flow on a provider that
requires a credit card or work-email signup fights that ethos and can hard-block the user. Prefer a
**keyless default** (here: Photon / OpenStreetMap for search; OpenFreeMap for tiles — both no-key) and
make the integration **provider-agnostic** so a paid provider is an optional *upgrade*, not a
dependency. The map tiles were already keyless; the search should have been too from the start.

**How to apply:** When picking an external API for a feature, check the signup friction FIRST (credit
card? work email? rate caps?). If it's more than "paste a key", find a keyless OSS option and put it
behind a small interface (`lib/places.ts` here: `searchPlaces`/`resolveSuggestion`/`reversePlace`) so
swapping or upgrading providers is a one-file change, and the feature works out of the box for everyone.

## 2026-06-24 — Geocoder proximity bias only RE-RANKS; restrict with a bbox + reject far matches
**Context:** Auto-locating Medan food spots, "Airo Kitchen" got pinned to "Aiko's kitchen" in Sulawesi
(2965 km away). The Photon `lat/lon` proximity param only re-orders results — it does NOT exclude a
fuzzy match in another province. So a name OSM doesn't have locally still returns a confident wrong hit.

**Lesson:** For location search scoped to a city/region, proximity bias is not enough. Pass a **bounding
box** (`bbox`) to hard-restrict results, and add a **distance guard** that rejects any match beyond a
sane radius of home. A no-result (item left unpinned for manual entry) is far better than a confidently
wrong pin in the wrong city — don't paper over a miss with a looser query (appending the city name just
produced a different wrong local match, "Queen Kitchen").

**How to apply:** Geocoding for a known area → set `bbox` (and country) on the request, not just
proximity; verify with a known-absent name (it should return NOTHING in-box, not a far fuzzy match).
Guard accepted results by `haversineKm(home, hit) <= threshold`. For already-stored data that may be
wrong, re-process anything implausibly far from home (re-locate or clear), don't only fill blanks.

## 2026-06-24 — Always put a timeout on a server-side fetch (especially following external redirects)
**Context:** The "paste a Google Maps link" resolver did `await fetch(shortLink, { redirect: 'follow' })`
with no timeout. When a link didn't resolve cleanly, the fetch hung indefinitely → the serverless
request never returned → the UI button sat on "Reading…" forever. Caught by the e2e (button stayed
disabled, dialog text showed the stuck "Reading…" state).

**Lesson:** A bare `fetch` to an external host has no default timeout — a slow/looping redirect or a
dead host hangs the whole request and any UI awaiting it. This is worse when following redirects to a
third party you don't control (Google short links).

**How to apply:** Pass `signal: AbortSignal.timeout(ms)` (or an AbortController) to every server-side
`fetch`, and `try/catch` it. Also add a **fast path** that avoids the network entirely when possible
(here: a full Maps URL already contains coords, so parse-and-return without fetching at all). Verify
the hang path in e2e, not just the happy path.

## 2026-06-24 — Regional billing walls can kill a "free" API; have a card-free fallback ready
**Context:** Plan was Google Places (free tier covers two people). But Google Cloud in Indonesia
requires a **prepayment** to activate billing, and the user's trial billing account was closed —
so a key that's "free at our usage" still couldn't be activated without paying upfront.

**Lesson:** "Free tier" ≠ "free to turn on." Region-specific billing rules (prepayment, mandatory
card, closed trials) can block a provider entirely, regardless of usage. Don't architect a feature so
it *depends* on such a provider.

**How to apply:** Keep the keyless default working (OSM/Photon here), and for the gaps offer a path
that needs no billing at all — e.g. let the user search in the provider's own app and **paste a share
link we resolve server-side**. Same data, zero account/billing. [[geocoder-proximity-vs-bbox]]
[[prefer-keyless-provider-agnostic-search]]

## 2026-06-24 — Server-side scraping of Google Maps share links can't reliably get place coords
**Context:** Built a "paste a Google Maps share link, we resolve it server-side" feature. A real
`maps.app.goo.gl` link pinned 15,000 km away — at the **Vercel datacenter's** location. Google serves
a datacenter/bot IP a stripped page with only the region-localized map **viewport** (`@lat,lng`); the
goo.gl redirect chain carries only a place-id (`ftid`), never coordinates; the real place coords only
load via JS (which a server `fetch` never executes). Pinning the function to a closer region (sin1)
just relocated the wrong viewport answer. The same code worked from a residential IP (local tests),
which masked the problem.

**Lesson:** Following a share/short link server-side to scrape coordinates is fundamentally unreliable
for Google Maps — anti-bot + region-localized viewports + JS-rendered data. "It worked locally" is a
trap: your laptop has a residential IP; the server doesn't. Never trust a map's *viewport* center as a
place location, and never let a server fetch's region leak into user data.

**How to apply:** Prefer **user-supplied coordinates** (parse `"lat, lng"` from a paste — always
reliable, region-independent, no API). Accept coords-bearing URLs via a fast path. For
redirect-followed links, extract ONLY place-specific signals (`!3d!4d`, `q=`, embedded place data),
NEVER the `@`/`ll`/`center` viewport, and return null instead of a guess. Add a distance-from-home
backstop so a bad resolve is rejected, not pinned. Verify from the real server/region, not just local.
