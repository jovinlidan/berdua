// The Routines composer owns its own draft rule and its own RoutineSheet, so the rule chosen before
// a routine exists has no record to be saved against. This walks that path: pick a non-default rule,
// add the routine, confirm the row carries it, and confirm the draft resets afterwards.
// (A weekly rule reads as "Every Tuesday", not "Every week" - routineSummary names the day.)
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-routine-composer.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const p = await (await b.newContext({ viewport: { width: 402, height: 880 } })).newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', `cr-${Date.now()}`)
await p.click('text=Begin, together')
await p.waitForTimeout(2200)
await p.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a routine…"]')
const r = {}
r.chipStartsDaily = /day/i.test(await p.locator('button.chip').first().innerText())
// open the composer's rule sheet and switch to weekly
await p.locator('button.chip').first().click()
await p.waitForTimeout(700)
r.ruleSheetOpens = (await p.locator('[role=dialog]').count()) === 1
await p.locator('[role=dialog] >> text=Weekly').first().click()
await p.waitForTimeout(400)
const saveBtn = p.locator('[role=dialog] button:has-text("Save")').first()
await saveBtn.click()
await p.waitForTimeout(800)
r.ruleSheetClosed = (await p.locator('[role=dialog]').count()) === 0
const chipText = await p.locator('button.chip').first().innerText()
r.chipNowWeekly = /every (mon|tue|wed|thu|fri|sat|sun)/i.test(chipText)
// add the routine and confirm the row carries the chosen rule
await p.fill('input[placeholder="Add a routine…"]', 'Movie night')
await p.click('[aria-label="Add routine"]')
await p.waitForTimeout(1000)
const body = await p.locator('body').innerText()
r.routineAdded = body.includes('Movie night')
r.rowShowsWeekly = /every (mon|tue|wed|thu|fri|sat|sun)/i.test(body)
r.chipResetAfterAdd = /day/i.test(await p.locator('button.chip').first().innerText())
console.log('composer chip text after choosing weekly:', JSON.stringify(chipText))
console.log(JSON.stringify(r, null, 2))
console.log('page errors:', errs.length ? errs : 'none')
console.log(Object.values(r).every(Boolean) ? '\nCOMPOSER RULE: PASS ✅' : '\nCOMPOSER RULE: FAIL ❌')
await b.close()
