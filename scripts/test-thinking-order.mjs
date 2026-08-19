// The Thinking screen is a conversation with a composer pinned to the bottom, so it reads oldest at
// the top and newest just above the composer. Two things make that easy to break:
//
//   1. useThinkingPings() deliberately returns NEWEST FIRST, because ThinkingOfYou takes the latest
//      received ping straight off the front for the Home teaser and the unread dot. The flip lives
//      in the screen, so "tidying" it into the query would silently break the teaser.
//   2. Newest-at-the-bottom is only usable if the screen actually opens there. Otherwise you land on
//      the oldest ping and scroll past your whole history to reach what just arrived.
//
// Checks both, on one device and across two paired ones, since the received side is the real case.
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-thinking-order.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const CODE = `think-${Date.now()}`
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const errs = []
const res = {}

async function onboard(name) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 880 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push(`${name}: ${String(e).slice(0, 100)}`))
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder="You"]')
  await page.fill('input[placeholder="You"]', name)
  await page.fill('input[placeholder^="A secret word"]', CODE)
  await page.click('text=Begin, together')
  await page.waitForTimeout(2600)
  return page
}

const send = async (page, text) => {
  await page.fill('input[placeholder^="Write a little something"]', text)
  await page.click('[aria-label="Send ping"]')
  await page.waitForTimeout(600)
}
const orderOn = (page, words) =>
  page.evaluate(
    (w) =>
      [...document.querySelectorAll('li')]
        .map((li) => li.textContent.match(new RegExp(`ping (${w.join('|')})`))?.[1])
        .filter(Boolean),
    words,
  )

const A = await onboard('Alex')
const B = await onboard('Bea')

// ── one device: order, and where the screen lands ──────────────────────────────────────────────
await A.goto(`${base}/thinking`, { waitUntil: 'domcontentloaded' })
await A.waitForSelector('input[placeholder^="Write a little something"]')
const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']
for (const w of WORDS) await send(A, `ping ${w}`)
await A.waitForTimeout(1400)

const own = await orderOn(A, WORDS)
res.ownThreadOldestFirst = own[0] === 'one' && own[own.length - 1] === 'eight'

const scroll = await A.evaluate(() => ({
  y: Math.round(window.scrollY),
  max: Math.round(document.documentElement.scrollHeight - window.innerHeight),
}))
// a short thread that does not overflow is trivially "at the bottom"
res.landsAtBottom = scroll.max <= 2 || scroll.y >= scroll.max - 8

// the newest bubble must clear the fixed composer, not hide behind it
res.newestNotObscured = await A.evaluate(() => {
  const last = [...document.querySelectorAll('li')].pop()
  const composer = document.querySelector('.fixed.inset-x-0.bottom-0')
  if (!last || !composer) return false
  const r = last.getBoundingClientRect()
  return r.top >= 0 && r.bottom <= composer.getBoundingClientRect().top
})

await A.reload({ waitUntil: 'domcontentloaded' })
await A.waitForSelector('input[placeholder^="Write a little something"]')
await A.waitForTimeout(1800)
const after = await A.evaluate(() => ({
  y: Math.round(window.scrollY),
  max: Math.round(document.documentElement.scrollHeight - window.innerHeight),
}))
res.landsAtBottomOnReload = after.max <= 2 || after.y >= after.max - 8

// ── two devices: the received side, and the Home teaser that depends on newest-first ───────────
const SENT = ['alpha', 'beta', 'gamma']
for (const w of SENT) await send(A, `ping ${w}`)
await A.waitForTimeout(2500)

await B.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await B.waitForTimeout(4000)
await B.reload({ waitUntil: 'domcontentloaded' })
await B.waitForTimeout(4000)
const teaser = (await B.locator('body').innerText()).match(/💭\s*[“"]([^”"]+)[”"]/)?.[1] ?? ''
// the teaser must quote the NEWEST received ping, which is what newest-first in the query is for
res.homeTeaserShowsNewest = teaser.includes('gamma')

await B.goto(`${base}/thinking`, { waitUntil: 'domcontentloaded' })
await B.waitForSelector('input[placeholder^="Write a little something"]')
await B.waitForTimeout(2500)
const received = await orderOn(B, SENT)
res.receivedThreadOldestFirst = received[0] === 'alpha' && received[received.length - 1] === 'gamma'
// a partner's bubble sits on the opposite side (mine flips to row-reverse)
res.receivedOnPartnerSide =
  (await B.evaluate(() => {
    const li = [...document.querySelectorAll('li')].find((l) => /gamma/.test(l.textContent))
    return li ? getComputedStyle(li).flexDirection : ''
  })) === 'row'

console.log(JSON.stringify(res, null, 2))
console.log('teaser quoted:', JSON.stringify(teaser))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(res).every(Boolean) && errs.length === 0
console.log(pass ? '\nTHINKING ORDER: PASS ✅' : '\nTHINKING ORDER: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
