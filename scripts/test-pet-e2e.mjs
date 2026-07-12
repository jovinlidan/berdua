// E2E: adopt shared pets (up to 3), roam across screens, care via sheet, manage in the habitat.
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const CODE = `pet-${Date.now()}`
const browser = await chromium.launch()
const errs = []
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
p.on('pageerror', (e) => errs.push('PE:' + e.message))
const res = {}

async function adopt(emoji, name) {
  await p.fill('input[placeholder="e.g. Mochi"]', name)
  await p.getByRole('button', { name: emoji }).click()
  await p.getByRole('button', { name: /Adopt/ }).last().click()
  await p.waitForTimeout(1000)
}

await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', CODE)
await p.click('text=Begin, together')
await p.waitForTimeout(1500)

// adopt first pet via the floating button
await p.getByRole('button', { name: /Adopt a pet/ }).click()
await p.waitForTimeout(400)
await adopt('🐄', 'Mochi')
res.firstRoams = (await p.locator('[aria-label="Mochi"]').count()) > 0

// care sheet from any screen → feed to full
await p.locator('[aria-label="Mochi"]').click()
await p.waitForTimeout(400)
res.careSheet = (await p.getByText('Your pet').count()) > 0
await p.getByRole('button', { name: 'Feed' }).click()
await p.waitForTimeout(600)
res.fedToFull = (await p.getByText('100%').count()) > 0
// open habitat from the sheet
await p.getByRole('button', { name: /Open habitat/ }).click()
await p.waitForTimeout(800)
res.habitatOpened = (await p.getByText('Our little habitat').count()) > 0
res.habitatShowsAge = (await p.getByText(/born today|days old|hatching soon/).count()) > 0
res.countOneOfThree = (await p.getByText('1 of 3 pets').count()) > 0

// adopt 2 more from the habitat → cap at 3
await p.getByRole('button', { name: /Adopt another/ }).click()
await p.waitForTimeout(400)
await adopt('🐑', 'Coco')
res.countTwo = (await p.getByText('2 of 3 pets').count()) > 0
await p.getByRole('button', { name: /Adopt another/ }).click()
await p.waitForTimeout(400)
await adopt('🐔', 'Pip')
res.countThree = (await p.getByText('3 of 3 pets').count()) > 0
res.adoptHiddenAtCap = (await p.getByRole('button', { name: /Adopt another/ }).count()) === 0
await p.screenshot({ path: 'shots/pet-habitat.png' })

// all three roam on Home
await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(1000)
res.threeRoam =
  (await p.locator('[aria-label="Mochi"]').count()) +
    (await p.locator('[aria-label="Coco"]').count()) +
    (await p.locator('[aria-label="Pip"]').count()) ===
  3
res.homePetCard = (await p.getByText('Your pets').count()) > 0
await p.screenshot({ path: 'shots/pet-home3.png' })

console.log(JSON.stringify(res, null, 2))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(res).every(Boolean) && errs.length === 0
console.log(pass ? '\nPET E2E: PASS ✅' : '\nPET E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
