// The calendar can add straight onto the day you are looking at, instead of going to another screen
// and setting the date by hand. One sheet, two kinds, and the day means something different to each:
// a to-do takes it as its reminder date, a routine takes it as the day its rule STARTS from.
//
// That second part is the one worth pinning. A routine added to a future day must not be treated as
// happening today, and its rule must carry the picked day rather than today's date.
//
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-calendar-add.mjs
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
await p.fill('input[placeholder^="A secret word"]', `ad-${Date.now()}`)
await p.click('text=Begin, together'); await p.waitForTimeout(2300)
await p.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1800)

const r = {}
// pick a day 5 days out, then add a to-do to it
const future = dk(5)
await p.locator(`[data-day="${future}"]`).click(); await p.waitForTimeout(700)
r.addButtonPresent = (await p.locator('text=Add').first().count()) > 0
await p.locator('button:has-text("Add")').first().click(); await p.waitForTimeout(800)
const sheet = await p.locator('[role=dialog]').innerText()
r.sheetNamesTheDay = /Add to \w{3}, \w{3} \d+/.test(sheet)
// all four modes: create either kind, or pick an existing one of either kind
r.offersAllFourModes = ['New to-do', 'New routine', 'Pick wishlist', 'Pick routine'].every((label) =>
  sheet.includes(label),
)

await p.locator('[role=dialog] input').first().fill('Dinner reservation')
await p.locator('[role=dialog] button:has-text("Add to-do")').click()
await p.waitForTimeout(1400)
r.todoLandsOnThatDay = (await p.locator('body').innerText()).includes('Dinner reservation')

// and its reminder really is that date at 09:00
const stored = await p.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('berdua'); q.onsuccess = () => res(q.result) })
  const rows = await new Promise((res) => { const g = db.transaction('todos','readonly').objectStore('todos').getAll(); g.onsuccess = () => res(g.result) })
  const t = rows.find((x) => x.title === 'Dinner reservation')
  if (!t?.dueAt) return null
  const d = new Date(t.dueAt)
  return { day: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, hour: d.getHours() }
})
r.todoDueOnPickedDayAt9 = stored?.day === future && stored?.hour === 9
console.log('stored to-do:', JSON.stringify(stored), 'picked', future)

// now a routine on the same day
await p.locator('button:has-text("Add")').first().click(); await p.waitForTimeout(800)
await p.locator('[role=dialog] button:has-text("New routine")').click(); await p.waitForTimeout(400)
const rSheet = await p.locator('[role=dialog]').innerText()
r.routineModeShowsRepeats = /Repeats/.test(rSheet)
r.rulePrefilledFromThatDay = /Every day/i.test(rSheet)
await p.locator('[role=dialog] input').first().fill('Evening walk')
await p.locator('[role=dialog] button:has-text("Add routine")').click()
await p.waitForTimeout(1500)
r.routineAppearsOnThatDay = (await p.locator('body').innerText()).includes('Evening walk')

// the routine's rule must start on the picked day, not today
const rule = await p.evaluate(async () => {
  const db = await new Promise((res) => { const q = indexedDB.open('berdua'); q.onsuccess = () => res(q.result) })
  const rows = await new Promise((res) => { const g = db.transaction('todos','readonly').objectStore('todos').getAll(); g.onsuccess = () => res(g.result) })
  return rows.find((x) => x.title === 'Evening walk')?.routine ?? null
})
console.log('stored routine rule:', JSON.stringify(rule))
r.routineStartsOnPickedDay = rule?.startDate === future
// it must NOT be due today, since it starts in the future
await p.locator(`[data-day="${dk(0)}"]`).click(); await p.waitForTimeout(800)
r.notOnTodayYet = !(await p.locator('body').innerText()).includes('Evening walk')
console.log(JSON.stringify(r, null, 2))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(r).every(Boolean) && errs.length === 0
console.log(pass ? '\nCALENDAR ADD: PASS ✅' : '\nCALENDAR ADD: FAIL ❌')
await b.close()
process.exit(pass ? 0 : 1)
