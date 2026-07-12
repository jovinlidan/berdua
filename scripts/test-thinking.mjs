// E2E for "thinking of you" HISTORY + the always-on composer:
//  - the message input is visible immediately on opening /thinking (no button/sheet),
//  - it persists after sending so you can fire off several in a row,
//  - a ping A sends reaches B as durable history that survives a full reload of B (IndexedDB).
// Two isolated contexts = two phones. Needs `pnpm dev`.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
const CODE = `thinking-e2e-${Date.now()}`
const MSG = `miss you so much ${Date.now()}`
const MSG2 = `and again ${Date.now()}`
const INPUT = 'input[placeholder^="Write a little something"]'
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
  await page.fill('input[placeholder="You"]', label === 'A' ? 'Alex' : 'Sayang')
  await page.fill('input[placeholder^="A secret word"]', code)
  await page.click('text=Begin, together')
  await page.waitForTimeout(1200)
  return page
}

// Phone A: open the thread — the composer input should already be on screen (no button to tap).
const pageA = await onboard('A', CODE)
await pageA.goto(`${base}/thinking`, { waitUntil: 'domcontentloaded' })
await pageA.waitForTimeout(600)
const composerVisibleOnOpen = await pageA.locator(INPUT).count()

// Send one, then send a SECOND without reopening anything (proves the composer stays put).
await pageA.fill(INPUT, MSG)
await pageA.click('[aria-label="Send ping"]')
await pageA.waitForTimeout(1200)
const composerStillThere = await pageA.locator(INPUT).count()
const inputClearedAfterSend = (await pageA.locator(INPUT).inputValue()) === ''
await pageA.fill(INPUT, MSG2)
await pageA.click('[aria-label="Send ping"]')
await pageA.waitForTimeout(3000) // records saved + syncOnce(true) pushes them to the cloud
const aSeesBoth = (await pageA.locator(`text=${MSG}`).count()) > 0 && (await pageA.locator(`text=${MSG2}`).count()) > 0
await pageA.screenshot({ path: 'shots/thinking-A-composer.png' })

// Phone B: onboard with the SAME code → first sync pulls A's pings into history.
const pageB = await onboard('B', CODE)
await pageB.waitForTimeout(3500)
const bHomeTeaser = await pageB.locator(`text=${MSG2}`).count() // Home card shows the latest received ping
await pageB.goto(`${base}/thinking`, { waitUntil: 'domcontentloaded' })
await pageB.waitForTimeout(1500)
const bSeesPing = await pageB.locator(`text=${MSG}`).count()
await pageB.screenshot({ path: 'shots/thinking-B-received.png' })

// The whole point: reload B and the message is STILL there (lives in IndexedDB, not a notification).
await pageB.reload({ waitUntil: 'domcontentloaded' })
await pageB.goto(`${base}/thinking`, { waitUntil: 'domcontentloaded' })
await pageB.waitForTimeout(1500)
const bSeesAfterReload = await pageB.locator(`text=${MSG}`).count()

console.log('A: composer input visible on open (no button):', composerVisibleOnOpen > 0)
console.log('A: composer still there after sending:', composerStillThere > 0)
console.log('A: input cleared (ready for the next):', inputClearedAfterSend)
console.log('A: both messages sent in a row appear:', aSeesBoth)
console.log('B: Home shows the received-ping teaser:', bHomeTeaser > 0)
console.log('B: sees the ping in /thinking history:', bSeesPing > 0)
console.log('B: STILL sees it after a full reload (IndexedDB):', bSeesAfterReload > 0)
console.log('console errors:', errors.length ? errors : 'none')

const pass =
  composerVisibleOnOpen > 0 &&
  composerStillThere > 0 &&
  inputClearedAfterSend &&
  aSeesBoth &&
  bHomeTeaser > 0 &&
  bSeesPing > 0 &&
  bSeesAfterReload > 0
console.log(pass ? '\nTHINKING COMPOSER + HISTORY E2E: PASS ✅' : '\nTHINKING COMPOSER + HISTORY E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
