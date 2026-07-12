import type { PartnerKey } from '../types'

/** Send a "thinking of you" push to the other partner. Returns devices reached (or null on failure). */
export async function sendPing(code: string, fromPartner: PartnerKey, message?: string): Promise<number | null> {
  try {
    const res = await fetch('/api/ping', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, fromPartner, message }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { sent?: number }
    return data.sent ?? 0
  } catch {
    return null
  }
}
