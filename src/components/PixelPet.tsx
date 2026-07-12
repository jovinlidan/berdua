import { useEffect, useState } from 'react'
import { SPRITE_ROWS, type PetStage, spriteMeta } from '../lib/pet'
import type { PetSpecies } from '../types'

/**
 * Renders a pixel-art pet from its CC-BY sprite sheet (Daniel Eddeland / OpenGameArt).
 * Cycles the 4 walk/eat frames when `moving`/`eating`; faces `dir`; stands facing the viewer
 * (down row, frame 0) when idle. The `egg` stage draws a little pixel egg instead.
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
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!animating) {
      setFrame(0)
      return
    }
    const id = window.setInterval(() => setFrame((f) => (f + 1) % meta.frames), eating ? 220 : 150)
    return () => window.clearInterval(id)
  }, [animating, eating, meta.frames])

  if (stage === 'egg') return <PixelEgg size={size} />

  // Idle → face the viewer (down). Walking → face travel direction.
  const row = !moving && !eating ? SPRITE_ROWS.down : dir === -1 ? SPRITE_ROWS.left : SPRITE_ROWS.right
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${eating ? meta.eat : meta.walk})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${meta.frames * size}px ${4 * size}px`,
        backgroundPosition: `${-frame * size}px ${-row * size}px`,
        imageRendering: 'pixelated',
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
