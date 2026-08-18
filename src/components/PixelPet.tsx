import { SPRITE_ROWS, type PetStage, spriteMeta } from '../lib/pet'
import type { PetSpecies } from '../types'

/**
 * Renders a pixel-art pet from its CC-BY sprite sheet (Daniel Eddeland / OpenGameArt).
 * Cycles the 4 walk/eat frames when `moving`/`eating`; faces `dir`; stands facing the viewer
 * (down row, frame 0) when idle. The `egg` stage draws a little pixel egg instead.
 *
 * The frame cycle is a CSS `steps()` animation over background-position-x, not a timer that sets
 * React state: a walking pet used to re-render this subtree ~7 times a second for as long as it
 * walked, which is most of the time.
 */
export function PixelPet({
  species,
  stage,
  dir = 1,
  moving = false,
  eating = false,
  size = 40,
}: {
  species: PetSpecies
  stage: PetStage
  dir?: 1 | -1
  moving?: boolean
  eating?: boolean
  size?: number
}) {
  const meta = spriteMeta(species)
  const animating = moving || eating

  if (stage === 'egg') return <PixelEgg size={size} />

  // Idle → face the viewer (down). Walking → face travel direction.
  const row = !moving && !eating ? SPRITE_ROWS.down : dir === -1 ? SPRITE_ROWS.left : SPRITE_ROWS.right
  const msPerFrame = eating ? 220 : 150
  return (
    <div
      aria-hidden
      className={animating ? 'pet-sprite' : undefined}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${eating ? meta.eat : meta.walk})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${meta.frames * size}px ${4 * size}px`,
        // the animation drives x while this keeps y on the right row
        backgroundPosition: `0px ${-row * size}px`,
        imageRendering: 'pixelated',
        // `steps(n, jump-none)` holds each of the n frames for duration/n
        animationDuration: `${msPerFrame * meta.frames}ms`,
        animationTimingFunction: `steps(${meta.frames}, jump-none)`,
      }}
    />
  )
}

function PixelEgg({ size }: { size: number }) {
  const s = size * 0.62
  return (
    <div className="grid place-items-center" style={{ width: size, height: size }}>
      <div
        style={{
          width: s,
          height: s * 1.25,
          background: 'linear-gradient(160deg, #fffdf8 55%, #f3e2cf 100%)',
          borderRadius: '50% 50% 50% 50% / 60% 60% 42% 42%',
          boxShadow: 'inset -2px -3px 0 rgba(180,150,120,0.35)',
        }}
      />
    </div>
  )
}
