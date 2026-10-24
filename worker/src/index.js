// Voice Diary API — prompt + illustration generation through Workers AI.
// No secrets: the AI binding is attached in wrangler.toml.

const MAX_BODY_BYTES = 8 * 1024
const PROMPT_MAX_CHARS = 1000

const CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell'

const STYLE =
  'soft watercolour illustration, warm ivory and forest-green palette, ' +
  'gentle light, calm journal mood, no text, no logos, no recognisable real people'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function readJson(request) {
  const len = Number(request.headers.get('content-length') || 0)
  if (len > MAX_BODY_BYTES) throw httpError(413, 'Request body too large')
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw httpError(413, 'Request body too large')
  try {
    return JSON.parse(text)
  } catch {
    throw httpError(400, 'Body must be JSON')
  }
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status })
}

async function handlePrompt(request, env) {
  const body = await readJson(request)
  const transcript = typeof body.transcript === 'string' ? body.transcript : ''
  if (!transcript.trim()) throw httpError(400, 'transcript is required')

  const messages = [
    {
      role: 'system',
      content:
        'You write ONE English image prompt for a diary illustration. ' +
        'Rules: at most 60 words; always in this exact style: "' + STYLE + '"; ' +
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

  const out = await env.AI.run(CHAT_MODEL, { messages, max_tokens: 120 })
  const prompt = (out?.response || '').trim().split('\n')[0].trim().slice(0, 500)
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const { pathname } = new URL(request.url)
    try {
      if (request.method === 'POST' && pathname === '/api/prompt')
        return await handlePrompt(request, env)
      if (request.method === 'POST' && pathname === '/api/image')
        return await handleImage(request, env)
      return json({ error: 'Not found' }, 404)
    } catch (err) {
      return json({ error: err.message || 'Server error' }, err.status || 500)
    }
  },
}
