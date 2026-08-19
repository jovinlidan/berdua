// PageHeader shows a compact bar at the top once the big title has scrolled away. It is `fixed`
// rather than the title block being `sticky`, because a sticky element still occupies its box in
// normal flow, so condensing it while stuck drags the page content up under your finger. That only
// works while AppShell animates screens with opacity ONLY, since a transform there would become the
// containing block for anything fixed. If someone ever adds a transform to that wrapper, this fails.
// Needs `pnpm dev`. Run: BASE=http://localhost:5173 node scripts/test-floating-header.mjs
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const ctx = await browser.newContext({ viewport: { width: 402, height: 880 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))
const res = {}

const bar = () =>
  page.evaluate(() => {
    const el = document.querySelector('.page-topbar')
    if (!el) return null
    const cs = getComputedStyle(el)
    return { opacity: +cs.opacity, hidden: el.getAttribute('aria-hidden') === 'true', top: Math.round(el.getBoundingClientRect().top) }
  })

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="You"]')
await page.fill('input[placeholder="You"]', 'Alex')
await page.fill('input[placeholder^="A secret word"]', `fh-${Date.now()}`)
await page.click('text=Begin, together')
await page.waitForTimeout(2200)

await page.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="Add a task…"]')
for (let i = 1; i <= 14; i++) {
  await page.fill('input[placeholder="Add a task…"]', `Task number ${i}`)
  await page.click('[aria-label="Add to-do"]')
  await page.waitForTimeout(120)
}
await page.waitForTimeout(1000)

res.hiddenAtTopOfPage = (await bar())?.opacity === 0
await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }))
await page.waitForTimeout(800)
const scrolled = await bar()
res.visibleAfterScrolling = scrolled.opacity === 1 && !scrolled.hidden
res.pinnedToTheTop = Math.abs(scrolled.top) <= 1
res.showsTheScreenTitle = (await page.locator('.page-topbar p').innerText()).includes('Wishlist')
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await page.waitForTimeout(800)
res.retreatsBackAtTheTop = (await bar())?.opacity === 0

// a page too short to scroll must never show it (Story is barely taller than the viewport)
await page.goto(`${base}/story`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1400)
await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
await page.waitForTimeout(800)
res.staysHiddenOnAShortPage = (await bar())?.opacity === 0

// on a screen with a back button, the bar carries one and it works
await page.goto(`${base}/thinking`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder^="Write a little something"]')
for (let i = 1; i <= 12; i++) {
  await page.fill('input[placeholder^="Write a little something"]', `ping ${i}`)
  await page.click('[aria-label="Send ping"]')
  await page.waitForTimeout(300)
}
await page.waitForTimeout(1400)
// the thread opens scrolled to its newest message, so the bar should already be up
res.upImmediatelyWhenAScreenOpensScrolled = (await bar())?.opacity === 1
res.carriesABackButton = (await page.locator('.page-topbar [aria-label="Back"]').count()) === 1
await page.locator('.page-topbar [aria-label="Back"]').click()
await page.waitForTimeout(1400)
res.backButtonNavigates = !page.url().endsWith('/thinking')

console.log(JSON.stringify(res, null, 2))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(res).every(Boolean) && errs.length === 0
console.log(pass ? '\nFLOATING HEADER: PASS ✅' : '\nFLOATING HEADER: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
