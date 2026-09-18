/** Decoding, measuring and resizing images. */

export interface Decoded {
  readonly width: number
  readonly height: number
  /** A small copy, for the library grid. Never the original. */
  readonly thumbnail: Blob
}

/** Long edge of the stored thumbnail. A contact sheet never needs more. */
const THUMB_EDGE = 560

/**
 * Decode once, and take both the true dimensions and a thumbnail from
 * the same pass. Loading a five-megabyte photograph into a grid of
 * twenty is the difference between a library that opens and one that
 * hangs, so the grid never sees the original.
 */
export async function decodeForStorage(source: Blob): Promise<Decoded> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source)
  } catch (cause) {
    throw new Error(
      'No se ha podido abrir esta imagen. Puede estar dañada o usar un formato que el navegador no sabe decodificar.',
      { cause },
    )
  }

  const { width, height } = bitmap
  const scale = Math.min(1, THUMB_EDGE / Math.max(width, height))
  const thumbWidth = Math.max(1, Math.round(width * scale))
  const thumbHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = thumbWidth
  canvas.height = thumbHeight
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('El navegador no ha permitido procesar la imagen.')
  }
  context.drawImage(bitmap, 0, 0, thumbWidth, thumbHeight)
  bitmap.close()

  const thumbnail = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.82)
  })
  if (!thumbnail) {
    throw new Error('El navegador no ha podido generar la miniatura de la imagen.')
  }

  return { width, height, thumbnail }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Spanish long date, for metadata lines. */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    // "2026-09-10" is a calendar date, not an instant. Read as one it
    // becomes UTC midnight and, west of Greenwich, prints the day
    // before: a look worn today would be dated yesterday.
    ...(/^d{4}-d{2}-d{2}$/.test(iso) ? { timeZone: 'UTC' } : {}),
  }).format(date)
}

/** Today, as the value an <input type="date"> expects. */
export function todayInputValue(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}
