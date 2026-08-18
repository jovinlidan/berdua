// Wishlist swipe actions: swipe LATCHES open (no auto-fire); tap the revealed action to act;
// delete shows a confirm dialog. Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-wishlist-swipe.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const CODE = `swipe-${Date.now()}`
const browser = await chromium.launch()
const errs = []
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
p.on('pageerror', (e) => errs.push('PE:' + e.message))
const res = {}

await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', CODE)
await p.click('text=Begin, together')
await p.waitForTimeout(1200)
await p.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a task…"]')
for (const tt of ['Book cabin', 'Buy gift']) {
  await p.fill('input[placeholder="Add a task…"]', tt)
  await p.click('[aria-label="Add to-do"]')
  await p.waitForTimeout(250)
}

const row = (t) => p.locator('div.relative:not(.row)', { has: p.getByText(t, { exact: true }) }).last()
async function swipe(t, dx) {
  const box = await row(t).locator('div.row').boundingBox()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await p.mouse.move(cx, cy)
  await p.mouse.down()
  for (let i = 1; i <= 14; i++) await p.mouse.move(cx + (dx * i) / 14, cy, { steps: 1 })
  await p.mouse.up()
  await p.waitForTimeout(550)
}

// swipe left latches (does NOT auto-delete, does NOT open the editor on release)
await swipe('Buy gift', -120)
res.notAutoDeleted = (await p.getByText('Buy gift', { exact: true }).count()) === 1
res.noStrayEdit = (await p.getByText('Edit to-do').count()) === 0
// tap the revealed Delete → confirm dialog
await row('Buy gift').getByRole('button', { name: 'Delete', exact: true }).click()
await p.waitForTimeout(400)
res.dialogShown = (await p.getByText('Delete this task?').count()) > 0
// confirm → removed (let the sheet finish sliding in before tapping)
await p.waitForTimeout(400)
await p.locator('div[role="dialog"]').getByRole('button', { name: 'Delete', exact: true }).click()
await p.waitForTimeout(500)
res.confirmDeletes = (await p.getByText('Buy gift', { exact: true }).count()) === 0

// swipe right → reveal Done → tap → marked done
const before = await p.locator('[aria-label="Mark not done"]').count()
await swipe('Book cabin', 120)
await row('Book cabin').getByRole('button', { name: 'Done', exact: true }).click()
await p.waitForTimeout(400)
res.swipeDone = (await p.locator('[aria-label="Mark not done"]').count()) === before + 1

console.log(JSON.stringify(res, null, 2))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(res).every(Boolean) && errs.length === 0
console.log(pass ? '\nWISHLIST SWIPE E2E: PASS ✅' : '\nWISHLIST SWIPE E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
