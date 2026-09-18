import type {
  NewOutfit,
  OutfitPatch,
  OutfitRepository,
  OutfitSummary,
  StoredOutfit,
} from './outfit-repository'
import { StorageError } from './outfit-repository'

/**
 * IndexedDB implementation.
 *
 * Photographs are stored as Blobs, which is why this is IndexedDB and
 * not localStorage. The only file that knows how storage works.
 */

const DB_NAME = 'croquis'
const DB_VERSION = 1
const STORE = 'outfits'
const INDEX_CREATED = 'createdAt'

/**
 * The record as it sits on disk. The Blob lives alongside the fields;
 * everything a summary derives from the analysis is left out, so the
 * stored shape never has to be migrated when a derived field changes.
 */
interface OutfitRow
  extends Omit<StoredOutfit, 'hasAnalysis' | 'analysedAt' | 'styleDna' | 'trend'> {
  readonly id: string
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function summarise(row: OutfitRow): OutfitSummary {
  return {
    id: row.id,
    name: row.name,
    context: row.context,
    notes: row.notes,
    createdAt: row.createdAt,
    wornAt: row.wornAt,
    imageWidth: row.imageWidth,
    imageHeight: row.imageHeight,
    hasAnalysis: row.analysis !== null,
    analysedAt: row.analysis?.analysedAt ?? null,
    styleDna: row.analysis?.styleDna.map((influence) => influence.name) ?? [],
    trend: row.analysis?.trendSignals[0]?.trendName ?? null,
    thumbnail: row.thumbnail,
  }
}

/**
 * Identifies rows written by builds that shipped an authored dataset.
 *
 * Matched only on the provenance markers those builds stamped on the
 * analysis. Nothing is inferred from a row's title, date, dimensions
 * or file size, so a photograph somebody added cannot be matched by
 * coincidence.
 */
function isFixture(row: OutfitRow): boolean {
  const analysis = row.analysis as (OutfitRow['analysis'] & { isDemo?: boolean }) | null
  return analysis !== null && (analysis.providerId === 'demo-fixture' || analysis.isDemo === true)
}

/** Drops rows left by an older build. Never blocks the open. */
function purgeFixtures(db: IDBDatabase): IDBDatabase {
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    const cursor = store.openCursor()
    cursor.onsuccess = () => {
      const at = cursor.result
      if (!at) return
      if (isFixture(at.value as OutfitRow)) at.delete()
      at.continue()
    }
  } catch {
    // Reported properly by the next repository call.
  }
  return db
}

export class IndexedDbOutfitRepository implements OutfitRepository {
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
            'Este navegador no permite guardar looks. Prueba con otro navegador o desactiva el modo privado.',
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
      request.onsuccess = () => resolve(purgeFixtures(request.result))
      request.onerror = () =>
        reject(
          new StorageError(
            'No se ha podido abrir el almacenamiento local. Si estás en una ventana privada, tus looks no se pueden guardar.',
            { cause: request.error },
          ),
        )
      // Another tab is holding an older version open.
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

    // Subscribed before the request is issued: a transaction that has
    // already committed never fires `complete` at a handler attached
    // afterwards, leaving the promise unsettled. Resolving on commit
    // rather than on the request keeps a rolled-back write from being
    // reported as saved.
    const committed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () =>
        reject(
          new StorageError(
            'No se ha podido guardar. Es posible que no quede espacio en el navegador.',
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

    // Awaited together so the first failure surfaces and neither
    // rejection is left unhandled.
    const [result] = await Promise.all([run(transaction.objectStore(STORE)), committed])
    return result
  }

  async list(): Promise<readonly OutfitSummary[]> {
    const rows = await this.#tx('readonly', (store) =>
      promisify(store.index(INDEX_CREATED).getAll() as IDBRequest<OutfitRow[]>),
    )
    return rows.map(summarise).reverse()
  }

  async get(id: string): Promise<StoredOutfit | undefined> {
    const row = await this.#tx('readonly', (store) =>
      promisify(store.get(id) as IDBRequest<OutfitRow | undefined>),
    )
    return row ? { ...summarise(row), image: row.image, analysis: row.analysis } : undefined
  }

  async save(outfit: NewOutfit): Promise<OutfitSummary> {
    const row: OutfitRow = {
      id: crypto.randomUUID(),
      name: outfit.name,
      context: outfit.context,
      notes: outfit.notes,
      createdAt: new Date().toISOString(),
      wornAt: outfit.wornAt,
      image: outfit.image,
      imageWidth: outfit.imageWidth,
      imageHeight: outfit.imageHeight,
      thumbnail: outfit.thumbnail,
      analysis: null,
    }
    await this.#tx('readwrite', (store) => promisify(store.put(row)))
    this.#changed()
    return summarise(row)
  }

  async update(id: string, patch: OutfitPatch): Promise<void> {
    // Separate transactions on purpose: an IndexedDB transaction
    // auto-commits once its request queue drains, so awaiting a get and
    // then issuing a put inside one races against that commit. The
    // existence check below is the cost of splitting them.
    const existing = await this.#tx('readonly', (store) =>
      promisify(store.get(id) as IDBRequest<OutfitRow | undefined>),
    )
    if (!existing) {
      throw new StorageError('Ese look ya no existe. Puede que se haya eliminado en otra pestaña.')
    }
    await this.#tx('readwrite', (store) => promisify(store.put({ ...existing, ...patch })))
    this.#changed()
  }

  async remove(id: string): Promise<void> {
    await this.#tx('readwrite', (store) => promisify(store.delete(id)))
    this.#changed()
  }
}

export const outfitRepository: OutfitRepository = new IndexedDbOutfitRepository()
