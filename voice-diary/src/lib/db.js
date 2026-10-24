import { openDB } from 'idb'

const DB_NAME = 'voice-diary'
const STORE = 'entries'

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    store.createIndex('entryDate', 'entryDate')
  },
})

function friendlyError(action, err) {
  return new Error(`Could not ${action}: ${err?.message || err}`)
}

export async function addEntry(entry) {
  try {
    const db = await dbPromise
    return await db.add(STORE, entry)
  } catch (err) {
    throw friendlyError('save the entry', err)
  }
}

export async function updateEntry(id, changes) {
  try {
    const db = await dbPromise
    const existing = await db.get(STORE, Number(id))
    if (!existing) throw new Error('entry not found')
    await db.put(STORE, {
      ...existing,
      ...changes,
      id: Number(id),
      updatedAt: new Date().toISOString(),
    })
    return Number(id)
  } catch (err) {
    throw friendlyError('update the entry', err)
  }
}

export async function getEntry(id) {
  try {
    const db = await dbPromise
    return await db.get(STORE, Number(id))
  } catch (err) {
    throw friendlyError('open the entry', err)
  }
}

export async function listEntries() {
  try {
    const db = await dbPromise
    const all = await db.getAll(STORE)
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
    const db = await dbPromise
    await db.delete(STORE, Number(id))
  } catch (err) {
    throw friendlyError('delete the entry', err)
  }
}

export async function clearAll() {
  try {
    const db = await dbPromise
    await db.clear(STORE)
  } catch (err) {
    throw friendlyError('delete all data', err)
  }
}
