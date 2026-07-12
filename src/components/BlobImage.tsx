import { useEffect, useState } from 'react'

/** Renders a Blob stored in IndexedDB as an <img>, managing the object URL lifecycle. */
export function BlobImage({ blob, className, alt = '' }: { blob: Blob; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  if (!url) return null
  return <img src={url} className={className} alt={alt} loading="lazy" />
}
