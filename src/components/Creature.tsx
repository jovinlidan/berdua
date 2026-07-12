import { motion } from 'framer-motion'
import { type PetStage, stageScale } from '../lib/pet'
import type { PetSpecies } from '../types'
import { PixelPet } from './PixelPet'

/**
 * A living pixel pet for the roaming companion / habitat scene: the animated sprite (its own legs
 * do the walking), a soft shadow, scaled by growth stage, with a pick-up wiggle when `held`.
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
      <motion.span
        aria-hidden
        className="absolute rounded-[100%] bg-ink/20 blur-[1px]"
        style={{ width: eff * 0.62, height: 4, bottom: -1 }}
        animate={held ? { scaleX: 0.7, opacity: 0.4 } : walking ? { scaleX: [1, 0.85, 1] } : { scaleX: 1 }}
        transition={{ repeat: Infinity, duration: 0.4, ease: 'easeInOut' }}
      />
      <motion.div
        className="drop-shadow-[0_3px_3px_rgba(58,46,43,0.22)]"
        animate={held ? { rotate: [-7, 7, -7], y: 0 } : walking ? { y: 0 } : { y: [0, -1.5, 0] }}
        transition={{ repeat: Infinity, duration: held ? 0.4 : 1.8, ease: 'easeInOut' }}
      >
        <PixelPet species={species} stage={stage} dir={dir} moving={walking && !held} size={eff} />
      </motion.div>
    </div>
  )
}
