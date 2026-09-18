import { useCallback, useState } from 'react'

import { SiteHeader } from '@/components/croquis/SiteHeader'
import { Opening, OpenFailed } from "@/components/croquis/RouteState"
import { StudioRoom } from '@/components/croquis/StudioRoom'
import {
  ACCEPTED_IMAGE_TYPES,
  useOutfitIntake,
} from '@/components/croquis/outfit-uploader/useOutfitIntake'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { useWardrobe } from '@/hooks/useWardrobe'
import { StorageError } from '@/lib/storage/outfit-repository'
import {
  GARMENT_LAYERS,
  wardrobeRepository,
  type WardrobeItemSummary,
} from '@/lib/storage/wardrobe-repository'
import { cn } from '@/lib/utils'
import { cutOutItem, type ItemCutout } from '@/lib/wardrobe/cutout'
import type { GarmentLayer } from '@/types'

/**
 * The wardrobe.
 *
 * Garments cut out of their photographs and set on the table, grouped
 * by the layer they occupy, because that is the order somebody dresses
 * in and the order anything that builds an outfit reads them in.
 *
 * No frames, no cards: the cut-out has no rectangle, so the space
 * between garments is the only separation there is.
 */

type Draft =
  | { readonly status: 'idle' }
  | { readonly status: 'cutting' }
  | { readonly status: 'ready'; readonly cut: ItemCutout; readonly original: Blob }
  | { readonly status: 'error'; readonly message: string }

/** Comma-separated free text in, a clean list out. */
function parseMaterials(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 8)
}

/**
 * What the wardrobe is narrowed by.
 *
 * One axis today, because one axis is what the garments actually
 * carry: the layer they occupy is recorded, and colour, season and
 * how often something is worn are not. The bar is a row of values
 * over a single key rather than a control hard-wired to layers, so
 * the day a garment knows its season this grows a second row instead
 * of a rewrite.
 */
type LayerFilter = GarmentLayer | 'todas'

function FilterBar({
  value,
  counts,
  onChange,
}: {
  value: LayerFilter
  counts: ReadonlyMap<LayerFilter, number>
  onChange: (next: LayerFilter) => void
}) {
  const options: readonly { id: LayerFilter; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    ...GARMENT_LAYERS.map((layer) => ({ id: layer.id as LayerFilter, label: layer.label })),
  ]

  return (
    // A single choice among layers, not four independent toggles: a
    // radio group says so, where aria-pressed used to describe a set of
    // switches that could each be on or off. The buttons stay plain
    // <button>s and keep their own tab stops — the keyboard behaviour
    // is unchanged, only what it is announced as.
    <div
      role="radiogroup"
      aria-labelledby="wardrobe-filter-label"
      className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-1 border-b border-studio-700"
    >
      <span id="wardrobe-filter-label" className="u-meta">Capa</span>
      {options.map((option) => {
        const count = counts.get(option.id) ?? 0
        if (option.id !== 'todas' && count === 0) return null
        const on = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.id)}
            className={cn(
              'u-meta u-nav-link hover:text-bone',
              on ? 'border-b-bone text-bone' : '',
            )}
          >
            {option.label}
            <span className="ml-2 text-bone-dim">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Wardrobe() {
  const wardrobe = useWardrobe()
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('todas')
  const [draft, setDraft] = useState<Draft>({ status: 'idle' })
  const [actionError, setActionError] = useState<string | null>(null)

  const onFile = useCallback((file: File) => {
    setDraft({ status: 'cutting' })
    void cutOutItem(file)
      .then((cut) => setDraft({ status: 'ready', cut, original: file }))
      .catch((caught: unknown) =>
        setDraft({
          status: 'error',
          message:
            caught instanceof Error
              ? caught.message
              : 'No se ha podido recortar esta prenda. Prueba con otra fotografía.',
        }),
      )
  }, [])

  const intake = useOutfitIntake(onFile)

  const reason = (caught: unknown, fallback: string) =>
    caught instanceof StorageError ? caught.message : fallback

  const remove = useCallback(async (id: string) => {
    try {
      setActionError(null)
      await wardrobeRepository.remove(id)
    } catch (caught) {
      setActionError(reason(caught, 'No se ha podido eliminar esta prenda. Sigue en tu armario.'))
    }
  }, [])

  const patch = useCallback(
    async (id: string, name: string, layer: GarmentLayer, materials: string, notes: string) => {
      try {
        setActionError(null)
        await wardrobeRepository.update(id, {
          name: name.trim() || 'Prenda sin nombre',
          layer,
          materials: parseMaterials(materials),
          notes,
        })
        return true
      } catch (caught) {
        setActionError(
          reason(caught, 'No se han podido guardar los cambios. La prenda conserva sus datos.'),
        )
        return false
      }
    },
    [],
  )

  const items = wardrobe.status === 'ready' ? wardrobe.items : []

  const counts = new Map<LayerFilter, number>([['todas', items.length]])
  for (const layer of GARMENT_LAYERS) {
    counts.set(layer.id, items.filter((item) => item.layer === layer.id).length)
  }

  const shown = layerFilter === 'todas' ? items : items.filter((item) => item.layer === layerFilter)
  const groups = GARMENT_LAYERS.map((layer) => ({
    ...layer,
    items: shown.filter((item) => item.layer === layer.id),
  })).filter((group) => group.items.length > 0)

  const empty = wardrobe.status === 'ready' && items.length === 0

  /* Built once and placed twice: a tool bar at the top of a wardrobe
     that already has garments, and the way in on an empty one. Same
     panel, same state — only its position in the reading changes. */
  const addPanel = (
    <AddPanel
      draft={draft}
      isDragging={intake.isDragging}
      intakeError={intake.error}
      onBrowse={intake.browse}
      inputRef={intake.inputRef}
      onInputChange={intake.onInputChange}
      onDiscard={() => setDraft({ status: 'idle' })}
      onSaved={() => setDraft({ status: 'idle' })}
      onError={setActionError}
    />
  )

  return (
    <StudioRoom className="min-h-dvh">
      <SiteHeader />

      <main className="u-page relative z-10">
        <div className="mb-(--rhythm-block) flex flex-wrap items-baseline justify-between gap-4 border-b border-studio-600 pb-4">
          <h1 className="u-title">Mi armario</h1>
          {wardrobe.status === 'ready' && items.length > 0 ? (
            <span className="u-meta-sm">
              {items.length} {items.length === 1 ? 'prenda' : 'prendas'}
            </span>
          ) : null}
        </div>

        {empty ? null : addPanel}

        {actionError ? (
          <p
            role="alert"
            className="mt-6 border border-interpretation/50 px-3 py-2.5 text-[13px] leading-relaxed text-interpretation"
          >
            {actionError}
          </p>
        ) : null}

        {wardrobe.status === "loading" ? (
          <Opening what="tu armario" />
        ) : wardrobe.status === "error" ? (
          <OpenFailed message={wardrobe.message} onRetry={wardrobe.reload} />
        ) : empty ? (
          <div className="mt-14">
            <div className="u-note-col">
              <h2 className="u-statement">Tu armario está vacío.</h2>
            </div>
            <div className="mt-9 u-read">{addPanel}</div>
          </div>
        ) : (
          <>
            <FilterBar value={layerFilter} counts={counts} onChange={setLayerFilter} />
            <div className="mt-12 space-y-14">
            {groups.map((group) => (
              <section key={group.id}>
                <h2 className="u-meta mb-5 border-b border-studio-700 pb-2">
                  {group.label}{' '}
                  <span className="ml-2 text-bone-dim">{group.items.length}</span>
                </h2>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
                  {group.items.map((item) => (
                    <ItemFrame
                      key={item.id}
                      item={item}
                      onSave={patch}
                      onRemove={() => void remove(item.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
            </div>
          </>
        )}
      </main>
    </StudioRoom>
  )
}

/* ── adding one ──────────────────────────────────────────────────── */

function AddPanel({
  draft,
  isDragging,
  intakeError,
  onBrowse,
  inputRef,
  onInputChange,
  onDiscard,
  onSaved,
  onError,
}: {
  draft: Draft
  isDragging: boolean
  intakeError: string | null
  onBrowse: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
  onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onDiscard: () => void
  onSaved: () => void
  onError: (message: string | null) => void
}) {
  return (
    <section aria-label="Añadir una prenda">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        aria-label="Fotografía de la prenda"
        tabIndex={-1}
        onChange={onInputChange}
        className="sr-only"
      />

      {draft.status === 'ready' ? (
        <DraftForm draft={draft} onDiscard={onDiscard} onSaved={onSaved} onError={onError} />
      ) : (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-6 gap-y-3 border-b py-5 transition-colors duration-(--duration-default)',
            isDragging ? 'border-bone' : 'border-studio-600',
          )}
        >
          <button
            type="button"
            onClick={onBrowse}
            disabled={draft.status === 'cutting'}
            className="u-act"
          >
            {draft.status === 'cutting' ? 'Recortando…' : 'Añadir una prenda'}
          </button>
          <p className="u-note">Sobre un fondo liso.</p>
        </div>
      )}

      {draft.status === 'error' ? (
        <p role="alert" className="mt-3 text-[13px] leading-relaxed text-interpretation">
          {draft.message}
        </p>
      ) : null}
      {intakeError ? (
        <p role="alert" className="mt-3 text-[13px] leading-relaxed text-interpretation">
          {intakeError}
        </p>
      ) : null}
    </section>
  )
}

function DraftForm({
  draft,
  onDiscard,
  onSaved,
  onError,
}: {
  draft: Extract<Draft, { status: 'ready' }>
  onDiscard: () => void
  onSaved: () => void
  onError: (message: string | null) => void
}) {
  const preview = useObjectUrl(draft.cut.thumbnail)
  const [name, setName] = useState('')
  const [layer, setLayer] = useState<GarmentLayer>('mid')
  const [materials, setMaterials] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    onError(null)
    try {
      await wardrobeRepository.save({
        name: name.trim() || 'Prenda sin nombre',
        layer,
        materials: parseMaterials(materials),
        notes: notes.trim(),
        cutout: draft.cut.cutout,
        thumbnail: draft.cut.thumbnail,
        original: draft.original,
        imageWidth: draft.cut.width,
        imageHeight: draft.cut.height,
        palette: draft.cut.palette,
        isolation: draft.cut.isolation,
      })
      onSaved()
    } catch (caught) {
      onError(
        caught instanceof StorageError
          ? caught.message
          : 'No se ha podido guardar esta prenda. Vuelve a intentarlo.',
      )
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-studio-600 pt-7">
      <div className="flex flex-col gap-8 sm:flex-row sm:gap-10">
        <div className="flex w-full shrink-0 items-center justify-center bg-studio-900 p-5 sm:w-[clamp(160px,22vw,220px)]">
          {preview ? (
            <img
              src={preview}
              alt="Recorte de la prenda añadida"
              className="max-h-[clamp(180px,28vw,240px)] w-auto object-contain"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <Isolation cut={draft.cut} />

          <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <label className="block">
              <span className="u-label">Nombre</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                autoFocus
                placeholder="Camisa de lino blanca"
                className="u-field mt-1"
              />
            </label>

            <label className="block">
              <span className="u-label">Capa</span>
              <select
                value={layer}
                onChange={(event) => setLayer(event.target.value as GarmentLayer)}
                className="u-field mt-1"
              >
                {GARMENT_LAYERS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="u-label">Materiales</span>
              <input
                value={materials}
                onChange={(event) => setMaterials(event.target.value)}
                maxLength={160}
                placeholder="lino, algodón"
                className="u-field mt-1"
              />
              <span className="u-note mt-2 block">Separa con comas.</span>
            </label>

            <label className="block sm:col-span-2">
              <span className="u-label">Notas</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={400}
                className="u-field mt-1"
              />
            </label>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
            <button type="submit" disabled={saving} className="u-act">
              {saving ? 'Guardando…' : 'Guardar en el armario'}
            </button>
            <button type="button" onClick={onDiscard} className="u-meta-sm u-act-word">
              Descartar
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

/** What the isolation managed, and what it did not. Never silent. */
function Isolation({ cut }: { cut: ItemCutout }) {
  if (!cut.isolation.isolated) {
    return (
      <p className="text-[13px] leading-relaxed text-interpretation">
        No se ha podido separar la prenda del fondo. Se guarda sin color medido.
      </p>
    )
  }

  return (
    <div>
      {cut.palette ? (
        <>
          <p className="u-meta-sm mb-2 text-inference">Color medido</p>
          <Swatches swatches={cut.palette.swatches} />
        </>
      ) : (
        <p className="text-[13px] leading-relaxed text-bone-dim">
          Recorte insuficiente para medir el color.
        </p>
      )}
      {cut.isolation.notes.length > 0 ? (
        <ul className="mt-3 space-y-0.5">
          {cut.isolation.notes.map((note) => (
            <li key={note} className="u-note">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Swatches({
  swatches,
}: {
  swatches: readonly { readonly hex: string; readonly name: string; readonly share: number }[]
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {swatches.slice(0, 5).map((swatch) => (
        <li key={swatch.hex} className="flex items-center gap-2">
          <span
            aria-hidden
            style={{ backgroundColor: swatch.hex }}
            className="size-3.5 shrink-0 outline outline-1 -outline-offset-1 outline-white/15"
          />
          <span className="u-note">
            {swatch.name} <span className="u-num">{swatch.share}%</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ── one garment on the sheet ────────────────────────────────────── */

function ItemFrame({
  item,
  onSave,
  onRemove,
}: {
  item: WardrobeItemSummary
  onSave: (
    id: string,
    name: string,
    layer: GarmentLayer,
    materials: string,
    notes: string,
  ) => Promise<boolean>
  onRemove: () => void
}) {
  const src = useObjectUrl(item.thumbnail)
  const [mode, setMode] = useState<'read' | 'edit' | 'confirm'>('read')
  const [name, setName] = useState(item.name)
  const [layer, setLayer] = useState<GarmentLayer>(item.layer)
  const [materials, setMaterials] = useState(item.materials.join(', '))
  const [notes, setNotes] = useState(item.notes)

  const dominant = item.palette?.swatches[0]

  return (
    <li>
      {/* The cut-out sits on the table. No frame, no radius, no card:
          a garment on transparency already has its own outline. The
          only thing it gets is the print's own contact shadow, u-print
          — the one shadow the system allows — because an isolated
          garment on the light table is still a print lying on it. */}
      <div className="flex aspect-square items-center justify-center">
        {src ? (
          <img
            src={src}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="u-print max-h-full max-w-full object-contain"
          />
        ) : null}
      </div>

      <p className="mt-2.5 text-[13px] leading-snug text-bone">{item.name}</p>

      <p className="u-note mt-1 flex items-center gap-1.5">
        {dominant ? (
          <>
            <span
              aria-hidden
              style={{ backgroundColor: dominant.hex }}
              className="size-2.5 shrink-0 outline outline-1 -outline-offset-1 outline-white/15"
            />
            {dominant.name}
          </>
        ) : (
          <span>sin color medido</span>
        )}
      </p>

      {item.materials.length > 0 ? (
        <p className="u-note mt-1">
          {item.materials.join(' · ')}
        </p>
      ) : null}

      {item.notes && mode === 'read' ? (
        <p className="mt-1.5 text-[12px] leading-snug text-bone-mute">{item.notes}</p>
      ) : null}

      {/* Always visible, never hover-only: on a touch screen a hidden
          control is a control that does not exist. */}
      {mode === 'read' ? (
        <div className="mt-1 flex gap-5">
          <button type="button" onClick={() => setMode('edit')} className="u-meta-sm u-act-word">
            Editar
          </button>
          <button
            type="button"
            onClick={() => setMode('confirm')}
            className="u-meta-sm u-act-word hover:text-interpretation"
          >
            Eliminar
          </button>
        </div>
      ) : mode === 'confirm' ? (
        <div className="mt-2">
          <p className="text-[12px] leading-snug text-interpretation">
            ¿Eliminar esta prenda? No se puede deshacer.
          </p>
          <div className="mt-1 flex gap-5">
            <button
              type="button"
              onClick={onRemove}
              className="u-meta-sm u-act-word text-interpretation"
            >
              Sí, eliminar
            </button>
            <button type="button" onClick={() => setMode('read')} className="u-meta-sm u-act-word">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <form
          className="mt-2.5 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void onSave(item.id, name, layer, materials, notes).then((ok) => {
              if (ok) setMode('read')
            })
          }}
        >
          <label className="block">
            <span className="u-label">Nombre</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              className="u-field mt-0.5 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="u-label">Capa</span>
            <select
              value={layer}
              onChange={(event) => setLayer(event.target.value as GarmentLayer)}
              className="u-field mt-0.5 text-[13px]"
            >
              {GARMENT_LAYERS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="u-label">Materiales</span>
            <input
              value={materials}
              onChange={(event) => setMaterials(event.target.value)}
              maxLength={160}
              placeholder="lino, algodón"
              className="u-field mt-0.5 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="u-label">Notas</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={400}
              className="u-field mt-0.5 text-[13px]"
            />
          </label>
          <div className="mt-1 flex gap-5">
            <button type="submit" className="u-meta-sm u-act-word text-bone">
              Guardar
            </button>
            <button type="button" onClick={() => setMode('read')} className="u-meta-sm u-act-word">
              Cancelar
            </button>
          </div>
        </form>
      )}

    </li>
  )
}
