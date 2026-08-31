// The calendar's add sheet can also pick something already on the wishlist and give it that date,
// rather than only creating from scratch.
//
// Only TO-DOS are offered, deliberately. A routine is already on its own days, so "add it to this
// date" has no honest meaning: repointing its startDate would move every day it lands on and
// renumber its occurrences, and a one-off extra day is not something the rule can express. Done
// to-dos are left out too, since dating a finished task achieves nothing.
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
r.pickOneChipPresent = (await p.locator('[role=dialog] button:has-text("Pick one")').count()) > 0
await p.locator('[role=dialog] button:has-text("Pick one")').click(); await p.waitForTimeout(600)
const listText = await p.locator('[role=dialog]').innerText()
r.offersUndatedTodos = listText.includes('Book the cabin') && listText.includes('Try the ramen place')
r.excludesRoutines = !listText.includes('Morning walk')
r.excludesDoneTodos = !listText.includes('Finish this one')

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
await p.locator('[role=dialog] button:has-text("Pick one")').click(); await p.waitForTimeout(600)
r.showsCurrentDateOnDatedOnes = /now \w{3}, \w{3} \d+/.test(await p.locator('[role=dialog]').innerText())
await p.locator('[role=dialog] button', { hasText: 'Book the cabin' }).first().click()
await p.waitForTimeout(1400)
const moved = await dueOf('Book the cabin')
console.log('after moving:', JSON.stringify(moved), 'target', later)
r.movesADatedTodo = moved?.day === later
console.log(JSON.stringify(r, null, 2))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(r).every(Boolean) && errs.length === 0
console.log(pass ? '\nCALENDAR PICK: PASS ✅' : '\nCALENDAR PICK: FAIL ❌')
await b.close()
process.exit(pass ? 0 : 1)
