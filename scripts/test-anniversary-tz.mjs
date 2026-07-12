// Proves the anniversary date is read in LOCAL time (not UTC), so it stays on the
// correct calendar day in every timezone. Run via tsx so it imports the real source.
//   TZ='America/New_York' npx tsx scripts/test-anniversary-tz.mjs
import { nextAnniversary } from '../src/lib/milestones.ts'
import { daysTogether } from '../src/lib/dates.ts'

const ISO = '2022-07-01'
const anniv = nextAnniversary(ISO)
const monthDay = `${anniv.date.getMonth() + 1}-${anniv.date.getDate()}`
const ok = monthDay === '7-1'

console.log(`TZ=${process.env.TZ ?? '(system)'}`)
console.log(`  anniversary lands on month-day: ${monthDay} ${ok ? '✓' : '✗ EXPECTED 7-1'}`)
console.log(`  daysTogether('${ISO}') = ${daysTogether(ISO)} (non-negative: ${daysTogether(ISO) >= 0})`)

if (!ok) {
  console.error('FAIL: anniversary shifted off July 1')
  process.exit(1)
}
console.log('PASS')
