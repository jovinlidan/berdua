// The calendar's add sheet can also pick something already on the wishlist and give it that date,
// rather than only creating from scratch.
//
// Both kinds are offered, and each has a reason to be left OUT:
//   a to-do already ticked off, because dating a finished task achieves nothing;
//   a routine that already lands on this day, because picking it would be a silent no-op.
//
// Picking a routine adds ONE day to it and leaves the rule alone, so a weekly routine can happen on
// an off day without moving every other occurrence. The engine side of that is pinned by
// scripts/test-routine.ts; this covers the wiring.
//
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-calendar-pick.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const ctx = await b.newContext({ viewport: { width: 402, height: 880 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
p.on('console', (m) => m.type() === 'error' && !/vibrate/i.test(m.text()) && errs.push(m.text().slice(0, 140)))
const dk = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', `pk-${Date.now()}`)
await p.click('text=Begin, together'); await p.waitForTimeout(2300)

const r = {}
const dueOf = (title) => p.evaluate(async (t) => {
  const db = await new Promise((res) => { const q = indexedDB.open('berdua'); q.onsuccess = () => res(q.result) })
  const rows = await new Promise((res) => { const g = db.transaction('todos','readonly').objectStore('todos').getAll(); g.onsuccess = () => res(g.result) })
  const x = rows.find((y) => y.title === t)
  if (!x) return 'missing'
  if (!x.dueAt) return null
  const d = new Date(x.dueAt)
  return { day: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, hour: d.getHours() }
}, title)

// three undated wishlist to-dos, plus a routine and a done one that must NOT be offered
await p.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a task…"]')
for (const n of ['Book the cabin', 'Try the ramen place', 'Finish this one']) {
  await p.fill('input[placeholder="Add a task…"]', n)
  await p.click('[aria-label="Add to-do"]'); await p.waitForTimeout(350)
}
// complete one so it drops out of the picker
await p.locator('.row').filter({ hasText: 'Finish this one' }).first().locator('button').first().click()
await p.waitForTimeout(900)
await p.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a routine…"]')
await p.fill('input[placeholder="Add a routine…"]', 'Morning walk')
await p.click('[aria-label="Add routine"]'); await p.waitForTimeout(800)

// open the calendar sheet on a day 4 out and pick an existing to-do
const target = dk(4)
await p.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1700)
await p.locator(`[data-day="${target}"]`).click(); await p.waitForTimeout(600)
await p.locator('button:has-text("Add")').first().click(); await p.waitForTimeout(800)
// the two pickers are separate modes, so each is opened by its own chip
r.bothPickChipsPresent =
  (await p.locator('[role=dialog] button:has-text("Pick wishlist")').count()) > 0 &&
  (await p.locator('[role=dialog] button:has-text("Pick routine")').count()) > 0
await p.locator('[role=dialog] button:has-text("Pick wishlist")').click(); await p.waitForTimeout(600)
const listText = await p.locator('[role=dialog]').innerText()
r.offersUndatedTodos = listText.includes('Book the cabin') && listText.includes('Try the ramen place')
r.excludesDoneTodos = !listText.includes('Finish this one')
// the wishlist picker is to-dos only; the routine lives behind its own chip
r.wishlistPickerHasNoRoutines = !listText.includes('Morning walk')
// and in the ROUTINE picker, a daily routine already lands on this day so it is not offered
await p.locator('[role=dialog] button:has-text("Pick routine")').click(); await p.waitForTimeout(600)
r.excludesRoutinesAlreadyOnThatDay = !(await p.locator('[role=dialog]').innerText()).includes('Morning walk')
await p.locator('[role=dialog] button:has-text("Pick wishlist")').click(); await p.waitForTimeout(600)

// search narrows it
await p.locator('[role=dialog] input').first().fill('ramen'); await p.waitForTimeout(500)
const searched = await p.locator('[role=dialog]').innerText()
r.searchNarrows = searched.includes('Try the ramen place') && !searched.includes('Book the cabin')
await p.locator('[role=dialog] input').first().fill(''); await p.waitForTimeout(500)

// tapping one gives it that day at 09:00
await p.locator('[role=dialog] button', { hasText: 'Book the cabin' }).first().click()
await p.waitForTimeout(1400)
const due = await dueOf('Book the cabin')
console.log('after picking:', JSON.stringify(due), 'target', target)
r.assignedThatDayAt9 = due?.day === target && due?.hour === 9
r.sheetClosed = (await p.locator('[role=dialog]').count()) === 0
r.appearsOnThatDay = (await p.locator('body').innerText()).includes('Book the cabin')

// a to-do that already has a date shows it, and picking again MOVES it
const later = dk(9)
await p.locator(`[data-day="${later}"]`).click(); await p.waitForTimeout(600)
await p.locator('button:has-text("Add")').first().click(); await p.waitForTimeout(700)
await p.locator('[role=dialog] button:has-text("Pick wishlist")').click(); await p.waitForTimeout(600)
r.showsCurrentDateOnDatedOnes = /now \w{3}, \w{3} \d+/.test(await p.locator('[role=dialog]').innerText())
await p.locator('[role=dialog] button', { hasText: 'Book the cabin' }).first().click()
await p.waitForTimeout(1400)
const moved = await dueOf('Book the cabin')
console.log('after moving:', JSON.stringify(moved), 'target', later)
r.movesADatedTodo = moved?.day === later
// ── a routine that does NOT land on that day can be picked, and only that day changes ──────────
// A weekly routine starting today lands on this weekday only, so a day 3 out is an off day for it.
await p.goto(`${base}/routines`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a routine…"]')
await p.locator('button.chip').first().click()
await p.waitForTimeout(700)
await p.locator('[role=dialog] >> text=Weekly').first().click()
await p.waitForTimeout(400)
await p.locator('[role=dialog] button:has-text("Save")').first().click()
await p.waitForTimeout(700)
await p.fill('input[placeholder="Add a routine…"]', 'Date night')
await p.click('[aria-label="Add routine"]')
await p.waitForTimeout(900)

const offDay = dk(3)
await p.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(1700)
await p.locator(`[data-day="${offDay}"]`).click()
await p.waitForTimeout(700)
r.offDayHasNoDateNight = !(await p.locator('body').innerText()).includes('Date night')
await p.locator('button:has-text("Add")').first().click()
await p.waitForTimeout(800)
await p.locator('[role=dialog] button:has-text("Pick routine")').click()
await p.waitForTimeout(700)
const withRoutines = await p.locator('[role=dialog]').innerText()
r.offersARoutineOnItsOffDay = withRoutines.includes('Date night')
r.saysTheRepeatStays = /repeat stays/.test(withRoutines)
await p.locator('[role=dialog] button', { hasText: 'Date night' }).first().click()
await p.waitForTimeout(1500)
r.routineNowOnThatDay = (await p.locator('body').innerText()).includes('Date night')

// the rule itself must be untouched: one extra day, same weekly repeat
const rule = await p.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('berdua'); q.onsuccess = () => res(q.result) })
  const rows = await new Promise((res) => { const g = db.transaction('todos','readonly').objectStore('todos').getAll(); g.onsuccess = () => res(g.result) })
  return rows.find((x) => x.title === 'Date night')?.routine ?? null
})
console.log('routine rule after picking:', JSON.stringify(rule))
r.ruleStillWeekly = rule?.freq === 'weekly'
r.startDateUntouched = rule?.startDate === dk(0)
r.gotExactlyOneExtraDay = Array.isArray(rule?.extraDates) && rule.extraDates.length === 1 && rule.extraDates[0] === offDay

// and now that it lands there, it must drop out of the picker for that same day
await p.locator('button:has-text("Add")').first().click()
await p.waitForTimeout(800)
await p.locator('[role=dialog] button:has-text("Pick routine")').click()
await p.waitForTimeout(700)
r.noLongerOfferedForThatDay = !(await p.locator('[role=dialog]').innerText()).includes('Date night')

console.log(JSON.stringify(r, null, 2))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(r).every(Boolean) && errs.length === 0
console.log(pass ? '\nCALENDAR PICK: PASS ✅' : '\nCALENDAR PICK: FAIL ❌')
await b.close()
process.exit(pass ? 0 : 1)
