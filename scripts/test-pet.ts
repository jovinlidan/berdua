// Unit checks for the pet logic (decay, growth stage, mood, care actions). Pure functions.
// Run: pnpm exec tsx scripts/test-pet.ts
import assert from 'node:assert'
import { ageDays, applyAction, growth, moodOf, settleStats, spriteMeta, stageOf } from '../src/lib/pet'
import type { Pet } from '../src/types'

const DAY = 86_400_000
const pet = (over: Partial<Pet> = {}): Pet => ({
  id: 'p1',
  name: 'Pip',
  species: 'cow',
  bornAt: 0,
  fullness: 80,
  happiness: 80,
  energy: 80,
  statsAt: 0,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

let n = 0
const ok = (l: string) => {
  n++
  console.log(`  ✓ ${l}`)
}

// settle: fullness/happiness drift DOWN, energy regenerates UP, all clamped 0–100
let s = settleStats(pet({ statsAt: 0 }), 2 * 3_600_000) // 2 hours later
assert.equal(s.fullness, 68) // 80 - 6*2
assert.equal(s.happiness, 73) // 80 - 3.5*2
assert.equal(s.energy, 98) // 80 + 9*2
ok('settleStats decays hunger/happiness and regenerates energy over time')

s = settleStats(pet({ fullness: 10, happiness: 5, energy: 95, statsAt: 0 }), 100 * 3_600_000)
assert.equal(s.fullness, 0)
assert.equal(s.happiness, 0)
assert.equal(s.energy, 100)
ok('settleStats clamps to 0–100')

// growth stages by age
assert.equal(stageOf(pet({ bornAt: 0 }), 60_000), 'egg') // 1 min
assert.equal(stageOf(pet({ bornAt: 0 }), 3 * 60_000), 'baby') // 3 min
assert.equal(stageOf(pet({ bornAt: 0 }), 3 * DAY), 'kid')
assert.equal(stageOf(pet({ bornAt: 0 }), 6 * DAY), 'adult')
ok('stageOf: egg → baby → kid → adult by age')

assert.equal(spriteMeta('cow').frame, 128)
assert.equal(spriteMeta('chicken').frames, 4)
assert.ok(spriteMeta('cow').walk.endsWith('cow_walk.png'))
ok('spriteMeta maps each species to its sprite sheet')

// mood (use a grown pet so it's never "egg"; statsAt=now so no decay skews it)
const grown = (over: Partial<Pet>) => pet({ bornAt: -10 * DAY, statsAt: 0, ...over })
assert.equal(moodOf(pet({ bornAt: 0 }), 0), 'egg')
assert.equal(moodOf(grown({ energy: 10 }), 0), 'sleepy')
assert.equal(moodOf(grown({ energy: 80, fullness: 10 }), 0), 'hungry')
assert.equal(moodOf(grown({ energy: 80, fullness: 80, happiness: 10 }), 0), 'sad')
assert.equal(moodOf(grown({ energy: 80, fullness: 80, happiness: 90 }), 0), 'happy')
ok('moodOf: egg / sleepy / hungry / sad / happy thresholds')

// care actions
let a = applyAction(pet({ fullness: 50, statsAt: 0 }), 'feed', 0)
assert.equal(a.fullness, 85)
assert.equal(a.updatedAt, 0)
ok('feed raises fullness')

a = applyAction(pet({ happiness: 50, energy: 80, fullness: 80, statsAt: 0 }), 'play', 0)
assert.equal(a.happiness, 75)
assert.equal(a.energy, 65)
ok('play raises happiness, costs energy')

a = applyAction(pet({ happiness: 50, statsAt: 0 }), 'pet', 0)
assert.equal(a.happiness, 68)
ok('pet raises happiness')

// age + growth toward next stage
assert.equal(ageDays(pet({ bornAt: 0 }), 3 * DAY + 1000), 3)
ok('ageDays counts whole days since adoption')

let gr = growth(pet({ bornAt: 0 }), 1 * DAY) // baby (2d→kid), 1 day in
assert.equal(gr.stage, 'baby')
assert.equal(gr.next, 'kid')
assert.ok(gr.progress > 0.4 && gr.progress < 0.6)
ok('growth reports stage, next stage, and progress toward it')

gr = growth(pet({ bornAt: 0 }), 10 * DAY)
assert.equal(gr.stage, 'adult')
assert.equal(gr.next, null)
assert.equal(gr.progress, 1)
ok('growth: adult is fully grown (no next stage)')

console.log(`\nAll ${n} pet checks passed ✅`)
