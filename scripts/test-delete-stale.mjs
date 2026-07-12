// Deterministic repro for "deleted item comes back": after a local delete we force EVERY sync GET
// to return a STALE server doc that still contains the item (no tombstone). The deleted item must
// stay gone (local tombstone shadows the stale row). Without the fix it would reappear. Needs `pnpm dev`.
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const CODE = `del-${Date.now()}`
const browser = await chromium.launch()
const errs = []
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
p.on('pageerror', (e) => errs.push('PE:' + e.message))

// onboard + add a todo
await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', CODE)
await p.click('text=Begin, together')
await p.waitForTimeout(1500)
await p.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a task…"]')
await p.fill('input[placeholder="Add a task…"]', 'GhostTask')
await p.click('[aria-label="Add to-do"]')
await p.waitForTimeout(3000) // let it POST to the dev server

// capture the REAL server doc (it now contains GhostTask, no tombstone)
const staleDoc = await (await fetch(`${base}/api/state?code=${CODE}`)).json()
const hadGhost = JSON.stringify(staleDoc).includes('GhostTask')

// force EVERY GET to return that stale doc; let POST/DELETE hit the real server
await p.route('**/api/state*', async (route) => {
  if (route.request().method() === 'GET') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(staleDoc) })
  } else {
    await route.continue()
  }
})

// delete GhostTask locally, then hammer syncs (each focus → a sync cycle, GETs return the stale doc)
await p.locator('[aria-label="Delete to-do"]').first().click()
await p.waitForTimeout(400)
const goneImmediately = (await p.locator('text=GhostTask').count()) === 0
for (let i = 0; i < 12; i++) {
  await p.evaluate(() => window.dispatchEvent(new Event('focus')))
  await p.waitForTimeout(500)
}
const reappeared = (await p.locator('text=GhostTask').count()) > 0

console.log('captured stale doc had GhostTask:', hadGhost)
console.log('gone immediately after delete:', goneImmediately)
console.log('reappeared after 12 stale GETs:', reappeared)
console.log('errors:', errs.length ? errs : 'none')
const pass = hadGhost && goneImmediately && !reappeared && errs.length === 0
console.log(pass ? '\nDELETE-STALE E2E: PASS ✅' : '\nDELETE-STALE E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
