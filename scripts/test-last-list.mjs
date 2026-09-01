// The list a to-do is filed under is remembered per device, and the two places that create one
// share that memory: pick Travel on the wishlist and the calendar's add sheet opens on Travel too.
//
// What this canNOT test is the deleted-list fallback: ensureDefaultTodoGroups reseeds the built-in
// lists on every load, so deleting one and reloading simply brings it back. That case lives in
// scripts/test-taxonomy.ts against the pure resolver, which is the right level for it anyway.
//
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-last-list.mjs
import { chromium } from 'playwright'

/**
 * Click a day cell by its key, stepping the month view when that day is not on the current grid.
 *
 * The grid draws six weeks around the cursor month, so a day a few either side of today can fall
 * outside it depending where today sits in its month. Clicking `[data-day=...]` directly made these
 * tests pass or fail by calendar date: run on the 1st, "three days ago" is off the grid entirely.
 */
async function pickDay(page, key) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const cell = page.locator(`[data-day="${key}"]`)
    if (await cell.count()) {
      await cell.click()
      await page.waitForTimeout(650)
      return
    }
    const shown = await page.locator('[data-day]').evaluateAll((els) => els.map((e) => e.dataset.day))
    await page.locator(`[aria-label="${key < shown[0] ? 'Previous month' : 'Next month'}"]`).click()
    await page.waitForTimeout(650)
  }
  throw new Error(`day ${key} never appeared on the calendar grid`)
}


const base = process.env.BASE || 'http://localhost:5173'
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const ctx = await b.newContext({ viewport: { width: 402, height: 880 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
p.on('console', (m) => m.type() === 'error' && !/vibrate/i.test(m.text()) && errs.push(m.text().slice(0, 140)))
const dk = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', `ll-${Date.now()}`)
await p.click('text=Begin, together'); await p.waitForTimeout(2300)

const r = {}
const remembered = () => p.evaluate(() => JSON.parse(localStorage.getItem('berdua-session') ?? '{}')?.state?.lastTodoList ?? null)
const catOf = (title) => p.evaluate(async (t) => {
  const db = await new Promise((res) => { const q = indexedDB.open('berdua'); q.onsuccess = () => res(q.result) })
  const rows = await new Promise((res) => { const g = db.transaction('todos','readonly').objectStore('todos').getAll(); g.onsuccess = () => res(g.result) })
  return rows.find((x) => x.title === t)?.category ?? null
}, title)

// wishlist: pick a NON-default list (Travel), create, and it should be remembered
await p.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a task…"]')
r.startsWithNothingRemembered = (await remembered()) === null
await p.locator('text=Travel').last().click(); await p.waitForTimeout(400)
await p.fill('input[placeholder="Add a task…"]', 'Trip planning')
await p.click('[aria-label="Add to-do"]'); await p.waitForTimeout(1000)
const travelId = await remembered()
r.rememberedAfterCreating = travelId !== null
r.filedUnderTravel = (await catOf('Trip planning')) === travelId

// a fresh visit to the wishlist must open on Travel, not the first group
await p.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a task…"]')
await p.waitForTimeout(900)
await p.fill('input[placeholder="Add a task…"]', 'Second task')
await p.click('[aria-label="Add to-do"]'); await p.waitForTimeout(1000)
r.wishlistDefaultsToRemembered = (await catOf('Second task')) === travelId

// and the CALENDAR sheet shares that memory
await p.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1600)
await pickDay(p, dk(3))
await p.locator('button:has-text("Add")').first().click(); await p.waitForTimeout(800)
await p.locator('[role=dialog] input').first().fill('Museum visit')
await p.locator('[role=dialog] button:has-text("Add to-do")').click(); await p.waitForTimeout(1300)
r.calendarSheetSharesTheMemory = (await catOf('Museum visit')) === travelId

console.log('remembered list id:', await remembered())
console.log(JSON.stringify(r, null, 2))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(r).every(Boolean) && errs.length === 0
console.log(pass ? '\nLAST LIST: PASS ✅' : '\nLAST LIST: FAIL ❌')
await b.close()
process.exit(pass ? 0 : 1)
