import { listEntries } from './db'
import { formatDate, todayISO } from './format'
import { languageLabel } from './speech'

// Personal diary export — runs fully client-side, data never leaves the browser.

function download(content, filename, type) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Could not read an image'))
    reader.readAsDataURL(blob)
  })
}

async function encodeImages(photoList) {
  const out = []
  for (const p of photoList || []) {
    out.push({
      name: p.name,
      type: p.type,
      dataBase64: await blobToBase64(p.blob),
    })
  }
  return out
}

export async function exportJSON() {
  const entries = await listEntries()
  const out = []
  for (const e of entries) {
    out.push({
      id: e.id,
      title: e.title,
      entryDate: e.entryDate,
      language: e.language,
      mood: e.mood || null,
      transcript: e.transcript,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      audio: e.audio?.blob
        ? {
            type: e.audio.type,
            duration: e.audio.duration,
            dataBase64: await blobToBase64(e.audio.blob),
          }
        : null,
      photos: await encodeImages(e.photos),
      illustration: e.illustration
        ? {
            prompt: e.illustration.prompt,
            ...(await encodeImages([e.illustration]))[0],
          }
        : null,
    })
  }
  download(
    JSON.stringify({ app: 'voice-diary', exportedAt: new Date().toISOString(), entries: out }, null, 2),
    `voice-diary-${todayISO()}.json`,
    'application/json',
  )
  return out.length
}

export async function exportText() {
  const entries = await listEntries()
  const parts = ['VOICE DIARY — export', `Exported ${new Date().toLocaleString()}`, '']
  for (const e of entries) {
    parts.push('═'.repeat(40))
    parts.push(`${e.mood ? e.mood + ' ' : ''}${e.title || 'Untitled memory'}`)
    parts.push(`${formatDate(e.entryDate)} · ${languageLabel(e.language)}`)
    if (e.audio) parts.push(`[🎙️ Spoken voice memo: ${e.audio.duration || 0}s]`)
    if (e.photos?.length) parts.push(`[${e.photos.length} photo(s)]`)
    if (e.illustration && !e.photos?.length) parts.push('[AI illustration]')
    parts.push('')
    parts.push(e.transcript || '')
    parts.push('')
  }
  download(parts.join('\n'), `voice-diary-${todayISO()}.txt`, 'text/plain')
  return entries.length
}
