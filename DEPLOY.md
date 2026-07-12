# Deploying Berdua (free) + turning on sync & reminders

Everything is **$0** on free tiers: Vercel Hobby + Upstash Redis free + cron-job.org + self-generated VAPID keys.

Phase 1 (the app) works with zero setup. The steps below light up **phase 2**: cross-phone sync and
scheduled push reminders.

> Your VAPID keypair is already generated and stored in `.env.local` (gitignored). The **public** key is
> also baked into the app as a default; the **private** key must only ever live in Vercel's server env.

---

## 1. Put the code on GitHub (recommended)
```bash
cd berdua
git init && git add -A && git commit -m "Berdua"
gh repo create berdua --private --source=. --push   # or create a repo in the GitHub UI and push
```
(You can also skip Git and deploy with `vercel` from the CLI.)

## 2. Create a free Upstash Redis database
- Go to **upstash.com** → sign up (free, no card) → **Create Database** (Redis, pick a nearby region).
- Open the database → **REST API** section → copy **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`**.
- _(Alternative: in the Vercel dashboard → Storage → Upstash integration does this for you.)_

## 3. Deploy to Vercel
- **vercel.com** → **Add New → Project** → import your `berdua` repo (Vercel auto-detects Vite + the `api/` functions). Deploy.
- Or from the CLI: `npm i -g vercel && vercel` then `vercel --prod`.

## 4. Set the environment variables in Vercel
Project → **Settings → Environment Variables** (Production), then redeploy:

| Name | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | from Upstash (step 2) |
| `UPSTASH_REDIS_REST_TOKEN` | from Upstash (step 2) |
| `VITE_VAPID_PUBLIC_KEY` | the public key in `.env.local` |
| `VAPID_PRIVATE_KEY` | the **private** key in `.env.local` (keep secret) |
| `VAPID_SUBJECT` | `mailto:you@yourdomain.com` |
| `CRON_SECRET` | any long random string (you choose) |

## 5. Schedule the reminder cron (free, every ~15 min)
Vercel Hobby cron only fires **once/day** — too coarse. Use **cron-job.org** (free):
- Create a job hitting: `https://YOUR-APP.vercel.app/api/cron?key=YOUR_CRON_SECRET`
- Schedule: **every 15 minutes**. Method GET. Done.
- Test it now by opening that URL in a browser — it should return `{"ok":true,...}`.

## 6. Install on both phones & link
1. Open `https://YOUR-APP.vercel.app` on each phone.
2. **iPhone:** Share → Add to Home Screen. **Android:** ⋮ → Install app. (Push needs this on iPhone.)
3. Open from the home-screen icon. In onboarding (or Settings), set the **same couple-space code** on both phones.
4. Tap **Turn on reminders** on each phone (grants permission + subscribes to push).
5. Settings → "Sync between phones" should show **Synced**. Add a date idea on one phone — it appears on the other within ~15s.

## Test the full reminder loop
- Plan a date ~5–10 minutes in the future (so the "soon" window triggers), then open the cron URL a couple of times.
- A push should arrive on both phones. Tapping it deep-links into the app.

---

## How it works (so future-you remembers)
- **Sync:** one JSON doc per couple in Upstash, keyed by the couple-space code. The app POSTs a photo-free
  snapshot to `/api/state`; the server merges it (per-record last-write-wins + tombstones) and returns the
  merged doc, which the app applies into IndexedDB. Photos stay on-device.
- **Push:** the app subscribes to Web Push (VAPID) and stores the subscription in that doc. `cron-job.org`
  pings `/api/cron`, which reads each couple's planned dates / to-dos / anniversary, respects quiet hours
  (using the stored tz offset), and sends Web Push via `web-push`. The service worker (`src/sw.ts`) shows
  the notification and deep-links on tap.

## Local testing without deploying
`pnpm dev` includes an in-memory `/api/state` (see `vite.config.ts` → `devSyncApi`), so you can open the app
in two browser profiles with the same couple-space code and watch sync work locally. (Push reminders need the
deployed cron.)
