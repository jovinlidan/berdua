// Compress photos on-device before storing as Blobs in IndexedDB. iOS PWAs have a
// ~50MB cache budget, so we downscale aggressively. Phase 2 moves blobs to Supabase Storage.
export async function compressImage(file: File, maxDim = 1280, quality = 0.78): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    return blob ?? file
  } catch {
    return file // fall back to the original if the browser can't decode it
  }
}

/** Create object URLs for a memory's photos. Caller MUST revoke them on unmount. */
export function toObjectUrls(blobs: Blob[]): string[] {
  return blobs.map((b) => URL.createObjectURL(b))
}
