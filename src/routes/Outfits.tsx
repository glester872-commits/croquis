import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ArchiveGallery, type ArchiveItem } from '@/components/croquis/archive/ArchiveGallery'
import { SiteHeader } from '@/components/croquis/SiteHeader'
import { StudioRoom } from '@/components/croquis/StudioRoom'
import { useObjectUrls } from '@/hooks/useObjectUrls'
import { useOutfits } from '@/hooks/useOutfits'
import { outfitRepository } from '@/lib/storage/indexeddb-outfit-repository'
import { StorageError, type OutfitSummary } from '@/lib/storage/outfit-repository'

/**
 * The outfit library.
 *
 * The archive read as a magazine: one look open and holding the page,
 * the rest waiting as plates either side of it. Renaming and deleting
 * are here too, but never on the photograph — they sit under the rail,
 * in the archival mono, and act on whichever look is open.
 */

type Order = 'reciente' | 'antiguo' | 'nombre'

const ORDERS: readonly { id: Order; label: string }[] = [
  { id: 'reciente', label: 'Más recientes' },
  { id: 'antiguo', label: 'Más antiguos' },
  { id: 'nombre', label: 'Por nombre' },
]

function sortOutfits(outfits: readonly OutfitSummary[], order: Order): OutfitSummary[] {
  const copy = [...outfits]
  if (order === 'nombre') return copy.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  copy.sort((a, b) => a.wornAt.localeCompare(b.wornAt))
  return order === 'reciente' ? copy.reverse() : copy
}

/** One empty archive, so "still loading" is not a new list every render. */
const NO_OUTFITS: readonly OutfitSummary[] = []

export function Outfits() {
  const navigate = useNavigate()
  // The archive keeps itself in step: a write anywhere notifies the
  // repository, and every surface reading it redraws.
  const archive = useOutfits()
  const [order, setOrder] = useState<Order>('reciente')
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  /** A write that failed. Silence here would look like it worked. */
  const [actionError, setActionError] = useState<string | null>(null)

  const outfits = archive.status === 'ready' ? archive.outfits : NO_OUTFITS
  const sorted = useMemo(() => sortOutfits(outfits, order), [outfits, order])

  const blobs = useMemo(
    () => sorted.map((outfit) => ({ id: outfit.id, blob: outfit.thumbnail })),
    [sorted],
  )
  const thumbnails = useObjectUrls(blobs)

  /* A look with no thumbnail URL yet is left out rather than drawn as a
     hole: the rail is photographs, and a panel without one is not one. */
  const items = useMemo<ArchiveItem[]>(
    () =>
      sorted.flatMap((outfit) => {
        const src = thumbnails[outfit.id]
        if (!src) return []
        return [
          {
            id: outfit.id,
            src,
            label: outfit.name || 'Look sin título',
            wornAt: outfit.wornAt,
            hasAnalysis: outfit.hasAnalysis,
            styleDna: outfit.styleDna,
            trend: outfit.trend,
            imageWidth: outfit.imageWidth,
            imageHeight: outfit.imageHeight,
          },
        ]
      }),
    [sorted, thumbnails],
  )

  /* Derived, not stored: re-ordering or deleting changes which look is
     first, and holding the open one in state would leave it pointing at
     a look that is no longer there. Default is whatever the current
     order puts first — newest, by default. */
  const activeId = items.some((item) => item.id === selected)
    ? selected
    : (items[0]?.id ?? null)

  const reason = (caught: unknown, fallback: string) =>
    caught instanceof StorageError ? caught.message : fallback

  const remove = useCallback(async (id: string) => {
    try {
      setActionError(null)
      await outfitRepository.remove(id)
      setConfirming(null)
    } catch (caught) {
      setActionError(reason(caught, 'No se ha podido eliminar este look. Sigue en tu archivo.'))
    }
  }, [])

  const patch = useCallback(async (id: string, name: string, notes: string) => {
    try {
      setActionError(null)
      await outfitRepository.update(id, { name: name.trim() || 'Look sin título', notes })
      setEditing(null)
    } catch (caught) {
      setActionError(
        reason(caught, 'No se han podido guardar los cambios. El look conserva sus datos.'),
      )
    }
  }, [])

  /* What the page lets you do to a look, handed to the gallery, which
     is the only one that knows whether to put it under one open plate
     or under each row of a list. */
  const renderActions = useCallback(
    (item: ArchiveItem) => {
      const outfit = sorted.find((entry) => entry.id === item.id)
      if (!outfit) return null

      if (editing === item.id) {
        return (
          <EditForm
            outfit={outfit}
            onCancel={() => setEditing(null)}
            onSave={(name, notes) => void patch(item.id, name, notes)}
          />
        )
      }

      if (confirming === item.id) {
        return (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="text-[12.5px] leading-snug text-interpretation">
              ¿Eliminar «{item.label}» y su análisis? No se puede deshacer.
            </p>
            <button
              type="button"
              onClick={() => void remove(item.id)}
              className="u-meta-sm u-act-word text-interpretation"
            >
              Sí, eliminar
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="u-meta-sm u-act-word"
            >
              Cancelar
            </button>
          </div>
        )
      }

      return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={() => {
              setConfirming(null)
              setEditing(item.id)
            }}
            className="u-meta-sm u-act-word"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setConfirming(item.id)
            }}
            className="u-meta-sm u-act-word hover:text-interpretation"
          >
            Eliminar
          </button>
          {outfit.notes ? (
            <p className="min-w-0 flex-1 text-[12px] leading-snug text-bone-mute">{outfit.notes}</p>
          ) : null}
        </div>
      )
    },
    [sorted, editing, confirming, patch, remove],
  )

  return (
    <StudioRoom className="min-h-dvh">
      <SiteHeader />

      <main className="u-page">
        {/* One h1 for the route, always present — the empty, loading and
            error states used to skip it or reach for u-statement /
            u-meta of their own, so "Mis outfits" carried three different
            treatments depending on which branch rendered. Now the name
            of the page is the page's name, full stop; only the tools
            beside it come and go with the archive's state. */}
        <div className="mb-(--rhythm-block) flex flex-wrap items-baseline justify-between gap-4 border-b border-studio-600 pb-4">
          <h1 className="u-title">Mis outfits</h1>
          {archive.status === 'ready' && items.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <span className="u-meta-sm">
                {items.length} {items.length === 1 ? 'outfit' : 'outfits'}
              </span>
              <Link
                to="/analizar"
                className="u-act-quiet u-meta-sm whitespace-nowrap px-4"
              >
                + Analizar otro look
              </Link>
              <label className="flex items-center gap-2">
                <span className="u-meta-sm">Orden</span>
                <select
                  value={order}
                  onChange={(event) => setOrder(event.target.value as Order)}
                  className="u-field w-auto py-1 text-bone-dim"
                >
                  {ORDERS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        {archive.status === 'loading' ? (
          <p role="status" className="u-meta py-16">Abriendo tu archivo…</p>
        ) : archive.status === 'error' ? (
          <div role="alert" className="u-read py-16">
            <p className="u-meta mb-3 text-interpretation">No se ha podido abrir</p>
            <p className="text-[14px] leading-relaxed text-bone-dim">{archive.message}</p>
            <button type="button" onClick={archive.reload} className="u-meta u-act-word mt-5">
              Reintentar
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <>
            {actionError ? (
              <p
                role="alert"
                className="mb-6 border border-interpretation/50 px-3 py-2.5 text-[13px] leading-relaxed text-interpretation"
              >
                {actionError}
              </p>
            ) : null}

            <ArchiveGallery
              items={items}
              activeId={activeId}
              onActiveChange={setSelected}
              onOpen={(id) => void navigate(`/analisis/${id}`)}
              renderActions={renderActions}
            />
          </>
        )}
      </main>
    </StudioRoom>
  )
}

function EditForm({
  outfit,
  onCancel,
  onSave,
}: {
  outfit: OutfitSummary
  onCancel: () => void
  onSave: (name: string, notes: string) => void
}) {
  const [name, setName] = useState(outfit.name)
  const [notes, setNotes] = useState(outfit.notes)

  return (
    // Narrow and stacked, not a wide flex row: the row used to let the
    // notes field grow to fill the page, which pushed GUARDAR/CANCELAR
    // to the far edge of a 1280px measure — over 1000px from the field
    // somebody had just been typing in. At the note measure the act
    // sits directly under what it acts on.
    <form
      className="u-note-col flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(name, notes)
      }}
    >
      <label className="block">
        <span className="u-label">Nombre</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          autoFocus
          className="u-field mt-1"
        />
      </label>
      <label className="block">
        <span className="u-label">Notas</span>
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={400}
          placeholder="Notas"
          className="u-field mt-1"
        />
      </label>
      <div className="flex items-center gap-5">
        <button type="submit" className="u-meta-sm u-act-word text-bone">
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="u-meta-sm u-act-word">
          Cancelar
        </button>
      </div>
    </form>
  )
}

/* The h1 is already standing above this, always — this is the state
   hanging off it, an h2 at the statement size, exactly the way
   Wardrobe's empty armario reads. */
function EmptyLibrary() {
  return (
    <div className="u-note-col py-24">
      <h2 className="u-statement">Tu archivo está vacío.</h2>
      <div className="mt-10">
        <Link to="/analizar" className="u-act">
          Añadir mi primer look
        </Link>
      </div>
    </div>
  )
}
