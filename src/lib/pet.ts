// Pure logic for the couple's shared virtual pet: stat decay, growth stage, and mood.
// No React / DB here so it's trivially testable and identical on both phones.
import type { Pet, PetSpecies } from '../types'

export type PetStage = 'egg' | 'baby' | 'kid' | 'adult'
export type PetMood = 'egg' | 'sleepy' | 'hungry' | 'sad' | 'content' | 'happy'
export type PetAction = 'feed' | 'play' | 'pet'

const HOUR = 3_600_000
const DAY = 24 * HOUR

export const MAX_PETS = 3

export const SPECIES: { id: PetSpecies; label: string; pick: string }[] = [
  { id: 'chicken', label: 'Chicken', pick: '🐔' },
  { id: 'sheep', label: 'Sheep', pick: '🐑' },
  { id: 'pig', label: 'Pig', pick: '🐖' },
  { id: 'cow', label: 'Cow', pick: '🐄' },
  { id: 'llama', label: 'Llama', pick: '🦙' },
]

// Pixel sprite sheets (bundled, CC-BY Daniel Eddeland / OpenGameArt). Each sheet is a 4×4 grid:
// rows = facing [up, left, down, right], 4 walk/eat frames per row.
export const SPRITE_ROWS = { up: 0, left: 1, down: 2, right: 3 } as const
export interface PetSprite {
  walk: string
  eat: string
  frame: number // source px per frame (square)
  frames: number // frames per row
}
const SPRITES: Record<PetSpecies, PetSprite> = {
  chicken: { walk: '/sprites/chicken_walk.png', eat: '/sprites/chicken_eat.png', frame: 32, frames: 4 },
  sheep: { walk: '/sprites/sheep_walk.png', eat: '/sprites/sheep_eat.png', frame: 128, frames: 4 },
  pig: { walk: '/sprites/pig_walk.png', eat: '/sprites/pig_eat.png', frame: 128, frames: 4 },
  cow: { walk: '/sprites/cow_walk.png', eat: '/sprites/cow_eat.png', frame: 128, frames: 4 },
  llama: { walk: '/sprites/llama_walk_0.png', eat: '/sprites/llama_eat_0.png', frame: 128, frames: 4 },
}

/** Sprite metadata for a species (falls back to chicken for any legacy/unknown species). */
export const spriteMeta = (species: PetSpecies): PetSprite => SPRITES[species] ?? SPRITES.chicken

/** Relative on-screen size per growth stage. */
export const stageScale = (stage: PetStage): number =>
  stage === 'baby' ? 0.7 : stage === 'kid' ? 0.85 : 1

// Gentle drift so neglect is forgiving (hours to matter, not minutes).
const FULLNESS_DECAY = 6 // per hour (down)
const HAPPINESS_DECAY = 3.5 // per hour (down)
const ENERGY_REGEN = 9 // per hour (up — resting)

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** The three stats decayed forward from their snapshot to `now`. Pure — doesn't mutate. */
export function settleStats(pet: Pet, now: number): { fullness: number; happiness: number; energy: number } {
  const h = Math.max(0, (now - pet.statsAt) / HOUR)
  return {
    fullness: clamp(pet.fullness - FULLNESS_DECAY * h),
    happiness: clamp(pet.happiness - HAPPINESS_DECAY * h),
    energy: clamp(pet.energy + ENERGY_REGEN * h),
  }
}

// Age thresholds (ms from bornAt) at which each stage begins.
const STAGE_START: Record<PetStage, number> = { egg: 0, baby: 2 * 60_000, kid: 2 * DAY, adult: 5 * DAY }
const NEXT_STAGE: Record<PetStage, PetStage | null> = { egg: 'baby', baby: 'kid', kid: 'adult', adult: null }

/** Growth stage from age. A short egg phase so it hatches within the first session. */
export function stageOf(pet: Pet, now: number): PetStage {
  const age = now - pet.bornAt
  if (age < STAGE_START.baby) return 'egg' // first ~2 minutes
  if (age < STAGE_START.kid) return 'baby'
  if (age < STAGE_START.adult) return 'kid'
  return 'adult'
}

/** Whole days since adoption (for "N days old"). */
export const ageDays = (pet: Pet, now: number) => Math.max(0, Math.floor((now - pet.bornAt) / DAY))

/** Current stage + the next one and progress (0–1) toward it (null next = fully grown). */
export function growth(pet: Pet, now: number): { stage: PetStage; next: PetStage | null; progress: number } {
  const stage = stageOf(pet, now)
  const next = NEXT_STAGE[stage]
  if (!next) return { stage, next: null, progress: 1 }
  const start = STAGE_START[stage]
  const end = STAGE_START[next]
  const progress = Math.max(0, Math.min(1, (now - pet.bornAt - start) / (end - start)))
  return { stage, next, progress }
}

/** Current mood from settled stats (used for the face/status + how it moves). */
export function moodOf(pet: Pet, now: number): PetMood {
  if (stageOf(pet, now) === 'egg') return 'egg'
  const s = settleStats(pet, now)
  if (s.energy < 20) return 'sleepy'
  if (s.fullness < 25) return 'hungry'
  if (s.happiness < 25) return 'sad'
  if (s.happiness >= 70 && s.fullness >= 50) return 'happy'
  return 'content'
}

/** Apply a care action: settle to `now`, bump the relevant stats, return the updated Pet. */
export function applyAction(pet: Pet, action: PetAction, now: number): Pet {
  const s = settleStats(pet, now)
  let { fullness, happiness, energy } = s
  if (action === 'feed') {
    fullness = clamp(fullness + 35)
    happiness = clamp(happiness + 5)
  } else if (action === 'play') {
    happiness = clamp(happiness + 25)
    energy = clamp(energy - 15)
    fullness = clamp(fullness - 5)
  } else {
    // pet / cuddle
    happiness = clamp(happiness + 18)
    energy = clamp(energy + 5)
  }
  return { ...pet, fullness, happiness, energy, statsAt: now, updatedAt: now }
}

export const STAGE_LABEL: Record<PetStage, string> = {
  egg: 'Egg',
  baby: 'Baby',
  kid: 'Growing',
  adult: 'All grown up',
}
