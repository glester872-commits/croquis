import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { SiteHeader } from '@/components/croquis/SiteHeader'
import { StudioRoom } from '@/components/croquis/StudioRoom'
import { useOutfitIntake } from '@/components/croquis/outfit-uploader/useOutfitIntake'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { useCoarsePointer } from '@/hooks/useMediaPreference'
import { AbortError, defaultProvider } from '@/lib/analysis/provider'
import type { AnalysisProgress } from '@/lib/analysis/provider'
import { decodeForStorage, formatBytes, todayInputValue } from '@/lib/images'
import { takePendingLook } from '@/lib/pendingLook'
import { outfitRepository } from '@/lib/storage/indexeddb-outfit-repository'
import { OUTFIT_CONTEXTS, StorageError, type OutfitContext } from '@/lib/storage/outfit-repository'
import { cn } from '@/lib/utils'
import type { OutfitAnalysis } from '@/types'

/**
 * Adding an outfit.
 *
 * Photograph first, metadata second, and none of the metadata is
 * required.
 */

type Stage =
  | { readonly kind: 'intake' }
  | { readonly kind: 'details' }
  | { readonly kind: 'reading'; readonly progress: AnalysisProgress }
  | { readonly kind: 'error'; readonly message: string; readonly savedId: string | null }

/**
 * A look with no name given still deserves better than its filename.
 *
 * The title comes from what was actually measured — the tones the
 * reading found on the garments — so the archive fills with looks
 * named after how they look rather than after a camera roll. Nothing
 * is invented: with no palette there is nothing to name it with, and
 * the look stays untitled until somebody names it.
 */
function titleFromReading(analysis: OutfitAnalysis): string | null {
  const tones = (analysis.palette?.swatches ?? [])
    .slice(0, 2)
    .map((swatch) => swatch.name.trim())
    .filter((name) => name.length > 0)

  const first = tones[0]
  if (!first) return null
  const second = tones[1]
  const phrase = second ? `${first} y ${second.toLowerCase()}` : first
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

export function Analyze() {
  const navigate = useNavigate()
  /**
   * A look handed over from the home surface.
   *
   * Claimed once, as this screen is first built, so the form opens
   * already holding the photograph instead of opening empty and being
   * filled in a second pass.
   */
  /* Whether to say "drag" at all: a coarse pointer cannot drag a file
     onto the page, so the copy has to depend on what device is asking,
     not describe a gesture that half of them cannot perform. */
  const coarse = useCoarsePointer()
  const [handedOver] = useState(takePendingLook)
  const [file, setFile] = useState<File | null>(handedOver)
  const [stage, setStage] = useState<Stage>(handedOver ? { kind: 'details' } : { kind: 'intake' })
  const abortRef = useRef<AbortController | null>(null)
  /**
   * The row this photograph was saved to, if it already has one.
   *
   * The picture is stored before the reading runs, so a failed reading
   * still leaves it in the library. A retry writes back to that same
   * row rather than creating a second one.
   */
  const savedIdRef = useRef<string | null>(null)

  /* Empty, deliberately. A filename is what a camera called a file,
     not what somebody calls a look, and "outfit-01" in an archive of
     outfits says nothing at all. */
  const [name, setName] = useState('')
  const [wornAt, setWornAt] = useState(todayInputValue)
  const [context, setContext] = useState<OutfitContext>('diario')
  const [notes, setNotes] = useState('')

  const preview = useObjectUrl(file)

  const take = useCallback((incoming: File) => {
    // A different photograph is a different look, so it gets its own row.
    savedIdRef.current = null
    setFile(incoming)
    setStage({ kind: 'details' })
  }, [])

  const { isDragging, error: intakeError, browse, inputRef, onInputChange } = useOutfitIntake(take)

  useEffect(() => () => abortRef.current?.abort(), [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    savedIdRef.current = null
    setFile(null)
    setStage({ kind: 'intake' })
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    const controller = new AbortController()
    abortRef.current = controller
    setStage({
      kind: 'reading',
      progress: { step: defaultProvider.steps[0] ?? '', progress: 0 },
    })

    const typed = name.trim()
    const title = typed || 'Look sin título'

    try {
      let id = savedIdRef.current

      if (id) {
        // A retry. The photograph is already stored; only the metadata
        // can have changed while the error was on screen.
        await outfitRepository.update(id, { name: title, context, notes: notes.trim(), wornAt })
      } else {
        const decoded = await decodeForStorage(file)

        // Saved before it is read. If the reading fails, the photograph
        // is still in the library — that is the part the user cannot
        // get back by pressing a button again.
        const saved = await outfitRepository.save({
          name: title,
          context,
          notes: notes.trim(),
          wornAt,
          image: file,
          imageWidth: decoded.width,
          imageHeight: decoded.height,
          thumbnail: decoded.thumbnail,
        })
        id = saved.id
        savedIdRef.current = id
      }

      const result = await defaultProvider.analyze(
        { kind: 'upload', image: file, title, id },
        {
          signal: controller.signal,
          onProgress: (progress) =>
            setStage((current) => (current.kind === 'reading' ? { ...current, progress } : current)),
        },
      )

      if (result.kind === 'error') {
        setStage({ kind: 'error', message: result.message, savedId: id })
        return
      }

      // Named by its own reading, but only if nobody named it first.
      const titled = typed ? null : titleFromReading(result.analysis)
      await outfitRepository.update(id, {
        analysis: result.analysis,
        ...(titled ? { name: titled } : null),
      })
      void navigate(`/analisis/${id}`)
    } catch (caught) {
      if (caught instanceof AbortError) return
      setStage({
        kind: 'error',
        savedId: savedIdRef.current,
        message:
          caught instanceof StorageError || caught instanceof Error
            ? caught.message
            : 'No se ha podido completar el análisis.',
      })
    }
  }, [context, file, name, navigate, notes, wornAt])

  return (
    <StudioRoom className="min-h-dvh">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={onInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-label="Fotografía del look"
      />

      <SiteHeader section="Añadir look" />

      <main className="u-page grid gap-10 md:grid-cols-[minmax(0,440px)_minmax(0,1fr)] md:gap-(--rhythm-section)">
        {/* the photograph, always first and always the largest thing */}
        <div>
          {/* The whole area is the control, so the three ways in — click,
              drop, paste — share one target instead of hanging a button
              inside a decorative rectangle. */}
          <button
            type="button"
            onClick={browse}
            aria-label={file ? 'Cambiar la fotografía del look' : 'Elegir la fotografía del look'}
            className={cn(
              'group relative flex h-[min(42dvh,420px)] w-full cursor-pointer items-center justify-center overflow-hidden bg-studio-900 p-2 transition-colors duration-(--duration-default) md:aspect-[2/3] md:h-auto',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone',
              isDragging && 'bg-bone/[0.06]',
            )}
          >
            {/* Corner marks register the plate instead of the dashed
                rectangle every upload box uses: two opposite corners
                read as a frame without a generic box around the photo. */}
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute left-3 top-3 size-3.5 border-l border-t transition-colors duration-(--duration-default)',
                isDragging ? 'border-bone' : 'border-studio-500 group-hover:border-bone-mute',
              )}
            />
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute bottom-3 right-3 size-3.5 border-b border-r transition-colors duration-(--duration-default)',
                isDragging ? 'border-bone' : 'border-studio-500 group-hover:border-bone-mute',
              )}
            />

            {preview ? (
              /* Whole, not cropped to the frame: this is the photograph
                 the reading will be made on, and a look with its shoes
                 cut off is not the look that gets analysed. */
              <img
                src={preview}
                alt="Vista previa del outfit que vas a analizar"
                className="max-h-full w-auto"
              />
            ) : (
              <span className="u-meta-sm block max-w-[24ch] text-center leading-relaxed">
                {coarse ? 'Toca para elegir una fotografía' : 'Arrastra una fotografía'}
                <span className="mt-3 block text-bone-dim transition-colors duration-(--duration-fast) group-hover:text-bone">
                  {coarse ? 'o pégala desde el portapapeles' : 'o haz clic para elegirla'}
                </span>
              </span>
            )}

            {/* Said on the target itself while a file is over the page,
                so the answer to "where do I let go" is where the eye
                already is. */}
            {isDragging ? (
              <span className="u-meta absolute inset-x-0 bottom-4 text-center text-bone">
                Suelta para añadirlo
              </span>
            ) : null}

            {stage.kind === 'reading' ? (
              <span className="absolute inset-0 flex items-end bg-studio-900/70 p-4">
                <span className="u-meta text-bone">Leyendo esta fotografía…</span>
              </span>
            ) : null}
          </button>

          {/* What the picker will accept, where the picker is. The only
              thing left of a paragraph that also explained the formats,
              the limit and where the file ends up living. */}
          {file ? (
            <p className="u-note mt-3 flex flex-wrap gap-x-2.5">
              <span className="min-w-0 [overflow-wrap:anywhere]">{file.name}</span>
              <span aria-hidden>·</span>
              <span>{formatBytes(file.size)}</span>
            </p>
          ) : (
            <p className="u-meta-sm mt-3">JPEG · PNG · WEBP · AVIF · MÁX 20 MB</p>
          )}

          {/* Moved beside the control that caused it. It used to render
              under the metadata form, roughly 950px below the dropzone
              on a phone — its cause was off-screen by the time anyone
              read it. */}
          {intakeError ? (
            <p
              role="alert"
              className="mt-3 border border-interpretation/50 px-3 py-2.5 text-[13px] leading-relaxed text-interpretation"
            >
              {intakeError}
            </p>
          ) : null}
        </div>

        <div className="md:pt-2">
          {stage.kind === 'reading' ? (
            <ReadingState progress={stage.progress} />
          ) : (
            <>
              {/* The italic Bodoni voice is reserved for the stylist's
                  own interpretation (u-stylist) — it does not decorate
                  a plain heading. Set as ordinary roman type instead. */}
              <h1 className="u-statement font-normal">
                Añade un outfit.
                <br />
                Croquis lo lee.
              </h1>

              {!file ? null : (
                <form
                  className="mt-9"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void run()
                  }}
                >
                  <p className="u-meta mb-6 border-b border-studio-600 pb-2.5">
                    Datos del outfit · opcionales
                  </p>

                  <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <span className="u-label">Nombre</span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Sábado en Malasaña"
                        maxLength={80}
                        className="u-field mt-1"
                      />
                    </label>

                    <label>
                      <span className="u-label">Fecha</span>
                      <input
                        type="date"
                        value={wornAt}
                        onChange={(event) => setWornAt(event.target.value)}
                        className="u-field mt-1"
                      />
                    </label>

                    <label>
                      <span className="u-label">Contexto</span>
                      <select
                        value={context}
                        onChange={(event) => setContext(event.target.value as OutfitContext)}
                        className="u-field mt-1"
                      >
                        {OUTFIT_CONTEXTS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="sm:col-span-2">
                      <span className="u-label">Notas</span>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        maxLength={400}
                        placeholder="Qué buscabas con este look, dónde lo llevaste…"
                        className="u-field mt-1"
                      />
                    </label>
                  </div>

                  <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
                    <button type="submit" className="u-act">
                      Analizar y guardar
                    </button>
                    <button type="button" onClick={browse} className="u-meta u-act-word">
                      Cambiar la foto
                    </button>
                    <button type="button" onClick={reset} className="u-meta u-act-word">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {stage.kind === 'error' ? (
                <div
                  role="alert"
                  className="mt-6 border border-interpretation/50 px-3 py-3 text-[13px] leading-relaxed text-interpretation"
                >
                  <p>{stage.message}</p>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={() => setStage({ kind: 'details' })}
                      className="u-meta u-act-word text-interpretation"
                    >
                      Volver a intentarlo
                    </button>
                    {stage.savedId ? (
                      <Link to="/outfits" className="u-meta u-act-word">
                        Ver mis outfits
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>
    </StudioRoom>
  )
}

/** The wait, showing only the work actually being done. */
function ReadingState({ progress }: { progress: AnalysisProgress }) {
  const steps = defaultProvider.steps
  const reached = steps.indexOf(progress.step)
  const current = reached === -1 ? steps.length : reached

  return (
    <div>
      <p className="u-meta mb-6">Analizando</p>
      <ol className="border-t border-studio-600">
        {steps.map((step, index) => {
          const done = index < current
          const active = index === current
          return (
            <li key={step} className="flex items-baseline gap-3 border-b border-studio-600 py-2.5">
              {/* Done/active/pending told apart by shape and weight, not
                  only by a shade of grey: pending is a hollow mark,
                  reached is filled, and the step already read carries a
                  strikethrough on top of its own colour. */}
              <span
                aria-hidden
                className={cn(
                  'mt-[6px] size-[5px] shrink-0 border transition-colors duration-(--duration-default)',
                  active
                    ? 'border-inference bg-inference'
                    : done
                      ? 'border-bone-dim bg-bone-dim'
                      : 'border-bone-mute bg-transparent',
                )}
              />
              <span
                className={cn(
                  'flex-1 text-[13.5px] transition-colors duration-(--duration-default)',
                  active
                    ? 'font-medium text-bone'
                    : done
                      ? 'text-bone-dim line-through decoration-1'
                      : 'text-bone-mute',
                )}
              >
                {step}
              </span>
            </li>
          )
        })}
      </ol>
      <p
        role="status"
        aria-live="polite"
        className="u-note mt-5"
      >
        {progress.step}
      </p>
    </div>
  )
}
