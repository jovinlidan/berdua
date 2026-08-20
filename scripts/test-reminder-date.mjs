// A wishlist reminder is a DAY, not an instant, so it has to land on the day the user picked at
// 09:00 local, in every timezone.
//
// Two traps make this worth a test rather than a glance:
//   `new Date('2026-08-24')` parses an ISO date-only string as UTC midnight. In Los Angeles that is
//   the PREVIOUS day at 17:00; in London it is 01:00 and in Jakarta 07:00, both of which fall inside
//   the default quiet hours (22:00 to 08:00) where the cron drops everything, so the reminder would
//   never be delivered at all. Hence localOccurrenceInstant plus an explicit hour.
//
//   Re-saving an unrelated edit must not drag an existing reminder to 09:00, so the stored instant
//   is kept whenever the day has not changed.
//
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-reminder-date.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const ZONES = (process.env.TZ_TEST || 'Asia/Jakarta,America/Los_Angeles,Europe/London,Pacific/Kiritimati').split(',')
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const failures = []

for (const TZ of ZONES) {
const b = browser
const ctx = await b.newContext({ viewport: { width: 402, height: 880 }, timezoneId: TZ, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', `rm-${Date.now()}`)
await p.click('text=Begin, together')
await p.waitForTimeout(2200)
await p.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="Add a task…"]')

const target = await p.evaluate(() => {
  const d = new Date(); d.setDate(d.getDate() + 4)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
})
// composer: add a to-do with a date reminder
await p.fill('input[placeholder="Add a task…"]', 'Book the cabin')
await p.click('text=Add a date')
await p.waitForTimeout(500)
const composerInput = p.locator('input[type="date"]').first()
if ((await composerInput.count()) === 0) failures.push(`${TZ}: the composer date field is not a date input`)
await composerInput.fill(target)
await p.waitForTimeout(300)
await p.click('[aria-label="Add to-do"]')
await p.waitForTimeout(1000)

const stored = await p.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('berdua'); r.onsuccess = () => res(r.result); r.onerror = rej })
  const rows = await new Promise((res, rej) => {
    const tx = db.transaction('todos', 'readonly').objectStore('todos').getAll()
    tx.onsuccess = () => res(tx.result); tx.onerror = rej
  })
  const t = rows.find((r) => r.title === 'Book the cabin')
  if (!t?.dueAt) return null
  const d = new Date(t.dueAt)
  return {
    dueAt: t.dueAt,
    localDay: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    localHour: d.getHours(), localMinute: d.getMinutes(),
  }
})
console.log(`[${TZ.padEnd(20)}] picked ${target} -> ${stored?.localDay} at ${String(stored?.localHour).padStart(2, '0')}:${String(stored?.localMinute).padStart(2, '0')}`)
if (stored?.localDay !== target) failures.push(`${TZ}: landed on ${stored?.localDay}, not the picked ${target}`)
if (stored?.localHour !== 9 || stored?.localMinute !== 0) failures.push(`${TZ}: fires at ${stored?.localHour}:${stored?.localMinute}, not 09:00 local`)

// the row label must not advertise an hour
const rowText = await p.locator('.row').filter({ hasText: 'Book the cabin' }).first().innerText()
// the user picked a day, so the chip must not advertise an hour they never chose
if (/\d:\d\d\s*(AM|PM)/i.test(rowText)) failures.push(`${TZ}: row label still shows a time: ${rowText.replace(/\n/g, ' ')}`)

// edit sheet round-trip: opening and saving an untouched reminder must not move it
await p.locator('[aria-label="Edit to-do"]').first().click()
await p.waitForTimeout(800)
const editInput = p.locator('[role=dialog] input[type="date"]').first()
if ((await editInput.inputValue()) !== target) failures.push(`${TZ}: edit sheet did not round-trip the date`)
await p.locator('[role=dialog] input').first().fill('Book the cabin!')
await p.click('text=Save changes')
await p.waitForTimeout(1200)
const after = await p.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('berdua'); r.onsuccess = () => res(r.result) })
  const rows = await new Promise((res) => {
    const tx = db.transaction('todos', 'readonly').objectStore('todos').getAll()
    tx.onsuccess = () => res(tx.result)
  })
  return rows.find((r) => r.title.startsWith('Book the cabin'))?.dueAt ?? null
})
if (after !== stored?.dueAt) failures.push(`${TZ}: an unrelated edit moved the reminder (${stored?.dueAt} -> ${after})`)
if (errs.length) failures.push(`${TZ}: page errors ${errs.join('; ')}`)
await ctx.close()
}

console.log(failures.length ? `\nfailures:\n  ${failures.join('\n  ')}` : '')
console.log(failures.length ? '\nREMINDER DATE: FAIL ❌' : '\nREMINDER DATE: PASS ✅')
await browser.close()
process.exit(failures.length ? 1 : 0)
