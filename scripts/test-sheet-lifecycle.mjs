// BottomSheet animates with CSS keyframes and unmounts itself on `animationend`, which means the
// exit is hand-rolled rather than owned by AnimatePresence. The failure mode that introduces is a
// sheet that never unmounts: it is `position: fixed` behind a full-viewport scrim, so a stuck one
// would silently swallow every tap in the app. These checks cover each way a sheet can be closed,
// plus toggling faster than the animation runs.
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-sheet-lifecycle.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const ctx = await b.newContext({ viewport: { width: 402, height: 880 } })
const p = await ctx.newPage()
const errs = []
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 140)))
p.on('pageerror', (e) => errs.push('PE:' + String(e).slice(0, 140)))
await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', `life-${Date.now()}`)
await p.click('text=Begin, together')
await p.waitForTimeout(2000)
await p.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a task…"]')
for (const t of ['Book the cabin', 'Try the ramen place']) {
  await p.fill('input[placeholder="Add a task…"]', t)
  await p.click('[aria-label="Add to-do"]'); await p.waitForTimeout(250)
}
const r = {}
const count = () => p.locator('[role=dialog]').count()

// 1) open/close via the X, five times, each must fully unmount
let stuck = 0
for (let i = 0; i < 5; i++) {
  await p.locator('[aria-label="Edit to-do"]').first().click()
  await p.waitForTimeout(450)
  if ((await count()) !== 1) stuck++
  await p.click('[aria-label="Close"]')
  await p.waitForTimeout(600)
  if ((await count()) !== 0) stuck++
}
r.fiveOpenCloseCyclesClean = stuck === 0

// 2) closing via the scrim
await p.locator('[aria-label="Edit to-do"]').first().click()
await p.waitForTimeout(450)
await p.mouse.click(200, 60) // scrim, well above the sheet
await p.waitForTimeout(600)
r.scrimClickCloses = (await count()) === 0

// 3) Escape closes
await p.locator('[aria-label="Edit to-do"]').first().click()
await p.waitForTimeout(450)
await p.keyboard.press('Escape')
await p.waitForTimeout(600)
r.escapeCloses = (await count()) === 0

// 4) spam it: open and close faster than the animation, must not leave anything behind
for (let i = 0; i < 6; i++) {
  await p.locator('[aria-label="Edit to-do"]').first().click()
  await p.waitForTimeout(70)
  await p.keyboard.press('Escape')
  await p.waitForTimeout(70)
}
await p.waitForTimeout(900)
r.rapidToggleLeavesNothing = (await count()) === 0

// 5) the page is still usable afterwards (nothing invisible is swallowing taps)
await p.fill('input[placeholder="Add a task…"]', 'Still interactive')
await p.click('[aria-label="Add to-do"]')
await p.waitForTimeout(600)
r.pageStillInteractive = (await p.locator('text=Still interactive').count()) === 1

// 6) a second sheet type: the routine editor, stacked from the edit sheet
await p.locator('[aria-label="Edit to-do"]').first().click()
await p.waitForTimeout(450)
await p.click('button:has-text("Make it a routine")')
await p.waitForTimeout(600)
r.stackedSheetOpens = (await count()) >= 1
await p.keyboard.press('Escape')
await p.waitForTimeout(700)
r.stackedSheetCloses = (await count()) <= 1

console.log(JSON.stringify(r, null, 2))
console.log('console errors:', errs.length ? errs : 'none')
console.log(Object.values(r).every(Boolean) ? '\nSHEET LIFECYCLE: PASS ✅' : '\nSHEET LIFECYCLE: FAIL ❌')
await b.close()
