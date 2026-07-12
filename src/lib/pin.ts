// Lightweight PIN hashing for the local Secret space. This is casual privacy (keeps a
// glancing partner out), NOT cryptographic security — the PIN never leaves the device.
export function hashPin(pin: string): string {
  let h = 5381
  for (let i = 0; i < pin.length; i++) h = (h * 33 + pin.charCodeAt(i)) | 0
  return String(h >>> 0)
}
