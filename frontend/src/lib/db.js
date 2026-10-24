import { openDB } from 'idb'
import { getUid, reportEntryCount } from './api'

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

export async function addEntry(entry) {
  try {
    const db = await dbPromise()
    const id = await db.add(STORE, { ...entry, owner: owner() })
    syncStats()
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
    await db.put(STORE, {
      ...existing,
      ...changes,
      id: Number(id),
      owner: existing.owner || owner(),
      updatedAt: new Date().toISOString(),
    })
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
    const all = (await db.getAll(STORE)).filter(
      (e) => !e.owner || e.owner === owner(),
    )
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
