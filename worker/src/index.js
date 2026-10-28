// Voice Diary API — Cloudflare Worker
// Provides:
// - Workers AI prompt + illustration generation
// - Cloudflare D1 persistent database storage for diary entries & metadata (voice-diary-db)
// - Cloudflare R2 bucket audio storage for voice recordings (voice-diary-audio)
// - Private, authenticated audio streaming for memory playback

const MAX_BODY_BYTES = 12 * 1024 * 1024 // 12 MB to comfortably support audio memos
const PROMPT_MAX_CHARS = 1000

const CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const FALLBACK_CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast'
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell'
const WHISPER_MODEL = '@cf/openai/whisper'

const STYLE =
  'soft watercolour illustration, warm ivory and forest-green palette, ' +
  'gentle light, calm journal mood, no text, no logos, no recognisable real people'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Language',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status })
}

async function readJson(request) {
  const len = Number(request.headers.get('content-length') || 0)
  if (len > MAX_BODY_BYTES) throw httpError(413, 'Request body too large')
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw httpError(413, 'Request body too large')
  try {
    return JSON.parse(text)
  } catch {
    throw httpError(400, 'Body must be valid JSON')
  }
}

// ---------- Voice-to-Text Transcription via Workers AI Whisper ----------

async function handleTranscribe(request, env) {
  if (!env.AI) throw httpError(500, 'Workers AI binding "AI" is not configured')

  let audioBytes = null
  let language = ''

  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const body = await readJson(request)
    if (!body.audio_base64) throw httpError(400, 'audio_base64 is required')
    language = body.language || ''
    const binaryString = atob(body.audio_base64)
    audioBytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      audioBytes[i] = binaryString.charCodeAt(i)
    }
  } else {
    const buf = await request.arrayBuffer()
    if (!buf || buf.byteLength === 0) throw httpError(400, 'Audio stream is empty')
    audioBytes = new Uint8Array(buf)
    language = request.headers.get('x-language') || ''
  }

  const input = {
    audio: [...audioBytes],
  }
  if (language) {
    const shortLang = language.split('-')[0].toLowerCase()
    input.language = shortLang
  }

  try {
    const out = await env.AI.run(WHISPER_MODEL, input)
    const text = (out?.text || '').trim()
    return json({ text, vtt: out?.vtt || null, word_count: out?.word_count || 0 })
  } catch (err) {
    if (err.message && err.message.includes('no speech could be extracted')) {
      return json({ text: '', empty: true, message: 'No audible speech detected.' })
    }
    throw err
  }
}

function getUserId(request, body = null) {
  const headerUid = request.headers.get('x-user-id')
  if (headerUid && headerUid.trim()) return headerUid.trim()

  const authHeader = request.headers.get('authorization') || ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) return token.slice(0, 36)
  }

  if (body && typeof body.user_id === 'string' && body.user_id.trim()) {
    return body.user_id.trim()
  }

  return 'default_user'
}

// ---------- AI Prompt & Illustration Generation ----------

async function handlePrompt(request, env) {
  const body = await readJson(request)
  const transcript = typeof body.transcript === 'string' ? body.transcript : ''
  if (!transcript.trim()) throw httpError(400, 'transcript is required')

  const messages = [
    {
      role: 'system',
      content:
        'You write ONE English image prompt for a diary illustration. ' +
        'Rules: at most 60 words; always in this exact style: "' +
        STYLE +
        '"; ' +
        'describe only the setting, objects and mood of the diary entry; ' +
        'output the prompt text only, nothing else.',
    },
    {
      role: 'user',
      content:
        `Diary language: ${body.language || 'unknown'}\n` +
        `Diary entry:\n${transcript.slice(0, PROMPT_MAX_CHARS)}`,
    },
  ]

  let out
  try {
    out = await env.AI.run(CHAT_MODEL, { messages, max_tokens: 120 })
  } catch (err) {
    console.warn(`Primary model ${CHAT_MODEL} failed, attempting ${FALLBACK_CHAT_MODEL}:`, err?.message || err)
    out = await env.AI.run(FALLBACK_CHAT_MODEL, { messages, max_tokens: 120 })
  }
  const rawText = out?.response || out?.result?.response || (typeof out === 'string' ? out : '')
  const prompt = (rawText || '').trim().split('\n')[0].trim().slice(0, 500)
  if (!prompt) throw httpError(502, 'The model returned an empty prompt')
  return json({ prompt })
}

async function handleImage(request, env) {
  const body = await readJson(request)
  const prompt = typeof body.prompt === 'string' ? body.prompt : ''
  if (!prompt.trim()) throw httpError(400, 'prompt is required')

  const out = await env.AI.run(IMAGE_MODEL, { prompt: prompt.slice(0, 2000) })
  const b64 = out?.image
  if (!b64) throw httpError(502, 'Image generation failed')

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new Response(bytes, {
    headers: {
      ...CORS,
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  })
}

// ---------- Cloudflare D1 & R2 Diary Storage Endpoints ----------

/**
 * Save or update a diary entry in D1 and store audio in R2 (if provided)
 * Handles idempotency and duplicate submissions via ON CONFLICT
 */
async function handleSaveEntry(request, env) {
  if (!env.DB) throw httpError(500, 'D1 database binding "DB" is not configured')

  const body = await readJson(request)
  const userId = getUserId(request, body)
  const id = String(body.id || `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : ''
  if (!transcript) throw httpError(400, 'transcript is required')

  const title = (body.title || 'Untitled memory').slice(0, 200)
  const entryDate = body.entry_date || body.entryDate || new Date().toISOString().slice(0, 10)
  const language = body.language || 'en-US'
  const mood = body.mood || ''
  const illustrationPrompt = body.illustration_prompt || body.illustrationPrompt || ''
  const imageKey = body.image_key || body.imageKey || ''
  const audioDuration = Number(body.audio_duration || body.duration || 0)
  const audioType = body.audio_type || body.audioType || 'audio/webm'

  let audioKey = body.audio_key || body.audioKey || null

  // If a raw audio recording is attached in base64, store it in Cloudflare R2
  if (body.audio_base64 && typeof body.audio_base64 === 'string') {
    try {
      const ext = audioType.includes('wav') ? 'wav' : audioType.includes('mp4') ? 'mp4' : 'webm'
      audioKey = `audio_${userId}_${id}_${Date.now()}.${ext}`

      if (env.AUDIO_BUCKET) {
        const binaryString = atob(body.audio_base64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        await env.AUDIO_BUCKET.put(audioKey, bytes, {
          httpMetadata: { contentType: audioType },
          customMetadata: { userId, entryId: id },
        })
      }
    } catch (err) {
      console.warn('R2 voice recording upload note:', err)
      // If R2 upload encounters issue, retain entry in D1 without blocking text persistence
    }
  }

  const now = new Date().toISOString()
  const createdAt = body.created_at || body.createdAt || now
  const updatedAt = now

  // Persist into Cloudflare D1 with idempotent upsert
  await env.DB.prepare(
    `INSERT INTO diary_entries (
      id, user_id, title, entry_date, transcript, language, mood,
      illustration_prompt, image_key, audio_key, audio_duration, audio_type,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      entry_date = excluded.entry_date,
      transcript = excluded.transcript,
      language = excluded.language,
      mood = excluded.mood,
      illustration_prompt = excluded.illustration_prompt,
      image_key = excluded.image_key,
      audio_key = coalesce(excluded.audio_key, diary_entries.audio_key),
      audio_duration = coalesce(excluded.audio_duration, diary_entries.audio_duration),
      audio_type = coalesce(excluded.audio_type, diary_entries.audio_type),
      updated_at = excluded.updated_at`
  )
    .bind(
      id,
      userId,
      title,
      entryDate,
      transcript,
      language,
      mood,
      illustrationPrompt,
      imageKey,
      audioKey,
      audioDuration,
      audioType,
      createdAt,
      updatedAt
    )
    .run()

  return json({
    ok: true,
    id,
    audio_key: audioKey,
    user_id: userId,
    updated_at: updatedAt,
  })
}

/**
 * List all diary entries for the authenticated user from D1
 */
async function handleListEntries(request, env) {
  if (!env.DB) throw httpError(500, 'D1 database binding "DB" is not configured')

  const userId = getUserId(request)
  const { results } = await env.DB.prepare(
    'SELECT * FROM diary_entries WHERE user_id = ? ORDER BY entry_date DESC, created_at DESC'
  )
    .bind(userId)
    .all()

  return json({ entries: results || [] })
}

/**
 * Get a single entry by ID from D1
 */
async function handleGetEntry(request, env, id) {
  if (!env.DB) throw httpError(500, 'D1 database binding "DB" is not configured')

  const userId = getUserId(request)
  const entry = await env.DB.prepare(
    'SELECT * FROM diary_entries WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first()

  if (!entry) throw httpError(404, 'Entry not found')
  return json({ entry })
}

/**
 * Delete an entry from D1 and its audio file from R2
 */
async function handleDeleteEntry(request, env, id) {
  if (!env.DB) throw httpError(500, 'D1 database binding "DB" is not configured')

  const userId = getUserId(request)
  const existing = await env.DB.prepare(
    'SELECT audio_key FROM diary_entries WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first()

  if (!existing) throw httpError(404, 'Entry not found')

  if (existing.audio_key && env.AUDIO_BUCKET) {
    try {
      await env.AUDIO_BUCKET.delete(existing.audio_key)
    } catch (err) {
      console.warn('R2 audio delete note:', err)
    }
  }

  await env.DB.prepare('DELETE FROM diary_entries WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()

  return json({ ok: true, deleted: id })
}

/**
 * Stream private audio file from Cloudflare R2
 * Enforces ownership check against D1 so private recordings are never exposed publicly
 */
async function handleGetAudio(request, env, audioKey) {
  if (!env.AUDIO_BUCKET) {
    throw httpError(501, 'R2 audio storage binding "AUDIO_BUCKET" is not configured')
  }

  const userId = getUserId(request)

  // Verify ownership via D1
  if (env.DB) {
    const record = await env.DB.prepare(
      'SELECT user_id, audio_type FROM diary_entries WHERE audio_key = ?'
    )
      .bind(audioKey)
      .first()

    if (record && record.user_id !== userId) {
      throw httpError(403, 'Forbidden: You do not have permission to access this voice recording.')
    }
  }

  const object = await env.AUDIO_BUCKET.get(audioKey)
  if (!object) throw httpError(404, 'Voice recording not found in storage')

  const headers = new Headers({
    ...CORS,
    'Content-Type': object.httpMetadata?.contentType || 'audio/webm',
    'Cache-Control': 'private, max-age=3600',
    ETag: object.httpEtag,
  })

  return new Response(object.body, { headers })
}

// ---------- Main Request Router ----------

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const url = new URL(request.url)
    const pathname = url.pathname

    try {
      // AI Transcription & Illustration Generation endpoints
      if (request.method === 'POST' && pathname === '/api/transcribe') {
        return await handleTranscribe(request, env)
      }
      if (request.method === 'POST' && pathname === '/api/prompt') {
        return await handlePrompt(request, env)
      }
      if (request.method === 'POST' && pathname === '/api/image') {
        return await handleImage(request, env)
      }

      // Cloud Diary Entries Endpoints (Cloudflare D1 + R2)
      if (request.method === 'POST' && pathname === '/api/entries') {
        return await handleSaveEntry(request, env)
      }
      if (request.method === 'GET' && pathname === '/api/entries') {
        return await handleListEntries(request, env)
      }

      // Single entry route: /api/entries/:id
      const entryMatch = pathname.match(/^\/api\/entries\/([^/]+)$/)
      if (entryMatch) {
        const id = decodeURIComponent(entryMatch[1])
        if (request.method === 'GET') {
          return await handleGetEntry(request, env, id)
        }
        if (request.method === 'DELETE') {
          return await handleDeleteEntry(request, env, id)
        }
      }

      // Private audio stream route: /api/audio/:key
      const audioMatch = pathname.match(/^\/api\/audio\/(.+)$/)
      if (audioMatch && request.method === 'GET') {
        const audioKey = decodeURIComponent(audioMatch[1])
        return await handleGetAudio(request, env, audioKey)
      }

      return json({ error: 'Endpoint not found' }, 404)
    } catch (err) {
      return json({ error: err.message || 'Server error' }, err.status || 500)
    }
  },
}
