// Every screen is a lazy chunk, so every screen has a way to not arrive: a flaky network, or a
// deploy that renamed the hashed files under a tab which is still open. Before lazyScreen() in
// App.tsx, either case rejected the dynamic import and took down the WHOLE app through the root
// ErrorBoundary. These checks pin the two behaviours that replaced that:
//   offline  -> a contained per-screen panel, app shell intact
//   online   -> one reload (which is what actually fixes a post-deploy hash change), then the panel
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-chunk-fallback.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const results = {}

async function run(key, forceOffline) {
  // service workers blocked so nothing can quietly satisfy the chunk from a runtime cache
  const ctx = await browser.newContext({ viewport: { width: 402, height: 880 }, serviceWorkers: 'block' })
  const page = await ctx.newPage()
  if (forceOffline) {
    // the app chooses between "reload once" and "say it needs a connection" from navigator.onLine
    await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  }
  let navigations = 0
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations++ })
  // Make the Map screen's module unreachable. The pattern has to cover both shapes: a hashed
  // `assets/Map-<hash>.js` in a production build, and `src/screens/Map.tsx` under `pnpm dev`.
  await ctx.route(/(assets\/Map-[^/]*\.js|screens\/Map\.tsx)/, (route) => route.abort())
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder="You"]')
  await page.fill('input[placeholder="You"]', 'Alex')
  await page.fill('input[placeholder^="A secret word"]', `cf-${Date.now()}`)
  await page.click('text=Begin, together')
  await page.waitForTimeout(2500)
  const before = navigations
  await page.goto(`${base}/map`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  const body = await page.locator('body').innerText().catch(() => '')
  results[`${key}_showsPanel`] = body.includes('needs a connection')
  results[`${key}_noWholeAppCrash`] = !body.includes('Something hiccuped')
  results[`${key}_navStaysUsable`] = body.includes('Home') && body.includes('Wishlist')
  results[`${key}_reloads`] = navigations - before
  await ctx.close()
}

await run('offline', true)
await run('online', false)
// online may reload once to pick up renamed chunks; it must not loop
const reloadsSane = results.online_reloads <= 3 && results.offline_reloads <= 2
console.log(JSON.stringify(results, null, 2))
console.log('reload count sane (no loop):', reloadsSane)
const ok = results.offline_showsPanel && results.online_showsPanel &&
  results.offline_noWholeAppCrash && results.online_noWholeAppCrash &&
  results.offline_navStaysUsable && results.online_navStaysUsable && reloadsSane
console.log(ok ? '\nCHUNK FALLBACK: PASS ✅' : '\nCHUNK FALLBACK: FAIL ❌')
await browser.close()
if (!ok) process.exit(1)
