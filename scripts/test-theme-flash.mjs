// Verifies the dark theme is applied BEFORE first paint on refresh (no white flash).
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 402, height: 880 } })).newPage()

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="You"]')
await page.fill('input[placeholder="You"]', 'Alex')
await page.fill('input[placeholder="Them"]', 'Sayang')
await page.click('text=Begin, together')
await page.waitForTimeout(600)
await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(400)
await page.getByText('Dark', { exact: true }).click()
await page.waitForTimeout(500)

// Refresh — the inline <head> script must set the dark theme before the body paints.
await page.reload({ waitUntil: 'domcontentloaded' })
const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
const htmlBg = await page.evaluate(() => document.documentElement.style.backgroundColor)

console.log('data-theme after refresh:', theme)
console.log('html background after refresh:', htmlBg)
console.log(theme === 'dark' ? 'NO-FLASH: PASS ✅' : 'NO-FLASH: FAIL ❌')
await browser.close()
