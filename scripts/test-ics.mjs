// Unit-tests the pure .ics builder (timezone-independent, RFC-escaped, with a VALARM).
import { buildDateIcs } from '../src/lib/calendar.ts'

let fails = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) fails++
}

const start = Date.UTC(2026, 6, 1, 11, 0, 0) // 2026-07-01T11:00:00Z
const ics = buildDateIcs({
  id: 'plan1',
  title: 'Sunset picnic, the two of us',
  start,
  location: 'Old Pier; north end',
  description: 'bring blanket\nand wine',
  stamp: Date.UTC(2026, 5, 15, 0, 0, 0),
})

ok(ics.includes('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR'), 'wrapped in VCALENDAR')
ok(ics.includes('DTSTART:20260701T110000Z'), 'DTSTART is UTC of start')
ok(ics.includes('DTEND:20260701T130000Z'), 'DTEND = start + 120min default')
ok(ics.includes('UID:plan1@berdua'), 'UID from plan id')
ok(ics.includes('SUMMARY:Sunset picnic\\, the two of us'), 'comma escaped in SUMMARY')
ok(ics.includes('LOCATION:Old Pier\\; north end'), 'semicolon escaped in LOCATION')
ok(ics.includes('DESCRIPTION:bring blanket\\nand wine'), 'newline escaped in DESCRIPTION')
ok(ics.includes('BEGIN:VALARM') && ics.includes('TRIGGER:-PT120M'), 'has a 2h-before alarm')
ok(ics.includes('\r\n'), 'CRLF line endings')

// timezone-independence: same epoch → same DTSTART regardless of process TZ
ok(ics.includes('DTSTART:20260701T110000Z'), `DTSTART stable under TZ=${process.env.TZ ?? '(system)'}`)

console.log(fails === 0 ? 'PASS' : `FAIL (${fails})`)
process.exit(fails === 0 ? 0 : 1)
