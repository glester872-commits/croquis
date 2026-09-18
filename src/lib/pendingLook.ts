/**
 * A File cannot travel through a URL and does not belong in a store.
 * It is handed from the surface that received it to the surface that
 * reads it, once, and then dropped.
 */
let pending: File | null = null

export function setPendingLook(file: File): void {
  pending = file
}

export function takePendingLook(): File | null {
  const file = pending
  pending = null
  return file
}
