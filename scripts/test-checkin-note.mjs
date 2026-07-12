// Verifies partner-note sharing on the daily check-in: partner A leaves a mood + note,
// then partner B sees it (check-in bubble + a Home nudge). Run against the dev server.
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
const NOTE = 'long day but excited for the weekend ' + Math.floor(performance.now())
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

// Onboard (fresh context = empty IndexedDB) — default active partner is A.
await page.goto(base + '/', { waitUntil: 'networkidle' })
if ((await page.locator('input[placeholder="You"]').count()) > 0) {
  await page.fill('input[placeholder="You"]', 'Alex')
  await page.fill('input[placeholder="Them"]', 'Sayang')
  await page.fill('input[type="date"]', '2022-07-01')
  await page.click('text=Begin, together')
  await page.waitForTimeout(400)
}

// As A: set a mood + write a note.
await page.goto(base + '/checkin', { waitUntil: 'networkidle' })
await page.click('[aria-label="Good"]')
await page.waitForTimeout(200)
await page.fill('input[placeholder^="A word about your day"]', NOTE)
await page.locator('input[placeholder^="A word about your day"]').blur()
await page.waitForTimeout(300)

// Switch identity to B via the floating toggle.
await page.click('[aria-label^="You are"]')
await page.waitForTimeout(300)

// As B: the check-in screen should show A's note in the partner bubble.
await page.goto(base + '/checkin', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const bubble = await page.locator(`text=${NOTE}`).count()
console.log('Partner note visible on check-in:', bubble > 0)
// B is viewing → the note's author is A (Alex), so the header reads "Alex today".
const authorHeader = await page.locator('text=Alex today').count()
console.log('Shows author header "Alex today":', authorHeader > 0)

// As B: Home should nudge that a note is waiting.
await page.goto(base + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const nudge = await page.locator('text=left you a note').count()
console.log('Home nudge "left you a note":', nudge > 0)

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none')
await browser.close()
process.exit(0)
