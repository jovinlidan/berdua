// Verifies the new to-do features + read-mostly sync + erase-frees-slot. Needs `pnpm dev`.
// Run: BASE=http://localhost:5173 node scripts/test-todo-features.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const CODE = `todo-feat-${Date.now()}`
const browser = await chromium.launch()
const errors = []
const results = {}

async function newPhone(label) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 880 } })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`${label} PAGEERROR: ${e.message}`))
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder="You"]')
  return page
}
async function onboard(page, name, code) {
  await page.fill('input[placeholder="You"]', name)
  await page.fill('input[placeholder^="A secret word"]', code)
  await page.click('text=Begin, together')
  await page.waitForTimeout(1800)
}

// Phone A: add a to-do WITH a note
const A = await newPhone('A')
await onboard(A, 'Alex', CODE)
await A.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await A.waitForSelector('input[placeholder="Add a task…"]')
await A.fill('input[placeholder="Add a task…"]', 'Book the cabin')
await A.click('text=Add a note')
await A.fill('textarea[placeholder^="A little more detail"]', 'Lakeside one, 2 nights')
await A.click('[aria-label="Add to-do"]')
await A.waitForTimeout(600)
results.aSeesTitle = (await A.locator('text=Book the cabin').count()) > 0
results.aSeesNote = (await A.locator('text=Lakeside one, 2 nights').count()) > 0
await A.waitForTimeout(2500) // dirty → POST to server

// Phone B: same code → should pull A's to-do + note via read-mostly GET sync
const B = await newPhone('B')
await onboard(B, 'Sayang', CODE)
await B.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await B.waitForTimeout(3000)
results.bPulledTitle = (await B.locator('text=Book the cabin').count()) > 0
results.bPulledNote = (await B.locator('text=Lakeside one, 2 nights').count()) > 0

// Phone B: edit the to-do (open edit sheet, change note)
await B.click('[aria-label="Edit to-do"]')
await B.waitForTimeout(500)
results.editSheetOpened = (await B.locator('text=Edit to-do').count()) > 0
await B.fill('textarea[placeholder^="A little more detail"]', 'Lakeside, 3 nights now')
await B.click('text=Save changes')
await B.waitForTimeout(600)
results.bEditApplied = (await B.locator('text=Lakeside, 3 nights now').count()) > 0
await B.waitForTimeout(2500) // let B's debounced POST reach the server before A pulls

// Phone A pulls the edit via idle read-only GET sync (triggered by focus)
await A.bringToFront()
await A.evaluate(() => window.dispatchEvent(new Event('focus')))
await A.waitForTimeout(3500)
results.aPulledEdit = (await A.locator('text=Lakeside, 3 nights now').count()) > 0

// Erase from A → should free the slot so a 3rd device can claim A again with the same code
await A.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' })
await A.waitForTimeout(800)
await A.click('text=Start over (erase everything)')
await A.waitForTimeout(500)
results.eraseSheetOpened = (await A.locator('text=Erase everything?').count()) > 0
// button must be disabled during cooldown even with CONFIRM typed
await A.fill('input[placeholder="CONFIRM"]', 'CONFIRM')
await A.waitForTimeout(300)
const eraseBtn = A.locator('button', { hasText: /Please wait|Erase everything/ }).last()
results.disabledDuringCooldown = await eraseBtn.isDisabled()
await A.waitForTimeout(5200) // wait out the 5s cooldown
results.enabledAfterCooldown = await eraseBtn.isEnabled()
await eraseBtn.click()
await A.waitForTimeout(2000)
results.aBackToWelcome = (await A.locator('input[placeholder="You"]').count()) > 0

// New device C claims the SAME code → since A erased the doc, slot A is free → C must succeed
const C = await newPhone('C')
await onboard(C, 'Fresh', CODE)
await C.waitForTimeout(1500)
results.cReclaimedFreedCode = !C.url().includes('/welcome')

console.log(JSON.stringify(results, null, 2))
console.log('errors:', errors.length ? errors : 'none')
const pass = Object.values(results).every(Boolean) && errors.length === 0
console.log(pass ? '\nTODO-FEATURES E2E: PASS ✅' : '\nTODO-FEATURES E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
