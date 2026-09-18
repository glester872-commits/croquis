import { useEffect, useState } from 'react'

/**
 * Blob URLs for a list, revoked together when the list changes or the
 * component unmounts. Keyed by id, so a rename does not recreate one.
 */
export function useObjectUrls(
  entries: readonly { readonly id: string; readonly blob: Blob }[],
): Readonly<Record<string, string>> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const signature = entries.map((entry) => entry.id).join('|')

  useEffect(() => {
    const created: Record<string, string> = {}
    for (const entry of entries) created[entry.id] = URL.createObjectURL(entry.blob)
    // As in useObjectUrl: a resource with a lifetime, not a derivation.
    // eslint-disable-next-line react/set-state-in-effect
    setUrls(created)
    return () => {
      for (const url of Object.values(created)) URL.revokeObjectURL(url)
    }
    // The identities of the blobs are pinned by the id list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return urls
}
