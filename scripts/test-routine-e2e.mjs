// Routines end to end, on their own screen: create a repeating activity, tick one day off, see it
// on the calendar and Home, and prove BOTH phones' ticks survive the merge (the thing unit tests
// can't reach). Routines are deliberately absent from the wishlist, which this also checks.
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-routine-e2e.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const CODE = `routine-${Date.now()}`
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const errors = []
const results = {}

const pad = (n) => String(n).padStart(2, '0')
/** Local ISO day, `offset` days from today, in the same key format routines are stored in. */
const iso = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const SUMMARY = 'Every day · 20:00'

// Headless Chromium refuses navigator.vibrate until the frame has *sticky* user activation, so the
// first haptic after each navigation logs a browser policy notice. It is not an app error.
const benign = (text) => text.includes('navigator.vibrate')

async function newPhone(label) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 880 } })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && !benign(m.text()) && errors.push(`${label}: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`${label} PAGEERROR: ${e.message}`))
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder="You"]')
  return page
}
async function onboard(page, name, code) {
  await page.fill('input[placeholder="You"]', name)
  await page.fill('input[placeholder^="A secret word"]', code)
  await page.click('text=Begin, together')
  await page.waitForTimeout(1800)
}

// ── Phone A: a daily routine that started 3 days ago, at 20:00 ────────────────
const A = await newPhone('A')
await onboard(A, 'Alex', CODE)
await A.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await A.waitForSelector('input[placeholder="Add a routine…"]')
await A.fill('input[placeholder="Add a routine…"]', 'Evening walk')
await A.click('text=Every day')            // the composer's rule chip
await A.waitForSelector('text=Repeat this')
await A.fill('[role="dialog"] input[type="date"]', iso(-3))
await A.fill('[role="dialog"] input[type="time"]', '20:00')
results.previewsNextDays = (await A.locator('text=Next:').count()) > 0
await A.click('text=Save routine')
await A.waitForTimeout(400)
results.chipShowsRule = (await A.locator(`text=${SUMMARY}`).count()) > 0
await A.click('[aria-label="Add routine"]')
await A.waitForTimeout(700)
results.rowShowsRoutine = (await A.locator(`text=${SUMMARY}`).count()) > 0
// The circle on this screen switches the routine on and off; it does NOT tick a day. Ticking moved
// to the calendar, against the day it happened (see scripts/test-routine-switch.mjs).
results.routinesScreenHasASwitchNotATick =
  (await A.locator('[role="switch"]').count()) > 0 && (await A.locator('[aria-label="Mark done"]').count()) === 0
results.switchStartsOn = (await A.locator('[role="switch"][aria-checked="true"]').count()) > 0

// tick TODAY from the calendar, which is now the only place a day gets recorded
await A.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' })
await A.waitForTimeout(1400)
await A.click('[aria-label="Mark done"]')
await A.waitForTimeout(700)
results.tickedToday = (await A.locator('[aria-label="Mark not done"]').count()) > 0
await A.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await A.waitForTimeout(900)
results.routineStaysOnList = (await A.locator(`text=${SUMMARY}`).count()) > 0

// the wishlist is for one-off tasks now: the routine must not appear there
await A.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await A.waitForTimeout(900)
results.wishlistHasNoRoutine = (await A.locator('text=Evening walk').count()) === 0
results.wishlistLinksToRoutines = (await A.locator('text=Our routines').count()) > 0

// Home summarises today's routines
await A.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await A.waitForTimeout(900)
results.homeShowsRoutines = (await A.locator('text=Our routines today').count()) > 0

// the calendar lists every occurrence, each with its own state
await A.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' })
await A.waitForTimeout(900)
results.calendarShowsToday = (await A.locator('text=Routine').count()) > 0
results.calendarTodayTicked = (await A.locator('[aria-label="Mark not done"]').count()) > 0
// the routine is on, so it is expected today and on the days around it
await A.click(`[data-day="${iso(-1)}"]`)
await A.waitForTimeout(500)
results.calendarShowsYesterday = (await A.locator('[aria-label="Mark done"]').count()) > 0
await A.waitForTimeout(2500) // let A's dirty POST reach the server

// ── Phone B: same code → pulls the routine, then ticks a DIFFERENT day ────────
const B = await newPhone('B')
await onboard(B, 'Sayang', CODE)
await B.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await B.waitForTimeout(3200)
results.bPulledRoutine = (await B.locator(`text=${SUMMARY}`).count()) > 0

await B.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' })
await B.waitForTimeout(900)
// A's tick is visible to B on the day it was made, which is where ticks live now
results.bSeesPartnersTick = (await B.locator('[aria-label="Mark not done"]').count()) > 0
await B.click(`[data-day="${iso(-1)}"]`)
await B.waitForTimeout(500)
await B.click('[aria-label="Mark done"]')
await B.waitForTimeout(600)
results.bTickedYesterday = (await B.locator('[aria-label="Mark not done"]').count()) > 0
await B.waitForTimeout(2600) // B's POST

// ── Back on A: both ticks must be there (per-day union, not last-write-wins) ──
await A.bringToFront()
await A.evaluate(() => window.dispatchEvent(new Event('focus')))
await A.waitForTimeout(3500)
await A.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await A.waitForTimeout(1200)
await A.locator('div.row', { hasText: 'Evening walk' }).first().locator('button').nth(1).click()
await A.waitForTimeout(600)
results.editSheetShowsRepeat = (await A.locator('text=Repeats').count()) > 0
results.canExportToPhoneCalendar = (await A.locator('text=Add to phone calendar').count()) > 0
// A ticked today, B ticked yesterday → both survive, so the count is 2 (1 would mean a clobber)
results.bothTicksSurvived = (await A.locator('text=2 done').count()) > 0

// changing the rule from inside the edit sheet (the repeat editor stacks on top of it)
await A.click('text=Change')
await A.waitForTimeout(500)
results.repeatEditorStacks = (await A.locator('text=Repeat this').count()) > 0
await A.click('[role="dialog"] >> text=Weekly')
await A.waitForTimeout(300)
await A.click('text=Save routine')
await A.waitForTimeout(700)
results.ruleChanged = (await A.locator('text=Repeats').count()) > 0 && (await A.locator('text=Every day · 20:00').count()) === 0
await A.click('[aria-label="Close"]')
await A.waitForTimeout(600)
results.rowShowsNewRule = (await A.locator('text=· 20:00').count()) > 0

// converting a wishlist task hands it over to the routines screen
await A.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await A.waitForSelector('input[placeholder="Add a task…"]')
await A.fill('input[placeholder="Add a task…"]', 'Water the plants')
await A.click('[aria-label="Add to-do"]')
await A.waitForTimeout(700)
await A.locator('div.row', { hasText: 'Water the plants' }).first().locator('[aria-label="Edit to-do"]').click()
await A.waitForTimeout(500)
await A.click('text=Make it a routine')
await A.waitForSelector('text=Repeat this')
await A.click('text=Save routine')
await A.waitForTimeout(900)
results.convertedLeavesWishlist = (await A.locator('text=Water the plants').count()) === 0
await A.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await A.waitForTimeout(900)
results.convertedArrivesInRoutines = (await A.locator('text=Water the plants').count()) > 0

console.log(JSON.stringify(results, null, 2))
console.log('errors:', errors.length ? errors : 'none')
const pass = Object.values(results).every(Boolean) && errors.length === 0
console.log(pass ? '\nROUTINE E2E: PASS ✅' : '\nROUTINE E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
