// Verifies the Surprise slot-machine reveal: spins, shows the shuffling state,
// then lands on a plannable idea. Run against the dev server (BASE env or :5174).
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

// Onboard so a couple + seeded ideas exist (fresh browser context = empty IndexedDB).
await page.goto(base + '/', { waitUntil: 'networkidle' })
if ((await page.locator('input[placeholder="You"]').count()) > 0) {
  await page.fill('input[placeholder="You"]', 'Alex')
  await page.fill('input[placeholder="Them"]', 'Sayang')
  await page.fill('input[type="date"]', '2022-07-01')
  await page.click('text=Begin, together')
  await page.waitForTimeout(400)
}

await page.goto(base + '/surprise', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

const hasBtn = (await page.locator('text=Surprise us').count()) > 0
console.log('Surprise us button present:', hasBtn)

if (hasBtn) {
  await page.click('text=Surprise us')
  await page.waitForTimeout(150)
  console.log('Shows Shuffling… mid-spin:', (await page.locator('text=Shuffling…').count()) > 0)
  await page.waitForTimeout(1700)
  console.log('Landed (Plan this one):', (await page.locator('text=Plan this one').count()) > 0)
  console.log('Spin finished (no Shuffling…):', (await page.locator('text=Shuffling…').count()) === 0)
  console.log('Reroll offered:', (await page.locator('text=One more reroll').count()) > 0)
}

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none')
await browser.close()
process.exit(0)
