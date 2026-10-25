import { getToken, getUid } from './api'

// Remote Cloudflare Worker URL (e.g. https://voice-diary-api.<subdomain>.workers.dev)
const ENV_WORKER_URL = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '')

export function getWorkerBaseUrl() {
  if (ENV_WORKER_URL) return ENV_WORKER_URL
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8787'
    }
    // In deployed environment, if worker is on same host or subroute
    return ''
  }
  return 'http://localhost:8787'
}

/**
 * Convert a Blob to Base64 data string
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) return resolve('')
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result
      if (typeof dataUrl === 'string') {
        const base64 = dataUrl.split(',')[1] || ''
        resolve(base64)
      } else {
        resolve('')
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Build common authentication and identification headers
 */
function getCloudHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const uid = getUid()
  if (uid) headers['X-User-Id'] = uid
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

/**
 * Save or update a diary entry in Cloudflare D1 and voice audio in R2
 * Returns cloud save result with audio_key, or null if cloud is unreachable
 */
export async function saveEntryToCloud(entry) {
  const baseUrl = getWorkerBaseUrl()
  let audioBase64 = ''

  if (entry.audio?.blob) {
    try {
      audioBase64 = await blobToBase64(entry.audio.blob)
    } catch (err) {
      console.warn('Could not encode voice recording for cloud upload:', err)
    }
  }

  const payload = {
    id: String(entry.id || `entry_${Date.now()}`),
    user_id: getUid() || 'default_user',
    title: entry.title || 'Untitled memory',
    entry_date: entry.entryDate || new Date().toISOString().slice(0, 10),
    transcript: entry.transcript || '',
    language: entry.language || 'en-US',
    mood: entry.mood || '',
    illustration_prompt: entry.illustration?.prompt || '',
    audio_base64: audioBase64,
    audio_key: entry.audio?.key || null,
    audio_type: entry.audio?.type || 'audio/webm',
    audio_duration: entry.audio?.duration || 0,
    created_at: entry.createdAt || new Date().toISOString(),
  }

  try {
    const res = await fetch(`${baseUrl}/api/entries`, {
      method: 'POST',
      headers: getCloudHeaders(),
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Cloud save failed: ${res.status}`)
    }

    return await res.json()
  } catch (err) {
    console.warn('Cloud sync note (fallback to local IndexedDB):', err.message)
    return null
  }
}

/**
 * Fetch all diary entries from Cloudflare D1 for the authenticated user
 */
export async function loadEntriesFromCloud() {
  const baseUrl = getWorkerBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/entries`, {
      method: 'GET',
      headers: getCloudHeaders(),
    })

    if (!res.ok) return []
    const data = await res.json().catch(() => ({}))
    const rawEntries = Array.isArray(data.entries) ? data.entries : []

    // Map D1 database row schema to application entry structure
    return rawEntries.map((row) => {
      let audio = null
      if (row.audio_key) {
        audio = {
          key: row.audio_key,
          url: `${baseUrl}/api/audio/${encodeURIComponent(row.audio_key)}`,
          type: row.audio_type || 'audio/webm',
          duration: Number(row.audio_duration) || 0,
        }
      }

      return {
        id: isNaN(Number(row.id)) ? row.id : Number(row.id),
        cloudId: String(row.id),
        title: row.title || 'Untitled memory',
        entryDate: row.entry_date || (row.created_at || '').slice(0, 10),
        transcript: row.transcript || '',
        language: row.language || 'en-US',
        mood: row.mood || '',
        illustration: row.illustration_prompt
          ? { prompt: row.illustration_prompt, name: 'illustration.png' }
          : null,
        audio,
        photos: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        cloudSynced: true,
      }
    })
  } catch (err) {
    console.warn('Could not load entries from cloud worker:', err.message)
    return []
  }
}

/**
 * Delete a diary entry from Cloudflare D1 and its voice audio from R2
 */
export async function deleteEntryFromCloud(id) {
  const baseUrl = getWorkerBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/entries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getCloudHeaders(),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Transcribe a voice audio Blob using Cloudflare Workers AI Whisper model
 * Supports multilingual transcription (Malayalam, English, Hindi, Tamil, etc.)
 */
export async function transcribeAudioBlob(audioBlob, language = 'en-US') {
  if (!audioBlob) return ''
  const baseUrl = getWorkerBaseUrl()
  const base64 = await blobToBase64(audioBlob)
  if (!base64) return ''

  try {
    const res = await fetch(`${baseUrl}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Language': language,
      },
      body: JSON.stringify({
        audio_base64: base64,
        language,
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.warn('Transcription response notice:', errData.error)
      return ''
    }

    const data = await res.json()
    return (data.text || '').trim()
  } catch (err) {
    console.warn('AI Whisper transcription note:', err.message)
    return ''
  }
}

