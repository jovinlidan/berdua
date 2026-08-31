// Unit checks for the to-do list defaults (pure function).
// Run: pnpm exec tsx scripts/test-taxonomy.ts
import assert from 'node:assert'
import { defaultTodoList } from '../src/lib/taxonomy'

let n = 0
const ok = (label: string) => {
  n++
  console.log(`  ✓ ${label}`)
}

const groups = [{ id: 'food' }, { id: 'movie' }, { id: 'game' }, { id: 'travel' }]

assert.equal(defaultTodoList(groups, null), 'food')
ok('with nothing remembered, the first list wins')

assert.equal(defaultTodoList(groups, 'travel'), 'travel')
ok('the remembered list wins over the first one')

assert.equal(defaultTodoList(groups, 'travel', 'movie'), 'movie')
ok('an explicit pick in the sheet wins over the remembered one')

assert.equal(defaultTodoList(groups, null, 'game'), 'game')
ok('an explicit pick wins with nothing remembered')

// The case that matters: a list can be deleted after it was remembered. Filing a to-do under a
// category that no longer exists would hide it from every chip and filter, so the id is dropped.
assert.equal(defaultTodoList(groups, 'a-custom-list-since-deleted'), 'food')
ok('a remembered list that no longer exists falls back to the first one')

assert.equal(defaultTodoList([], 'travel'), 'other')
ok('with no lists at all it falls back to `other` rather than a dangling id')

assert.equal(defaultTodoList([], null), 'other')
ok('no lists and nothing remembered is still `other`')

// an empty string must not be mistaken for a real choice
assert.equal(defaultTodoList(groups, '', ''), 'food')
ok('empty strings are not treated as a pick or a memory')

console.log(`\nAll ${n} taxonomy checks passed ✅`)
