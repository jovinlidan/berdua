// Gentle haptics, reserved for genuine payoff beats only (sealing, completing).
export function haptic(pattern: number | number[] = 10): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* unsupported — silently ignore (iOS Safari has no Vibration API) */
    }
  }
}
