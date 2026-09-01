// Managing which routines land on ONE calendar day, add and remove, with a DAILY routine.
//
// Daily is the default rule, and it is the case that broke: the picker hides a routine that already
// lands on the day, so a daily one was hidden on EVERY day and the sheet just said "Nothing to pick
// yet". An earlier test passed only because it used a WEEKLY routine to find an off day. Any test
// about this picker has to use the default rule to mean anything.
//
// Removing takes one occurrence off without touching the repeat, so the days either side must be
// untouched and the rule must come back unchanged.
//
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-calendar-routine-day.mjs
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
const p = await (await b.newContext({ viewport: { width: 402, height: 880 }, deviceScaleFactor: 2 })).newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
p.on('console', (m) => m.type() === 'error' && !/vibrate/i.test(m.text()) && errs.push(m.text().slice(0, 140)))
const dk = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', `fx-${Date.now()}`)
await p.click('text=Begin, together'); await p.waitForTimeout(2300)
await p.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a routine…"]')
await p.fill('input[placeholder="Add a routine…"]', 'Morning walk')
await p.click('[aria-label="Add routine"]'); await p.waitForTimeout(900)

const r = {}
const day = dk(2)
await p.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1600)
await pickDay(p, day)
r.dailyRoutineShowsOnTheDay = (await p.locator('body').innerText()).includes('Morning walk')

// the picker's empty state must explain itself instead of reading as broken
await p.locator('button:has-text("Add")').first().click(); await p.waitForTimeout(700)
await p.locator('[role=dialog] button:has-text("Pick routine")').click(); await p.waitForTimeout(600)
const sheet = await p.locator('[role=dialog]').innerText()
r.emptyStateExplainsWhy = /already happen on this day/.test(sheet)
r.noLongerSaysNothingToPick = !/No routines yet/.test(sheet)
await p.keyboard.press('Escape'); await p.waitForTimeout(700)

// remove it from THIS day only
r.removeButtonPresent = (await p.locator('[aria-label="Not on this day"]').count()) > 0
// guarded: without the remove control the click would time out and take the whole run down, hiding
// every other result. A missing button should read as one failed check, not a crash.
if (r.removeButtonPresent) {
  await p.locator('[aria-label="Not on this day"]').first().click()
  await p.waitForTimeout(1400)
}
r.goneFromThatDay = !(await p.locator('body').innerText()).includes('Morning walk')

// the days around it are untouched
await pickDay(p, dk(1))
r.stillOnTheDayBefore = (await p.locator('body').innerText()).includes('Morning walk')
await pickDay(p, dk(3))
r.stillOnTheDayAfter = (await p.locator('body').innerText()).includes('Morning walk')

// and now that it is off that day, the picker offers it again there
await pickDay(p, day)
await p.locator('button:has-text("Add")').first().click(); await p.waitForTimeout(700)
await p.locator('[role=dialog] button:has-text("Pick routine")').click(); await p.waitForTimeout(600)
r.offeredAgainAfterRemoval = (await p.locator('[role=dialog]').innerText()).includes('Morning walk')
if (r.offeredAgainAfterRemoval) {
  await p.locator('[role=dialog] button', { hasText: 'Morning walk' }).first().click()
  await p.waitForTimeout(1400)
} else {
  await p.keyboard.press('Escape')
  await p.waitForTimeout(600)
}
r.canPutItBack = (await p.locator('body').innerText()).includes('Morning walk')

// the rule is untouched throughout, and the two lists never both hold the day
const rule = await p.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('berdua'); q.onsuccess = () => res(q.result) })
  const rows = await new Promise((res) => { const g = db.transaction('todos','readonly').objectStore('todos').getAll(); g.onsuccess = () => res(g.result) })
  return rows.find((x) => x.title === 'Morning walk')?.routine ?? null
})
console.log('rule after remove-then-restore:', JSON.stringify(rule))
r.ruleStillDaily = rule?.freq === 'daily' && rule?.interval === 1
r.listsAreDisjoint = !(rule?.skipDates ?? []).some((d) => (rule?.extraDates ?? []).includes(d))
console.log(JSON.stringify(r, null, 2))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(r).every(Boolean) && errs.length === 0
console.log(pass ? '\nCALENDAR ROUTINE DAY: PASS ✅' : '\nCALENDAR ROUTINE DAY: FAIL ❌')
await b.close()
process.exit(pass ? 0 : 1)
