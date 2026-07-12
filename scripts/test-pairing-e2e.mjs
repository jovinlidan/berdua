// End-to-end pairing-by-code check (three "phones" = three isolated browser contexts):
//  1. Phone A enters only its own name + a code → enters app, sees "waiting for partner".
//  2. Phone B enters the SAME code → pairs in; both phones see each other's names.
//  3. Phone C tries the same code → rejected ("already belongs to another pair").
// Needs `pnpm dev` running. Run: BASE=http://localhost:5208 node scripts/test-pairing-e2e.mjs
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5208'
// Unique per run — the dev sync store is an in-memory Map that persists across runs, so a fixed
// code would already be "full" from a prior run and reject this run's fresh devices.
const CODE = `pairing-e2e-${Date.now()}`
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch()
const errors = []

async function newPhone(label) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 880 } })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`${label} PAGEERROR: ${e.message}`))
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder="You"]')
  return page
}

async function onboard(page, name, code) {
  await page.fill('input[placeholder="You"]', name)
  await page.fill('input[placeholder^="A secret word"]', code)
  await page.click('text=Begin, together')
}

const results = {}

// ── Phone A: claim the code ───────────────────────────────────────────────────
const pageA = await newPhone('A')
await onboard(pageA, 'Alex', CODE)
await pageA.waitForTimeout(1500)
results.aEnteredApp = !pageA.url().includes('/welcome')
results.aSeesWaiting = (await pageA.locator('text=Waiting for your partner').count()) > 0
await pageA.screenshot({ path: 'shots/pair-A-waiting.png' })

// ── Phone B: same code → should pair as the second person ─────────────────────
const pageB = await newPhone('B')
await onboard(pageB, 'Sayang', CODE)
await pageB.waitForTimeout(2500)
results.bEnteredApp = !pageB.url().includes('/welcome')
await pageB.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' })
await pageB.waitForTimeout(1500)
results.bSeesPartnerAlex = (await pageB.locator('text=Alex').count()) > 0
results.bNoWaiting = (await pageB.locator('text=Waiting for your partner').count()) === 0
await pageB.screenshot({ path: 'shots/pair-B-paired.png' })

// ── Phone A re-syncs: should now see Sayang and lose the waiting banner ────────
await pageA.bringToFront()
await pageA.evaluate(() => window.dispatchEvent(new Event('focus')))
await pageA.waitForTimeout(2500)
await pageA.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' })
await pageA.waitForTimeout(1200)
results.aSeesPartnerSayang = (await pageA.locator('text=Sayang').count()) > 0
await pageA.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await pageA.waitForTimeout(1200)
results.aNoWaitingAfterPair = (await pageA.locator('text=Waiting for your partner').count()) === 0
await pageA.screenshot({ path: 'shots/pair-A-paired.png' })

// ── Phone C: third device, same code → rejected ───────────────────────────────
const pageC = await newPhone('C')
await onboard(pageC, 'Intruder', CODE)
await pageC.waitForTimeout(2000)
results.cRejected = (await pageC.locator('text=already belongs to another pair').count()) > 0
results.cStaysOnWelcome = pageC.url().includes('/welcome') || (await pageC.locator('input[placeholder="You"]').count()) > 0
await pageC.screenshot({ path: 'shots/pair-C-rejected.png' })

// Only the 3rd device (C) is allowed a 409 — that's its legitimate rejection. A 409 from A or B
// would mean a device lost its slot (e.g. an unstable deviceId across reloads) — a real bug.
const realErrors = errors.filter((e) => !(e.startsWith('C:') && e.includes('409')))
console.log(JSON.stringify(results, null, 2))
console.log('unexpected errors:', realErrors.length ? realErrors : 'none')
console.log('(expected 409s, e.g. the rejected 3rd device:', errors.length - realErrors.length, ')')
const pass =
  results.aEnteredApp &&
  results.aSeesWaiting &&
  results.bEnteredApp &&
  results.bSeesPartnerAlex &&
  results.bNoWaiting &&
  results.aSeesPartnerSayang &&
  results.aNoWaitingAfterPair &&
  results.cRejected &&
  results.cStaysOnWelcome &&
  realErrors.length === 0
console.log(pass ? '\nPAIRING E2E: PASS ✅' : '\nPAIRING E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
