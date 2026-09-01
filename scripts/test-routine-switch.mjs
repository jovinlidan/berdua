// Two halves of one idea, and they have to hold together:
//
//   The Routines screen MANAGES routines. Its circle is the routine's own on/off switch, not a tick
//   for today. Switching one off stops it coming around, but must keep the days it already happened
//   on (a pause ends the series at the day it was switched off, it does not erase it) and must not
//   touch the tick history.
//
//   The CALENDAR records what really happened, against the day it happened on. That is the only
//   place that can be honest about a routine kept on Tuesday but not on Wednesday, so the count on
//   the Routines screen is fed from there.
//
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-routine-switch.mjs
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
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const ctx = await browser.newContext({ viewport: { width: 402, height: 880 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
// headless Chromium refuses navigator.vibrate; that is a browser policy notice, not an app error
page.on('console', (m) => m.type() === 'error' && !/vibrate/i.test(m.text()) && errs.push(m.text().slice(0, 140)))
const res = {}

const dayKey = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const rowFor = (title) => page.locator('.row').filter({ hasText: title }).first()

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="You"]')
await page.fill('input[placeholder="You"]', 'Alex')
await page.fill('input[placeholder^="A secret word"]', `rs-${Date.now()}`)
await page.click('text=Begin, together')
await page.waitForTimeout(2200)

await page.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="Add a routine…"]')

// Start it five days ago, so it HAS past occurrences. A routine created with the default rule starts
// today and has nothing behind it, which makes "the days it already happened on" untestable.
await page.locator('button.chip').first().click()
await page.waitForTimeout(700)
await page.locator('[role=dialog] input[type="date"]').first().fill(dayKey(-5))
await page.waitForTimeout(400)
await page.locator('[role=dialog] button:has-text("Save")').first().click()
await page.waitForTimeout(800)

for (const name of ['Morning walk', 'Cook together']) {
  await page.fill('input[placeholder="Add a routine…"]', name)
  await page.click('[aria-label="Add routine"]')
  await page.waitForTimeout(500)
}
await page.waitForTimeout(900)

// ── the circle is an on/off switch, not a tick ──────────────────────────────────────────────────
res.circleIsASwitch = (await page.locator('[role="switch"]').count()) === 2
res.everyRoutineStartsOn = (await page.locator('[role="switch"][aria-checked="true"]').count()) === 2
// a routine due today must not advertise today as its "next" day
res.todayRowDoesNotSayNextToday = !(await rowFor('Morning walk').innerText()).includes('next')

// ── ticking happens on the calendar, and it is what gets counted ────────────────────────────────
await page.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1600)
let ticked = 0
for (const offset of [-1, -2, -3]) {
  const cell = page.locator(`[data-day="${dayKey(offset)}"]`)
  if (!(await cell.count())) continue
  await cell.click()
  await page.waitForTimeout(700)
  const check = page.locator('[aria-label="Mark done"]').first()
  if (!(await check.count())) continue
  await check.click()
  await page.waitForTimeout(700)
  ticked++
}
res.tickedThreePastDaysOnTheCalendar = ticked === 3

await page.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const counted = await rowFor('Morning walk').innerText()
res.routinesScreenCountsThem = /3 done/.test(counted)

// ── switching off: stops coming around, keeps the count ─────────────────────────────────────────
await rowFor('Morning walk').locator('[role="switch"]').click()
await page.waitForTimeout(1300)
res.switchedOffSectionAppears = (await page.locator('body').innerText()).includes('Switched off')
res.switchReadsOff = (await rowFor('Morning walk').locator('[role="switch"]').getAttribute('aria-checked')) === 'false'
res.countSurvivesSwitchingOff = /3 done/.test(await rowFor('Morning walk').innerText())

await page.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1600)
// today is on or after the pause day, so it stops being expected
await pickDay(page, dayKey(0))
await page.waitForTimeout(800)
let dayText = await page.locator('body').innerText()
res.goneFromTodayOnTheCalendar = !dayText.includes('Morning walk')
res.otherRoutineUnaffected = dayText.includes('Cook together')
// but the days it already happened on keep their place, ticks and all
await pickDay(page, dayKey(-3))
await page.waitForTimeout(800)
res.pastDaysKeepTheirPlace = (await page.locator('body').innerText()).includes('Morning walk')

// ── switching back on resumes ─────────────────────────────────────────────────────────────────
await page.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1300)
await rowFor('Morning walk').locator('[role="switch"]').click()
await page.waitForTimeout(1300)
res.backOn = (await rowFor('Morning walk').locator('[role="switch"]').getAttribute('aria-checked')) === 'true'
res.countStillThere = /3 done/.test(await rowFor('Morning walk').innerText())
await page.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1600)
await pickDay(page, dayKey(0))
await page.waitForTimeout(800)
res.returnsToTheCalendar = (await page.locator('body').innerText()).includes('Morning walk')

console.log(JSON.stringify(res, null, 2))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(res).every(Boolean) && errs.length === 0
console.log(pass ? '\nROUTINE SWITCH: PASS ✅' : '\nROUTINE SWITCH: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
