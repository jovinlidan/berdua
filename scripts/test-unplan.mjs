// Verifies plan → "Coming up" shows → Cancel plan reverts the idea. Needs `pnpm dev`.
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 402, height: 880 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="You"]')
await page.fill('input[placeholder="You"]', 'Alex')
await page.fill('input[placeholder="Them"]', 'Sayang')
await page.click('text=Begin, together')
await page.waitForTimeout(600)

await page.goto(`${base}/ideas`, { waitUntil: 'domcontentloaded' })
await page.locator('a[href^="/ideas/"]').first().click()
await page.waitForTimeout(400)
const ideaUrl = page.url()

await page.getByText('Plan this date').click()
await page.waitForTimeout(400)
await page.getByText('Add to our plans').click()
await page.waitForTimeout(700)

await page.goto(ideaUrl, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(400)
const showsComingUp = await page.getByText('Coming up').count()

await page.getByText('Cancel plan').click()
await page.waitForTimeout(600)
const comingUpGone = await page.getByText('Coming up').count()
const planRestored = await page.getByText('Plan this date').count()

console.log('"Coming up" after planning:', showsComingUp > 0)
console.log('"Coming up" gone after cancel:', comingUpGone === 0)
console.log('"Plan this date" restored:', planRestored > 0)
console.log('errors:', errors.length ? errors : 'none')
console.log(showsComingUp > 0 && comingUpGone === 0 && planRestored > 0 ? '\nUNPLAN: PASS ✅' : '\nUNPLAN: FAIL ❌')
await browser.close()
