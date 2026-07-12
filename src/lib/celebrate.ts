import confetti from 'canvas-confetti'
import { haptic } from './haptics'

// Berdua's warm palette, used for the one celebration that matters: the Both-Hearts seal.
const WARM = ['#E8927C', '#E8B4A0', '#F2C879', '#7C8A6F', '#FFE9DD']

/** The sealing-ritual celebration. Deliberately used sparingly so it stays special. */
export function celebrate(): void {
  haptic([14, 50, 14])
  confetti({ particleCount: 90, spread: 72, origin: { y: 0.7 }, colors: WARM, scalar: 0.95, ticks: 220 })
  window.setTimeout(
    () => confetti({ particleCount: 45, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: WARM }),
    130,
  )
  window.setTimeout(
    () => confetti({ particleCount: 45, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: WARM }),
    130,
  )
}
