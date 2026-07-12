// Proves offline-friendliness against the production preview build (real service worker).
// Run `pnpm preview --port 5175` first.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5175'
mkdirSync('shots', { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 402, height: 880 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000) // let the SW install + precache the shell + chunks

await page.waitForSelector('input[placeholder="You"]')
await page.fill('input[placeholder="You"]', 'Alex')
await page.fill('input[placeholder="Them"]', 'Sayang')
await page.click('text=Begin, together')
await page.waitForTimeout(900)

// reload once online so the SW is controlling the page (mirrors opening an installed PWA)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

// ✈️ go offline
await ctx.setOffline(true)
await page.waitForTimeout(300)

// reload while offline — the SW must serve the cached shell
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
await page.waitForTimeout(2800)
await page.screenshot({ path: 'shots/22a-offline-reload.png' })
const loadedOffline = (await page.getByText('Memories').count()) > 0 // bottom-nav = app shell rendered
const bannerShown = await page.getByText(/Offline/).count()

// navigate + write data while offline (lazy chunk must come from cache; IndexedDB write works)
await page.goto(`${base}/bucket`, { waitUntil: 'load' }).catch(() => {})
await page.waitForTimeout(900)
await page.click('[aria-label="Add dream"]')
await page.fill('input[placeholder^="Something we want"]', 'Dream saved offline')
await page.getByText('Add to our bucket').click()
await page.waitForTimeout(500)
const savedOffline = await page.getByText('Dream saved offline').count()
await page.screenshot({ path: 'shots/22-offline.png' })

// 🔌 back online → banner clears
await ctx.setOffline(false)
await page.waitForTimeout(600)
const bannerCleared = (await page.getByText(/Offline —/).count()) === 0

console.log('loaded offline (cached shell):', loadedOffline > 0)
console.log('offline banner shown:', bannerShown > 0)
console.log('lazy route + write worked offline:', savedOffline > 0)
console.log('banner cleared on reconnect:', bannerCleared)
console.log('page errors:', errors.length ? errors : 'none')
console.log(
  loadedOffline > 0 && bannerShown > 0 && savedOffline > 0 && bannerCleared
    ? '\nOFFLINE: PASS ✅'
    : '\nOFFLINE: FAIL ❌',
)
await browser.close()
