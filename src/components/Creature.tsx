import { type PetStage, stageScale } from '../lib/pet'
import type { PetSpecies } from '../types'
import { PixelPet } from './PixelPet'

/**
 * A living pixel pet for the roaming companion / habitat scene: the animated sprite (its own legs
 * do the walking), a soft shadow, scaled by growth stage, with a pick-up wiggle when `held`.
 *
 * The bob, squash and wiggle are CSS keyframes (see index.css). They loop forever, and the pet
 * rides along on every screen, so keeping them off the main thread is the difference between an
 * idle app costing nothing and an idle app animating in the background all day.
 */
export function Creature({
  species,
  stage,
  dir = 1,
  walking = false,
  held = false,
  size = 44,
}: {
  species: PetSpecies
  stage: PetStage
  dir?: 1 | -1
  walking?: boolean
  held?: boolean
  size?: number
}) {
  const eff = Math.round((stage === 'egg' ? 0.8 : stageScale(stage)) * size)
  return (
    <div className="relative inline-grid place-items-center" style={{ width: eff, height: eff + 4 }}>
      <span
        aria-hidden
        className={`absolute rounded-[100%] bg-ink/20 blur-[1px] ${
          held ? 'pet-shadow-held' : walking ? 'pet-shadow-walk' : ''
        }`}
        style={{ width: eff * 0.62, height: 4, bottom: -1 }}
      />
      {/* walking pets don't bob: the sprite's legs already carry the motion */}
      <div
        className={`drop-shadow-[0_3px_3px_rgba(58,46,43,0.22)] ${
          held ? 'pet-wiggle' : walking ? '' : 'pet-bob'
        }`}
      >
        <PixelPet species={species} stage={stage} dir={dir} moving={walking && !held} size={eff} />
      </div>
    </div>
  )
}
