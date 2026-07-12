// Verifies a planned date stops showing as "Coming up" once marked done. Needs `pnpm dev`.
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
await page.waitForTimeout(800)
const comingUpBefore = await page.getByText('Coming up').count()

await page.goto(ideaUrl, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(400)
await page.getByText('make a memory').click()
await page.waitForTimeout(800)

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
const comingUpAfter = await page.getByText('Coming up').count()
const nothingPlanned = await page.getByText('Nothing planned yet').count()

console.log('"Coming up" after planning:', comingUpBefore > 0)
console.log('"Coming up" gone after done:', comingUpAfter === 0)
console.log('"Nothing planned" shown:', nothingPlanned > 0)
console.log('errors:', errors.length ? errors : 'none')
console.log(comingUpBefore > 0 && comingUpAfter === 0 && nothingPlanned > 0 ? '\nDONE-PLAN FIX: PASS ✅' : '\nDONE-PLAN FIX: FAIL ❌')
await browser.close()
