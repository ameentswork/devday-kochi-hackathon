import { openDB } from 'idb'
import { getUid, reportEntryCount } from './api'
import {
  saveEntryToCloud,
  loadEntriesFromCloud,
  deleteEntryFromCloud,
} from './cloud'

const DB_BASE = 'voice-diary'
const STORE = 'entries'
const LEGACY_MIGRATED_KEY = 'voice-diary-legacy-migrated'

// Each account gets its own IndexedDB: "voice-diary-<uid>".
// That namespaces a member's diary so other accounts on the same browser
// can never see it — and admins only ever see their own.
const dbCache = new Map()

function dbName() {
  return `${DB_BASE}-${getUid() || 'guest'}`
}

function dbPromise() {
  const name = dbName()
  if (!dbCache.has(name)) dbCache.set(name, openNamespaced(name))
  return dbCache.get(name)
}

async function openNamespaced(name) {
  const db = await openDB(name, 1, {
    upgrade(d) {
      const store = d.createObjectStore(STORE, {
        keyPath: 'id',
        autoIncrement: true,
      })
      store.createIndex('entryDate', 'entryDate')
    },
  })
  await migrateLegacy(db)
  return db
}

// Pre-auth data lived in the unprefixed "voice-diary" DB. The first account
// to open the app on this browser inherits it; it is never deleted.
async function migrateLegacy(db) {
  if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return
  localStorage.setItem(LEGACY_MIGRATED_KEY, '1')
  try {
    const dbs = (await indexedDB.databases?.()) || []
    if (!dbs.some((d) => d.name === DB_BASE)) return
    const legacy = await openDB(DB_BASE, 1, { upgrade() {} })
    const all = await legacy.getAll(STORE)
    if ((await db.count(STORE)) === 0 && all.length) {
      const tx = db.transaction(STORE, 'readwrite')
      for (const e of all) await tx.store.put({ ...e, owner: getUid() })
      await tx.done
    }
  } catch {
    // migration is best-effort; never break the app over it
  }
}

const owner = () => getUid() || null

function friendlyError(action, err) {
  return new Error(`Could not ${action}: ${err?.message || err}`)
}

async function syncStats() {
  try {
    const db = await dbPromise()
    reportEntryCount(await db.count(STORE))
  } catch {
    // stats are best-effort
  }
}

let syncInProgress = false

/**
 * Synchronize diary entries between local IndexedDB and Cloudflare D1/R2
 */
export async function syncWithCloud() {
  if (syncInProgress) return
  syncInProgress = true
  try {
    const cloudEntries = await loadEntriesFromCloud()
    if (!cloudEntries || !cloudEntries.length) return

    const db = await dbPromise()
    const currentLocal = await db.getAll(STORE)
    const localMap = new Map()

    for (const e of currentLocal) {
      if (e.cloudId) localMap.set(String(e.cloudId), e)
      if (e.id) localMap.set(String(e.id), e)
    }

    const tx = db.transaction(STORE, 'readwrite')
    for (const ce of cloudEntries) {
      const match = localMap.get(String(ce.cloudId)) || localMap.get(String(ce.id))
      if (!match) {
        // Entry from cloud not present locally -> insert it into local IndexedDB
        await tx.store.add({ ...ce, owner: owner() })
      } else if (!match.cloudSynced) {
        await tx.store.put({ ...match, cloudSynced: true })
      }
    }
    await tx.done
    syncStats()
  } catch (err) {
    console.warn('Background cloud sync note:', err)
  } finally {
    syncInProgress = false
  }
}

export async function addEntry(entry) {
  try {
    const db = await dbPromise()
    const id = await db.add(STORE, { ...entry, owner: owner(), cloudSynced: false })
    syncStats()

    // Sync to Cloudflare D1 & R2 in background
    saveEntryToCloud({ ...entry, id, owner: owner() })
      .then(async (res) => {
        if (res?.ok) {
          try {
            const current = await db.get(STORE, Number(id))
            if (current) {
              const updatedAudio = res.audio_key
                ? { ...(current.audio || {}), key: res.audio_key }
                : current.audio
              await db.put(STORE, {
                ...current,
                cloudSynced: true,
                cloudId: String(res.id || id),
                audio: updatedAudio,
              })
            }
          } catch {
            // best-effort local sync flag update
          }
        }
      })
      .catch((err) => console.warn('Background cloud save note:', err))

    return id
  } catch (err) {
    throw friendlyError('save the entry', err)
  }
}

export async function updateEntry(id, changes) {
  try {
    const db = await dbPromise()
    const existing = await db.get(STORE, Number(id))
    if (!existing) throw new Error('entry not found')
    // ownership check: an entry can only be changed by its owner
    if (existing.owner && existing.owner !== owner()) {
      throw new Error('this entry belongs to a different account')
    }
    const updated = {
      ...existing,
      ...changes,
      id: Number(id),
      owner: existing.owner || owner(),
      updatedAt: new Date().toISOString(),
      cloudSynced: false,
    }
    await db.put(STORE, updated)

    // Sync to Cloudflare D1 & R2
    saveEntryToCloud(updated)
      .then(async (res) => {
        if (res?.ok) {
          try {
            const cur = await db.get(STORE, Number(id))
            if (cur) await db.put(STORE, { ...cur, cloudSynced: true })
          } catch {
            // best-effort
          }
        }
      })
      .catch((err) => console.warn('Background cloud update note:', err))

    return Number(id)
  } catch (err) {
    throw friendlyError('update the entry', err)
  }
}

export async function getEntry(id) {
  try {
    const db = await dbPromise()
    const entry = await db.get(STORE, Number(id))
    if (entry?.owner && entry.owner !== owner()) return undefined
    return entry
  } catch (err) {
    throw friendlyError('open the entry', err)
  }
}

export async function listEntries() {
  try {
    const db = await dbPromise()
    let all = (await db.getAll(STORE)).filter(
      (e) => !e.owner || e.owner === owner(),
    )

    // If local storage is empty, eagerly fetch from cloud so user sees entries on refresh
    if (all.length === 0) {
      await syncWithCloud()
      all = (await db.getAll(STORE)).filter(
        (e) => !e.owner || e.owner === owner(),
      )
    } else {
      // Trigger background sync to pull any newer cloud entries
      syncWithCloud().catch(() => {})
    }

    return all.sort(
      (a, b) =>
        (b.entryDate || '').localeCompare(a.entryDate || '') ||
        (b.createdAt || '').localeCompare(a.createdAt || '') ||
        (b.id || 0) - (a.id || 0),
    )
  } catch (err) {
    throw friendlyError('load entries', err)
  }
}

export async function deleteEntry(id) {
  try {
    const db = await dbPromise()
    const existing = await db.get(STORE, Number(id))
    if (existing?.owner && existing.owner !== owner()) {
      throw new Error('this entry belongs to a different account')
    }
    await db.delete(STORE, Number(id))
    syncStats()

    // Delete from Cloudflare D1 & R2
    deleteEntryFromCloud(existing?.cloudId || id).catch((err) =>
      console.warn('Background cloud delete note:', err),
    )
  } catch (err) {
    throw friendlyError('delete the entry', err)
  }
}

export async function clearAll() {
  try {
    const db = await dbPromise()
    await db.clear(STORE)
    syncStats()
  } catch (err) {
    throw friendlyError('delete all data', err)
  }
}
