import { useEffect, useState } from 'react'

/**
 * A blob URL revoked when the component stops needing it. An object
 * URL that is never revoked pins its blob for the life of the
 * document, which for photographs is megabytes each.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) return
    const created = URL.createObjectURL(blob)
    // An object URL is a browser resource with a lifetime, which is
    // exactly what an effect is for; it cannot be derived in render
    // without leaking one per discarded render.
    // eslint-disable-next-line react/set-state-in-effect
    setUrl(created)
    return () => {
      URL.revokeObjectURL(created)
      setUrl(null)
    }
  }, [blob])

  return blob ? url : null
}
