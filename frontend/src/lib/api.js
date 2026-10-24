const TOKEN_KEY = 'voice-diary-token'
const UID_KEY = 'voice-diary-uid'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)

// Stable per-account identifier — namespaces the diary's IndexedDB.
export const getUid = () => localStorage.getItem(UID_KEY)
export const setUid = (id) =>
  id ? localStorage.setItem(UID_KEY, id) : localStorage.removeItem(UID_KEY)

// Members report their entry COUNT only — content never leaves the device.
export async function reportEntryCount(count) {
  try {
    await api('/api/me/stats', {
      method: 'POST',
      body: { entryCount: count },
    })
  } catch {
    // best-effort stat; never block the UI on it
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(
      'Cannot reach the server — is `npm run dev:backend` running?',
    )
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}
