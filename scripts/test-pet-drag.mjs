// Verifies the pet is draggable: a drag MOVES it and does NOT open the care sheet (tap ≠ drag),
// while a plain tap still opens care. Needs `pnpm dev`.
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const CODE = `drag-${Date.now()}`
const browser = await chromium.launch()
const errs = []
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
p.on('pageerror', (e) => errs.push('PE:' + e.message))
const res = {}

await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', CODE)
await p.click('text=Begin, together')
await p.waitForTimeout(1500)
await p.getByRole('button', { name: /Adopt a pet/ }).click()
await p.waitForTimeout(300)
await p.fill('input[placeholder="e.g. Mochi"]', 'Mochi')
await p.getByRole('button', { name: '🐄' }).click()
await p.getByRole('button', { name: /Adopt/ }).last().click()
await p.waitForTimeout(1200)

const pet = p.locator('[aria-label="Mochi"]')
res.present = (await pet.count()) > 0
const before = await pet.boundingBox()

// DRAG: press, move a clear distance (up & left), release — should NOT open the care sheet
await p.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
await p.mouse.down()
await p.mouse.move(before.x - 60, before.y - 120, { steps: 12 })
await p.mouse.move(before.x - 70, before.y - 150, { steps: 6 })
await p.mouse.up()
await p.waitForTimeout(400)
res.dragDidNotOpenSheet = (await p.getByText('Your pet').count()) === 0
const after = await pet.boundingBox()
// it moved up appreciably from where it was (y smaller), ignoring horizontal auto-walk
res.movedByDrag = before.y - after.y > 40

// TAP still opens the care sheet (interactive)
await pet.click()
await p.waitForTimeout(400)
res.tapStillOpensCare = (await p.getByText('Your pet').count()) > 0

console.log(JSON.stringify(res, null, 2))
console.log('moved dy:', Math.round(before.y - after.y))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(res).every(Boolean) && errs.length === 0
console.log(pass ? '\nPET DRAG E2E: PASS ✅' : '\nPET DRAG E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
