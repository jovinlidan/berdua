// Verifies the calendar aggregates dated items + the anniversary, and day rows navigate.
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-calendar.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const CODE = `cal-${Date.now()}`
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const annivISO = `2020-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` // recurs → today is the anniversary
const todayNoon = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T12:00`

const browser = await chromium.launch()
const errors = []
const results = {}
const page = await (await browser.newContext({ viewport: { width: 402, height: 880 } })).newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))

// onboard with an anniversary set to today's month/day
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="You"]')
await page.fill('input[placeholder="You"]', 'Alex')
await page.fill('input[type="date"]', annivISO)
await page.fill('input[placeholder^="A secret word"]', CODE)
await page.click('text=Begin, together')
await page.waitForTimeout(1500)

// add a to-do with a reminder for today
await page.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="Add a task…"]')
await page.fill('input[placeholder="Add a task…"]', 'Call the florist')
await page.click('text=Add a reminder')
await page.fill('input[type="datetime-local"]', todayNoon)
await page.click('[aria-label="Add to-do"]')
await page.waitForTimeout(500)

// plan a date for TONIGHT (so it lands on today too)
await page.goto(`${base}/ideas`, { waitUntil: 'domcontentloaded' })
await page.locator('a[href^="/ideas/"]').first().click()
await page.waitForTimeout(400)
await page.click('text=Plan this date')
await page.waitForTimeout(400)
await page.click('text=Tonight')
await page.locator('button.btn-primary').last().click()
await page.waitForTimeout(800)

// the Calendar nav tab exists
results.navTabPresent = (await page.locator('nav >> text=Calendar').count()) > 0

// open the calendar — today is selected by default
await page.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
results.monthHeader = (await page.locator(`text=${now.toLocaleString('en-US', { month: 'long' })}`).count()) > 0
results.showsAnniversary = (await page.locator('text=Anniversary').count()) > 0
results.showsTodo = (await page.locator('text=Call the florist').count()) > 0
results.showsDateLabel = (await page.locator('.card >> text=Date').count()) > 0
await page.screenshot({ path: 'shots/calendar.png' })

// tapping the to-do row navigates to /todos
await page.locator('text=Call the florist').click()
await page.waitForTimeout(600)
results.todoRowNavigates = page.url().includes('/todos')

// a far-away empty day shows the empty state
await page.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(500)
await page.click('[aria-label="Next month"]')
await page.click('[aria-label="Next month"]')
await page.waitForTimeout(400)
// pick the 1st in-month cell (not dimmed) — almost certainly empty two months out
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  for (const b of btns) {
    const s = b.querySelector('span')
    if (s && s.textContent.trim() === '15' && !s.className.includes('/35')) {
      b.click()
      return
    }
  }
})
await page.waitForTimeout(500)
results.emptyDayState = (await page.locator('text=Nothing on this day').count()) > 0

console.log(JSON.stringify(results, null, 2))
console.log('errors:', errors.length ? errors : 'none')
const pass = Object.values(results).every(Boolean) && errors.length === 0
console.log(pass ? '\nCALENDAR E2E: PASS ✅' : '\nCALENDAR E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
