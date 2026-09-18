import type { PaletteMeasurement } from '@/lib/analysis/measure-colour'
import type { ItemIsolation } from '@/lib/wardrobe/cutout'
import type { GarmentLayer } from '@/types'

import { StorageError } from './outfit-repository'

/**
 * The wardrobe: the garments themselves, not the looks they appear in.
 *
 * A garment inside an `OutfitAnalysis` is an observation — a region of
 * one photograph. It cannot be combined with a region of another, so
 * anything that builds an outfit needs garments that exist on their
 * own, with their own picture and their own history. That is what this
 * stores.
 *
 * Its own database rather than a second store in `croquis`: the outfit
 * store works, and widening its schema to gain nothing here would mean
 * migrating it.
 * ponytail: one database each; merge them if a write ever has to span
 * a garment and a look atomically.
 */

export const GARMENT_LAYERS: readonly { id: GarmentLayer; label: string }[] = [
  { id: 'base', label: 'Primera capa' },
  { id: 'mid', label: 'Capa intermedia' },
  { id: 'outer', label: 'Abrigo' },
  { id: 'lower', label: 'Parte inferior' },
  { id: 'footwear', label: 'Calzado' },
  { id: 'accessory', label: 'Accesorio' },
]

/** What the sheet lists: everything but the full-size cut-out. */
export interface WardrobeItemSummary {
  readonly id: string
  readonly name: string
  readonly layer: GarmentLayer
  /**
   * What the user says it is made of. Never inferred — no model here
   * can read a fibre off a photograph, so an empty list stays empty.
   */
  readonly materials: readonly string[]
  readonly notes: string
  /** ISO date the garment was added. */
  readonly createdAt: string
  readonly imageWidth: number
  readonly imageHeight: number
  /**
   * Measured on the isolated garment. Null when the isolation was not
   * good enough to stand behind, and rendered as "sin medir" rather
   * than as a guess.
   */
  readonly palette: PaletteMeasurement | null
  readonly isolation: ItemIsolation | null
  /** Small copy of the cut-out, with its alpha. Never the full size. */
  readonly thumbnail: Blob
}

/** A summary plus the full-size cut-out, as stored. */
export interface StoredWardrobeItem extends WardrobeItemSummary {
  readonly cutout: Blob
  /** The photograph it was cut from, kept so it can be re-isolated. */
  readonly original: Blob
}

export interface NewWardrobeItem {
  readonly name: string
  readonly layer: GarmentLayer
  readonly materials: readonly string[]
  readonly notes: string
  readonly cutout: Blob
  readonly thumbnail: Blob
  readonly original: Blob
  readonly imageWidth: number
  readonly imageHeight: number
  readonly palette: PaletteMeasurement | null
  readonly isolation: ItemIsolation | null
}

/** Fields the user can change after the fact. */
export interface WardrobeItemPatch {
  readonly name?: string
  readonly layer?: GarmentLayer
  readonly materials?: readonly string[]
  readonly notes?: string
}

export interface WardrobeRepository {
  /** Newest first. */
  list(): Promise<readonly WardrobeItemSummary[]>
  /** Called after every committed write. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void
  get(id: string): Promise<StoredWardrobeItem | undefined>
  save(item: NewWardrobeItem): Promise<WardrobeItemSummary>
  update(id: string, patch: WardrobeItemPatch): Promise<void>
  remove(id: string): Promise<void>
}

/* ── IndexedDB ───────────────────────────────────────────────────── */

const DB_NAME = 'croquis-wardrobe'
const DB_VERSION = 1
const STORE = 'items'
const INDEX_CREATED = 'createdAt'

interface ItemRow extends StoredWardrobeItem {
  readonly id: string
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function summarise(row: ItemRow): WardrobeItemSummary {
  return {
    id: row.id,
    name: row.name,
    layer: row.layer,
    materials: row.materials,
    notes: row.notes,
    createdAt: row.createdAt,
    imageWidth: row.imageWidth,
    imageHeight: row.imageHeight,
    palette: row.palette,
    isolation: row.isolation,
    thumbnail: row.thumbnail,
  }
}

class IndexedDbWardrobeRepository implements WardrobeRepository {
  #db: Promise<IDBDatabase> | null = null
  readonly #listeners = new Set<() => void>()

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /** Fired after a committed write, never before. */
  #changed(): void {
    for (const listener of this.#listeners) listener()
  }

  #open(): Promise<IDBDatabase> {
    if (this.#db) return this.#db

    this.#db = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(
          new StorageError(
            'Este navegador no permite guardar prendas. Prueba con otro navegador o desactiva el modo privado.',
          ),
        )
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex(INDEX_CREATED, 'createdAt')
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () =>
        reject(
          new StorageError(
            'No se ha podido abrir tu armario. Si estás en una ventana privada, tus prendas no se pueden guardar.',
            { cause: request.error },
          ),
        )
      request.onblocked = () =>
        reject(
          new StorageError(
            'Croquis está abierto en otra pestaña con una versión anterior. Ciérrala y vuelve a intentarlo.',
          ),
        )
    })

    // A failed open must not be cached, or every later call inherits it.
    this.#db.catch(() => {
      this.#db = null
    })
    return this.#db
  }

  async #tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> {
    const db = await this.#open()
    const transaction = db.transaction(STORE, mode)

    // Subscribed before the request is issued, and resolved on commit
    // rather than on the request: a rolled-back write must not be
    // reported as saved.
    const committed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () =>
        reject(
          new StorageError(
            'No se ha podido guardar la prenda. Es posible que no quede espacio en el navegador.',
            { cause: transaction.error },
          ),
        )
      transaction.onerror = () =>
        reject(
          new StorageError('No se ha podido completar la operación de guardado.', {
            cause: transaction.error,
          }),
        )
    })

    const [result] = await Promise.all([run(transaction.objectStore(STORE)), committed])
    return result
  }

  async list(): Promise<readonly WardrobeItemSummary[]> {
    const rows = await this.#tx('readonly', (store) =>
      promisify(store.index(INDEX_CREATED).getAll() as IDBRequest<ItemRow[]>),
    )
    return rows.map(summarise).reverse()
  }

  async get(id: string): Promise<StoredWardrobeItem | undefined> {
    const row = await this.#tx('readonly', (store) =>
      promisify(store.get(id) as IDBRequest<ItemRow | undefined>),
    )
    return row ? { ...summarise(row), cutout: row.cutout, original: row.original } : undefined
  }

  async save(item: NewWardrobeItem): Promise<WardrobeItemSummary> {
    const row: ItemRow = {
      id: crypto.randomUUID(),
      name: item.name,
      layer: item.layer,
      materials: item.materials,
      notes: item.notes,
      createdAt: new Date().toISOString(),
      imageWidth: item.imageWidth,
      imageHeight: item.imageHeight,
      palette: item.palette,
      isolation: item.isolation,
      thumbnail: item.thumbnail,
      cutout: item.cutout,
      original: item.original,
    }
    await this.#tx('readwrite', (store) => promisify(store.put(row)))
    this.#changed()
    return summarise(row)
  }

  async update(id: string, patch: WardrobeItemPatch): Promise<void> {
    // Separate transactions on purpose: an IndexedDB transaction
    // auto-commits once its request queue drains, so awaiting a get and
    // then issuing a put inside one races against that commit.
    const existing = await this.#tx('readonly', (store) =>
      promisify(store.get(id) as IDBRequest<ItemRow | undefined>),
    )
    if (!existing) {
      throw new StorageError(
        'Esa prenda ya no está en tu armario. Puede que se haya eliminado en otra pestaña.',
      )
    }
    await this.#tx('readwrite', (store) => promisify(store.put({ ...existing, ...patch })))
    this.#changed()
  }

  async remove(id: string): Promise<void> {
    await this.#tx('readwrite', (store) => promisify(store.delete(id)))
    this.#changed()
  }
}

export const wardrobeRepository: WardrobeRepository = new IndexedDbWardrobeRepository()
