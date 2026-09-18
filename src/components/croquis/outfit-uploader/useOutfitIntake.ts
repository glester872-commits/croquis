import { useCallback, useEffect, useRef, useState } from 'react'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_BYTES = 20 * 1024 * 1024

export interface IntakeState {
  readonly isDragging: boolean
  readonly error: string | null
}

/**
 * Drop, browse or paste.
 *
 * Drag listeners sit on the document because the whole composition is
 * the target. A depth counter tracks enter/leave so moving across a
 * child element does not flicker the dragging state.
 */
export function useOutfitIntake(onFile: (file: File) => void) {
  const [isDragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const depthRef = useRef(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const accept = useCallback(
    (file: File | null | undefined) => {
      if (!file) return
      if (!ACCEPTED.includes(file.type)) {
        setError('Ese archivo no es una imagen que Croquis sepa leer. Usa JPEG, PNG, WebP o AVIF.')
        return
      }
      if (file.size > MAX_BYTES) {
        setError('Esa imagen pasa de 20 MB. Prueba a exportarla más ligera.')
        return
      }
      setError(null)
      onFile(file)
    },
    [onFile],
  )

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      depthRef.current += 1
      setDragging(true)
    }
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = () => {
      depthRef.current = Math.max(0, depthRef.current - 1)
      if (depthRef.current === 0) setDragging(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      depthRef.current = 0
      setDragging(false)
      accept(event.dataTransfer.files[0])
    }
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find(
        (candidate) => candidate.kind === 'file',
      )
      if (item) accept(item.getAsFile())
    }

    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    document.addEventListener('paste', onPaste)

    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
      document.removeEventListener('paste', onPaste)
    }
  }, [accept])

  const browse = useCallback(() => inputRef.current?.click(), [])

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      accept(event.target.files?.[0])
      event.target.value = ''
    },
    [accept],
  )

  return { isDragging, error, browse, inputRef, onInputChange, accept }
}

export { ACCEPTED as ACCEPTED_IMAGE_TYPES }
