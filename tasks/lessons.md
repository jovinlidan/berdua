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

## 2026-08-18: Never replace "from this marker to end of file" in a stylesheet

**Context:** The visual rebuild swapped the `@layer components { … }` block in `src/index.css` by
slicing from `s.index('@layer components {')` to the END of the file. Three unrelated blocks lived
after it and were silently deleted: the MapLibre marker CSS (`.place-pin*`, `.user-dot`), the iOS
date/time input reset, and the global `prefers-reduced-motion` rule.

**Lesson:** Nothing failed. `tsc`, `pnpm build`, `pnpm lint` and every logic test stayed green,
because deleted CSS has no compiler and the consumers were plain class strings
(`class="place-pin"`, `class="user-dot"`) in a file nobody touched. The result was invisible map
pins, an invisible location dot, date inputs overflowing their container on iOS, and animations for
people who asked for less motion.

**How to apply:** Edit stylesheets by replacing the exact block, never by slicing to EOF. After any
CSS restructure, diff the class names against the old file
(`git show main:src/index.css | grep -oE '^\.[a-z-]+' | sort -u`) and confirm every one still
exists or is genuinely unused (`grep -rn "place-pin" src/`). Screenshot the screens that own bespoke
CSS (here: the map) rather than only the screens you meant to change.

## 2026-08-17: A `.ts` module run by plain `node` may not gain relative imports
**Context:** `scripts/test-ics.mjs` runs under bare `node` and imports `src/lib/calendar.ts`
directly. Adding `import { … } from './recurrence'` to `calendar.ts` broke that script with
`ERR_MODULE_NOT_FOUND`, even though `pnpm build`, `tsc`, and the tsx-run tests were all green.

**Lesson:** Node ≥22 strips TypeScript types automatically, which is why importing a `.ts` file from
a `.mjs` script works at all, but it does **not** apply bundler resolution. Extensionless relative
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

## 2026-08-18: `tsc --noEmit` checks nothing in this repo; only `tsc -b` does
**Context:** Mid-refactor I ran `npx tsc --noEmit` four times and it exited 0 every time. Then
`pnpm build` immediately reported two real errors in the file I'd just changed: an out-of-scope
function reference and a dead declaration. The root tsconfig is solution-style (`"files": []` plus
`references`), so a bare `tsc --noEmit` type-checks an empty file list and cheerfully succeeds.

**Lesson:** A green typecheck from the wrong entry point is worse than no typecheck. It buys false
confidence and lets a broken refactor reach the browser. eslint didn't catch the scope error either
(it flagged only the *unused* half, which read as a harmless warning).

**How to apply:** Verify with `pnpm build` (which runs `tsc -b`) or `npx tsc -b` in this repo. Never
take `tsc --noEmit` as proof here. And when a refactor moves code between components, the reference
that breaks is the one that *silently resolved to an outer scope*, so check both sides of every
moved helper. [[hooks-live-above-the-early-return]]

## 2026-08-18: Hooks must sit above the screen's `if (!couple) return null` guard
**Context:** Adding a `useCallback` to the Wishlist screen, I placed it next to the handler it
replaced, which happened to sit *below* `if (!couple) return null`. Types passed, lint passed, the
dev server hot-reloaded fine. The production build crashed the whole screen with minified React
error #310 ("rendered more hooks than during the previous render"): on the first render `couple` is
undefined, so the guard returned before the hook ever ran.

**Lesson:** These screens all early-return on a loading hook result, which makes every line below
that guard a hooks-hostile zone. The failure is invisible to tsc, eslint and a warm HMR session, and
only shows up on a cold load, which is exactly the path a real user takes.

**How to apply:** Put every hook above the first `return` in the component, no exceptions, even when
that separates it from the code it serves. After adding a hook to a screen, cold-load that screen
once (a fresh page load, not HMR) before believing it works.

## 2026-08-18: Measure paint cost before "fixing" it; the obvious suspects were all zero
**Context:** Chasing reported jank, I had three confident suspects: a page-wide 3px tiled radial
gradient, eight `backdrop-blur` layers, and heavy card shadows. A/B-ing each one with a runtime
stylesheet override moved the total by **0ms**. The actual costs were somewhere else entirely: an
un-promoted animating sheet (`will-change: transform` cut Paint 34→7ms and Raster 48→3ms), a pet whose
`repeat: Infinity` framer-motion loops and 150ms `setInterval` sprite ran on every screen forever
(idle Layerize 155→3ms once they became CSS keyframes), and input state living on a big screen
component so each keystroke re-rendered 40 `layout` motion rows (65→33ms per keystroke).

**Lesson:** Paint intuitions are unreliable. Cheap-looking CSS (gradients, blur, shadows) is
rasterised once and reused; the real costs are *per-frame* work: anything unpromoted that animates,
anything looping forever, and anything that re-renders a big subtree on every keystroke. Also: the
first measurement of any interaction is polluted by first-mount and cold caches, so a lone "before"
number will overstate the win by roughly 2x.

**How to apply:** A/B with an injected `<style>` override before editing source. It takes a minute
and kills whole hypotheses. Attribute with a trace aggregated by event name (UpdateLayoutTree, Layout,
Paint, RasterTask, Layerize, Commit), not a single fps number. Always re-run the baseline *last* and
discard the first rep. `scripts/test-perf.mjs` does all of this.

## 2026-08-18: A local test server without gzip makes every byte-size finding 3x too scary
**Context:** Measuring cold start against a hand-rolled static server, first contentful paint came out
at 3832ms on a throttled CPU and a slow connection, and the biggest entries were 301KB and 281KB of
JS. Both numbers were fiction: the server sent raw bytes while any real host, Vercel included, serves
gzip or brotli. Adding gzip to the test server changed the same measurement to 1544ms, and the same
two files to 99KB and 90KB. Nearly a third of the apparent problem was the measuring instrument.

**Lesson:** An uncompressed local server does not model production, and the error is not small. It
overstates transfer time by roughly 3x for text assets, which is exactly the range that turns "fine"
into "needs work" and invites a pile of unnecessary bundle surgery.

**How to apply:** Compress text responses in any local server used for perf measurement before
believing a single number from it, and read sizes from `encodedBodySize` rather than from disk. When
a finding rests on bytes, state whether the number is compressed. [[measure-paint-before-fixing]]

## 2026-08-18: unicode-range already solved the font problem, so trimming subsets bought nothing
**Context:** The build shipped 744K of woff2 across 40 files, including cyrillic, cyrillic-ext and
vietnamese subsets for an app that renders English and Indonesian. Trimming to per-subset, per-weight
imports cut the deployed artifact from 3.8M to 2.7M and the files from 40 to 12. First contentful
paint went from 1528ms to 1520ms. No change, because fontsource declares each subset with a
`unicode-range`, so browsers were only ever downloading the latin files they needed. The unused
subsets sat in the build costing users nothing, and they were not in the service worker precache
either.

**Lesson:** Bytes sitting in a build directory are not bytes a user downloads. `unicode-range`,
lazy chunks and per-face font loading all mean the deployed size and the transferred size are
different measurements. Worth doing for smaller deploys and a tidier artifact; wrong to describe as
a speedup.

**How to apply:** Before optimising an asset, check what the browser actually requests (the network
panel, or `performance.getEntriesByType('resource')`), not what the build emitted. Then say which one
improved. The same check found the real precache problem: 1012KB of the 1848KB precache was one lazy
map chunk that every install paid for.

## 2026-08-18: A rejected lazy import takes down the whole app, not just that screen
**Context:** Every screen is `lazy(() => import(...))` behind a single root ErrorBoundary. Serving a
build with one chunk file deleted showed the entire app replaced by the crash screen, nav and all,
not merely a broken Map tab. This is reachable in normal use: a deploy renames every hashed chunk, so
a tab left open across one asks for a file that no longer exists.

**Lesson:** Code splitting quietly adds a failure mode per route, and the default blast radius is the
whole application. A lazy boundary is not an error boundary.

**How to apply:** Wrap the loader, not just the render: catch the import rejection, reload once when
online (which is what actually fixes a post-deploy hash change) guarded by a sessionStorage flag so a
genuine 404 cannot loop, and render a contained per-screen fallback otherwise. Verify by deleting a
chunk from a build, and verify the before-state too, so the claim is measured rather than assumed.

## 2026-08-18: A mouse-driven gesture test says nothing about a touch gesture
**Context:** Dragging the roaming pet opened its care sheet on every drop, on a real phone. There was
already a test asserting exactly the opposite, `dragDidNotOpenSheet`, and it had been passing for
months. It drags with `page.mouse`. On a mouse, framer-motion suppresses the `onTap` that follows a
drag by itself; with `pointerType: 'touch'` it does not, so `onTap` fires on the pointer-up that ENDS
the drag. Reproducing needed dispatched touch pointer events, and then every drag distance from 8px
to 100px opened the sheet while the pet still moved the full distance.

**Lesson:** For a phone-first app, a mouse-driven gesture assertion can be worse than no assertion:
it produces standing evidence that a broken interaction works. Mouse and touch take different paths
through a gesture library, and the touch path is the only one users take.

**How to apply:** Test gestures with `hasTouch: true` and dispatched `PointerEvent`s carrying
`pointerType: 'touch'`. Always confirm a new regression test FAILS against the unfixed code, which is
how the mouse case here was exposed as passing either way.

**Refined after auditing the other three draggables, which all turned out to be fine.** The rule is
narrower and more useful than "mouse differs from touch":

- `drag` + **`onClick`** is SAFE. framer-motion installs its own click blocker after a drag, so the
  click never reaches the handler. Map.tsx's sheet handle does exactly what looks like a bug (drag up
  sets expanded, then `onClick` toggles it straight back) and works correctly with a finger at every
  distance, because that click is swallowed. Verified with a control, since the naive test dispatches
  a synthetic click: a synthetic click with NO preceding drag DOES toggle the sheet, so the "no click
  after a drag" result is real and not an artefact of the instrument.
- `drag` + **`onTap`** is BROKEN. framer-motion does not extend that suppression to its own tap
  gesture, so `onTap` fires on the pointer-up ending a drag. This was the pet's bug, and `onTap` is
  the only combination that needs the `dragged` ref guard.

So when auditing, grep for `onTap` next to `drag`, not for every draggable. Checked and clean:
Map.tsx (onClick), Todos.tsx TodoRow (onClick, and it has the ref guard anyway), PetHabitat.tsx
(drag with no tap or click handler on the draggable at all).

## 2026-08-20: Put the gate where every caller already funnels through, not at each call site
**Context:** Routines gained an on/off switch, which had to stop them appearing in five places: the
Today list on the Routines screen, the Home summary, the calendar, the next-occurrence line, and the
cron's push window. Five call sites is five chances to miss one. All five already funnelled through
two functions in the recurrence engine (`occursOn` for "is it happening", `occurrenceKeys` for "list
the days", which `nextOccurrenceKey` and the cron both build on), so the check went in those two and
nothing else changed.

**Lesson:** Before adding a condition to N callers, look for the function they all already go
through. A single gate is not just less code, it is the difference between a feature that is
consistent by construction and one that is consistent until someone adds a sixth caller.

**How to apply:** Gate at the choke point, and be deliberate about what must NOT be gated: `hits`,
`occurrenceOrdinal`, `occurrenceTotal`, `routineProgress` and `routineStreak` were left alone on
purpose, because they report what a routine HAS done and a pause must not erase history or reset a
streak. Write that reasoning in the comment at the gate, since the omission is the part a later
reader will otherwise "fix".

## 2026-08-20: Switching something off should end its series, not erase it
**Context:** The first cut of pausing made a switched-off routine yield no occurrences at all, which
also removed its PAST days from the calendar along with whatever had been ticked on them. Storing
`pausedAt` (the day it was switched off) and treating a pause as a stricter `until` cost about six
lines and kept the history where it belonged.

**Lesson:** "Off" is a point in time, not a property of the whole record. Modelling it as a flag
alone silently rewrites the past; modelling it as a flag plus a date leaves the record honest, and
makes switching back on a resume rather than a restart.

**How to apply:** Any reversible off-switch on something with history wants the date too. A related
judgement went the other way and needed the e2e test to catch it: the first version also HID the
"how many times this happened" count on a switched-off row, when that total is exactly what you want
to see about a routine you have stopped. A test asserting the count survives being switched off is
what surfaced the design mistake, not a bug.

## 2026-08-20: `new Date('yyyy-mm-dd')` is UTC midnight, and quiet hours turn that into silence
**Context:** Switching the wishlist reminder from a datetime picker to a date picker looked like a
one-line change of `type="datetime-local"` to `type="date"`. The value it hands back is
`'2026-08-24'`, and `new Date` parses an ISO date-only string as UTC midnight, not local. Measured
across four zones: in Los Angeles that is the PREVIOUS day at 17:00; in London it is 01:00 and in
Jakarta 07:00, both inside the app's default quiet hours (22:00 to 08:00) where the cron drops
everything, so the reminder would never have been delivered at all. Three of four zones broken,
including the one the app is actually used in.

**Lesson:** A date-only string needs building from local calendar fields, never `new Date(value)`.
And a date-only reminder needs an explicit hour: midnight is both arbitrary and, with quiet hours in
play, exactly the hour that guarantees nothing arrives.

**How to apply:** Use the existing `localOccurrenceInstant(dayKey, 'HH:mm')` from `lib/recurrence`,
and check what hour the notification path will actually let through before picking one. The app had
already settled this once: Capsule's unlock uses `<input type="date">` with `T09:00`, so 09:00 was
the house convention waiting to be reused rather than a fresh decision. Test a date feature in a
WESTERN zone specifically, since a UTC-vs-local mistake often still looks right from UTC+7.
