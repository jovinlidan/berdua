export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

const DEVICE_ID_KEY = 'berdua-device-id'

/**
 * A stable per-device id. Stored under its own localStorage key (NOT via Zustand persist,
 * which only writes on a state change) so it survives reloads and app relaunches. This id is
 * what claims a couple slot — if it changed on every load, the device would lose its slot and
 * the server would reject it once both slots are taken.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing
    const id = newId()
    localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    return newId() // no storage available — ephemeral, best effort
  }
}
