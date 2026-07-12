// End-to-end sync check: two isolated browser contexts (= two phones) sharing one
// couple code. Data added on A must appear on B and vice-versa. Needs `pnpm dev` running.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
const CODE = `lovebirds-e2e-${Date.now()}` // unique per run (dev sync store persists across runs)
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch()
const errors = []

async function onboard(label, code) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 880 } })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`${label} PAGEERROR: ${e.message}`))
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder="You"]')
  // New pairing flow: each phone enters only its OWN name + the shared code.
  await page.fill('input[placeholder="You"]', label === 'A' ? 'Alex' : 'Sayang')
  await page.fill('input[placeholder^="A secret word"]', code)
  await page.click('text=Begin, together')
  await page.waitForTimeout(1200)
  return page
}

async function addDream(page, title) {
  await page.goto(`${base}/bucket`, { waitUntil: 'domcontentloaded' })
  await page.click('[aria-label="Add dream"]')
  await page.fill('input[placeholder^="Something we want"]', title)
  await page.click('text=Add to our bucket')
}

// Phone A: onboard + add a dream
const pageA = await onboard('A', CODE)
await addDream(pageA, 'Visit Japan together')
await pageA.waitForTimeout(3000) // debounced push → server

// Phone B: onboard with the SAME code, should receive A's dream
const pageB = await onboard('B', CODE)
await pageB.waitForTimeout(3500) // mount sync pulls merged doc
await pageB.goto(`${base}/bucket`, { waitUntil: 'domcontentloaded' })
await pageB.waitForTimeout(1500)
const bSeesJapan = await pageB.locator('text=Visit Japan together').count()
await pageB.screenshot({ path: 'shots/sync-B-received.png' })

// Reverse: B adds, A receives
await addDream(pageB, 'Learn to surf')
await pageB.waitForTimeout(3000)
await pageA.bringToFront()
await pageA.evaluate(() => window.dispatchEvent(new Event('focus')))
await pageA.waitForTimeout(2500)
await pageA.goto(`${base}/bucket`, { waitUntil: 'domcontentloaded' })
await pageA.waitForTimeout(1200)
const aSeesSurf = await pageA.locator('text=Learn to surf').count()
await pageA.screenshot({ path: 'shots/sync-A-received.png' })

console.log('B received A’s "Visit Japan":', bSeesJapan > 0)
console.log('A received B’s "Learn to surf":', aSeesSurf > 0)
console.log('console errors:', errors.length ? errors : 'none')
console.log(bSeesJapan > 0 && aSeesSurf > 0 ? '\nSYNC E2E: PASS ✅' : '\nSYNC E2E: FAIL ❌')
await browser.close()
