import { type AnimationPlaybackControls, type MotionValue, animate } from 'framer-motion'

/**
 * Put a dragged pet back on the ground.
 *
 * Both pets track `y` as an offset from the floor (0 = standing on it, negative = lifted). Drag was
 * the only thing that ever changed it and nothing put it back, so a pet let go halfway up the screen
 * stayed there and carried on with its walk cycle in mid-air, since the wander loop only animates
 * `x`. Shared by the roaming companion and the habitat so the two fall identically.
 *
 * The duration grows with the square root of the distance, which is how long a real fall takes, so a
 * pet lifted right to the top drops noticeably slower than one barely picked up, and it is capped so
 * that never turns sluggish. Falling accelerates; being nudged below the floor eases back up instead.
 */
export function dropToGround(y: MotionValue<number>): AnimationPlaybackControls | undefined {
  const from = y.get()
  // already there (or close enough that animating would just be a flicker)
  if (Math.abs(from) < 1) {
    y.set(0)
    return undefined
  }
  const duration = Math.min(0.52, 0.16 + Math.sqrt(Math.abs(from)) / 90)
  return animate(y, 0, {
    duration,
    ease: from < 0 ? [0.4, 0, 0.9, 1] : [0.2, 0.8, 0.4, 1],
  })
}
