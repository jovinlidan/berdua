// Proves a Secret is LOCAL-ONLY: added on phone A (same couple code as B) must NEVER appear on phone B.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
const CODE = 'secret-e2e'
mkdirSync('shots', { recursive: true })
const browser = await chromium.launch()
const errors = []

async function onboard(label, code) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 880 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: ${m.text()}`))
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder="You"]')
  await page.fill('input[placeholder="You"]', 'Alex')
  await page.fill('input[placeholder="Them"]', 'Sayang')
  await page.fill('input[placeholder^="A secret word"]', code)
  await page.click('text=Begin, together')
  await page.waitForTimeout(800)
  return page
}

// Phone A adds a secret
const a = await onboard('A', CODE)
await a.goto(`${base}/secrets`, { waitUntil: 'domcontentloaded' })
await a.waitForTimeout(500)
await a.fill('input[placeholder^="A private"]', 'Surprise gift idea')
await a.click('[aria-label="Add secret"]')
await a.waitForTimeout(600)
// attach a private photo
await a.setInputFiles('input[type=file]', 'public/icons/icon-192.png')
await a.waitForTimeout(800)
await a.waitForTimeout(3000) // give sync ample time (it must NOT carry the secret or its photo)
const aHas = await a.getByText('Surprise gift idea').count()
await a.screenshot({ path: 'shots/24-secrets.png' })

// Phone B (same couple code) must not see it
const b = await onboard('B', CODE)
await b.waitForTimeout(3500) // sync pull
await b.goto(`${base}/secrets`, { waitUntil: 'domcontentloaded' })
await b.waitForTimeout(1500)
const bHas = await b.getByText('Surprise gift idea').count()
const bEmpty = await b.getByText('Nothing secret yet').count()

console.log('A sees own secret:', aHas > 0)
console.log('B does NOT see A’s secret:', bHas === 0)
console.log('B shows empty secret space:', bEmpty > 0)
console.log('errors:', errors.length ? errors : 'none')
console.log(aHas > 0 && bHas === 0 ? '\nSECRET PRIVACY: PASS ✅' : '\nSECRET PRIVACY: FAIL ❌')
await browser.close()
