// Verifies: paste a TikTok URL in the bucket add sheet → title auto-fills → saved with source.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
mkdirSync('shots', { recursive: true })
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
await page.waitForTimeout(500)

await page.goto(`${base}/bucket`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(400)
await page.click('[aria-label="Add dream"]')
await page.waitForTimeout(300)
await page.fill('input[placeholder^="Paste a"]', 'https://www.tiktok.com/@datenightideas/video/123')
await page.waitForTimeout(400)
const titleVal = await page.inputValue('input[placeholder^="Something we want"]')
await page.screenshot({ path: 'shots/20-link-sheet.png' })
await page.getByText('Add to our bucket').click()
await page.waitForTimeout(700)
const rowShowsSource = await page.getByText(/TikTok/).count()
await page.screenshot({ path: 'shots/21-link-row.png' })

console.log('auto-filled title:', JSON.stringify(titleVal))
console.log('row shows source:', rowShowsSource > 0)
console.log('errors:', errors.length ? errors : 'none')
console.log(titleVal.includes('TikTok') && rowShowsSource > 0 ? '\nLINK FEATURE: PASS ✅' : '\nLINK FEATURE: FAIL ❌')
await browser.close()
