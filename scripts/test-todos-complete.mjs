// Verifies a completed to-do STAYS inside its own category (struck through, sorted last)
// instead of being moved to a separate "Done" section. Run against the dev server.
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
const TASK = 'Try the new ramen place ' + Math.floor(performance.now())
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(base + '/', { waitUntil: 'networkidle' })
if ((await page.locator('input[placeholder="You"]').count()) > 0) {
  await page.fill('input[placeholder="You"]', 'Alex')
  await page.fill('input[placeholder="Them"]', 'Sayang')
  await page.fill('input[type="date"]', '2022-07-01')
  await page.click('text=Begin, together')
  await page.waitForTimeout(400)
}

await page.goto(base + '/todos', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)

// Pick the Food category and add a task to it.
await page.locator('button', { hasText: 'Food' }).first().click()
await page.fill('input[placeholder="Add a task…"]', TASK)
await page.click('[aria-label="Add to-do"]')
await page.waitForTimeout(400)
console.log('Task added & visible:', (await page.locator(`text=${TASK}`).count()) > 0)

// Complete it (only open todo on a fresh DB).
await page.locator('[aria-label="Mark done"]').first().click()
await page.waitForTimeout(600)

// 1) Task is STILL on the page (not removed/hidden).
const stillThere = (await page.locator(`text=${TASK}`).count()) > 0
console.log('Completed task still shown in place:', stillThere)

// 2) It's struck through (rendered as a done row).
const struck = await page
  .locator(`p:has-text("${TASK}")`)
  .first()
  .evaluate((el) => el.className.includes('line-through'))
console.log('Rendered struck-through (done style):', struck)

// 3) There is NO separate "Done" section heading.
const noDoneSection = (await page.locator('text=/Done ✓/').count()) === 0
console.log('No separate "Done" section:', noDoneSection)

// 4) The Food category header is still present (task stayed in its category).
const foodHeader = (await page.locator('.font-serif:has-text("Food")').count()) > 0
console.log('Food category still present:', foodHeader)

// 5) Clear-completed action still available.
const clearBtn = (await page.locator('text=/Clear 1 completed/').count()) > 0
console.log('“Clear 1 completed” shown:', clearBtn)

// 6) No percentage progress UI.
const noPct = (await page.locator('text=/% there/').count()) === 0 && (await page.locator('text=All done 🎉').count()) === 0
console.log('No percentage progress shown:', noPct)

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none')
await browser.close()
process.exit(0)
