// The calendar's add sheet has four modes, not three: new to-do, new routine, pick from the
// wishlist, pick a routine. The two pickers are separate on purpose, because what can be picked
// differs per kind and so does the reason there might be nothing to pick, which one shared list
// with headings inside it cannot say clearly.
//
// Four chips do not fit a phone width, so that row scrolls; if it ever stops scrolling the last
// mode becomes unreachable, which is why that is asserted here.
//
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-calendar-pick-modes.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const p = await (await b.newContext({ viewport: { width: 402, height: 880 }, deviceScaleFactor: 2 })).newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
p.on('console', (m) => m.type() === 'error' && !/vibrate/i.test(m.text()) && errs.push(m.text().slice(0, 140)))
const dk = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', `sp-${Date.now()}`)
await p.click('text=Begin, together'); await p.waitForTimeout(2300)
// a wishlist to-do and a weekly routine (so it has off days)
await p.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a task…"]')
await p.fill('input[placeholder="Add a task…"]', 'Book the cabin')
await p.click('[aria-label="Add to-do"]'); await p.waitForTimeout(600)
await p.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a routine…"]')
await p.locator('button.chip').first().click(); await p.waitForTimeout(700)
await p.locator('[role=dialog] >> text=Weekly').first().click(); await p.waitForTimeout(400)
await p.locator('[role=dialog] button:has-text("Save")').first().click(); await p.waitForTimeout(700)
await p.fill('input[placeholder="Add a routine…"]', 'Date night')
await p.click('[aria-label="Add routine"]'); await p.waitForTimeout(900)

const r = {}
await p.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1600)
await p.locator(`[data-day="${dk(3)}"]`).click(); await p.waitForTimeout(700)
await p.locator('button:has-text("Add")').first().click(); await p.waitForTimeout(800)
// scope to the MODE row: `button.chip` also matches the category chips further down the sheet
const modeRow = p.locator('[role=dialog] div.overflow-x-auto').first()
const chips = await modeRow.locator('button.chip').allInnerTexts()
console.log('mode chips:', JSON.stringify(chips))
r.fourSeparateChips = chips.length === 4
r.hasBothPickChips = chips.some((c) => /Pick wishlist/.test(c)) && chips.some((c) => /Pick routine/.test(c))
// the chip row must be reachable on a phone width, not clipped off
r.chipRowScrolls = await p.evaluate(() => {
  const row = [...document.querySelectorAll('[role=dialog] div')].find((d) => d.className.includes('overflow-x-auto'))
  return !!row && row.scrollWidth >= row.clientWidth
})

// wishlist picker shows ONLY the to-do
await p.locator('[role=dialog] button:has-text("Pick wishlist")').click(); await p.waitForTimeout(700)
let sheet = await p.locator('[role=dialog]').innerText()
r.wishlistPickerShowsTodo = sheet.includes('Book the cabin')
r.wishlistPickerHidesRoutine = !sheet.includes('Date night')
r.wishlistPickerLabel = /Something on your wishlist/.test(sheet)

// routine picker shows ONLY the routine
await p.locator('[role=dialog] button:has-text("Pick routine")').click(); await p.waitForTimeout(700)
sheet = await p.locator('[role=dialog]').innerText()
r.routinePickerShowsRoutine = sheet.includes('Date night')
r.routinePickerHidesTodo = !sheet.includes('Book the cabin')
r.routinePickerLabel = /One of your routines/.test(sheet)

// picking from the routine picker still works
await p.locator('[role=dialog] button', { hasText: 'Date night' }).first().click(); await p.waitForTimeout(1400)
r.routinePickStillWorks = (await p.locator('body').innerText()).includes('Date night')

// and the two "new" modes still create
await p.locator('button:has-text("Add")').first().click(); await p.waitForTimeout(700)
await p.locator('[role=dialog] button:has-text("New to-do")').click(); await p.waitForTimeout(500)
await p.locator('[role=dialog] input').first().fill('Fresh task')
await p.locator('[role=dialog] button:has-text("Add to-do")').click(); await p.waitForTimeout(1300)
r.newTodoStillWorks = (await p.locator('body').innerText()).includes('Fresh task')
console.log(JSON.stringify(r, null, 2))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(r).every(Boolean) && errs.length === 0
console.log(pass ? '\nCALENDAR PICK MODES: PASS ✅' : '\nCALENDAR PICK MODES: FAIL ❌')
await b.close()
process.exit(pass ? 0 : 1)
