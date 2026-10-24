import { PROMPT_MAX_CHARS } from './limits'

// Point at `wrangler dev` locally or the deployed worker on the phone.
const WORKER_BASE = (
  import.meta.env.VITE_WORKER_URL || 'http://localhost:8787'
).replace(/\/$/, '')

export async function generateIllustration(transcript, language) {
  const { prompt } = await post('/api/prompt', {
    transcript: transcript.slice(0, PROMPT_MAX_CHARS),
    language,
  })
  const blob = await postBlob('/api/image', { prompt })
  return { prompt, name: 'illustration.png', type: 'image/png', blob }
}

async function post(path, body) {
  const res = await postRaw(path, body)
  return res.json()
}

async function postBlob(path, body) {
  const res = await postRaw(path, body)
  return res.blob()
}

async function postRaw(path, body) {
  let res
  try {
    res = await fetch(`${WORKER_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Illustration service is unreachable')
  }
  if (!res.ok) {
    let message = 'Illustration failed'
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // keep default message
    }
    throw new Error(message)
  }
  return res
}
