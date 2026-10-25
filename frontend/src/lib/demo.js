import { addEntry } from './db'
import { todayISO } from './format'

// Demo seed entries with canvas-drawn images, so the UI can be explored
// without a microphone or real photos.

function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function drawScene(canvas, variant) {
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas

  const sky = ctx.createLinearGradient(0, 0, 0, h)
  const palettes = {
    park: ['#f5ecd9', '#cfe0d0', '#a9bfa8'],
    evening: ['#f2dfc0', '#e5c99a', '#8fae93'],
    rain: ['#e9e7dc', '#c3ccbf', '#9db3a1'],
    hills: ['#f5ecd9', '#d4e2cf', '#2f5d45'],
  }
  const [top, mid, bottom] = palettes[variant] || palettes.park
  sky.addColorStop(0, top)
  sky.addColorStop(0.6, mid)
  sky.addColorStop(1, bottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // sun / moon
  ctx.fillStyle = variant === 'evening' ? '#e8b06a' : '#faf6ec'
  ctx.beginPath()
  ctx.arc(w * 0.72, h * 0.28, w * 0.09, 0, Math.PI * 2)
  ctx.fill()

  // hills
  ctx.fillStyle = '#2f5d45'
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.moveTo(0, h * 0.7)
  ctx.quadraticCurveTo(w * 0.25, h * 0.45, w * 0.55, h * 0.68)
  ctx.quadraticCurveTo(w * 0.8, h * 0.85, w, h * 0.62)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()

  ctx.fillStyle = '#234a37'
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(0, h * 0.85)
  ctx.quadraticCurveTo(w * 0.35, h * 0.62, w * 0.7, h * 0.82)
  ctx.quadraticCurveTo(w * 0.88, h * 0.93, w, h * 0.8)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()
  ctx.globalAlpha = 1

  if (variant === 'rain') {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 2
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * w
      const y = Math.random() * h * 0.6
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 4, y + 14)
      ctx.stroke()
    }
  }

  if (variant === 'park') {
    // a few simple trees
    ctx.fillStyle = '#234a37'
    for (const tx of [0.15, 0.32, 0.85]) {
      ctx.fillRect(w * tx - 3, h * 0.66, 6, h * 0.12)
      ctx.beginPath()
      ctx.arc(w * tx, h * 0.63, w * 0.045, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function sceneBlob(variant) {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  drawScene(canvas, variant)
  return new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.8),
  )
}

const DEMO_ENTRIES = [
  {
    title: 'Morning walk in the park',
    language: 'en-IN',
    mood: '🌿',
    entryDate: todayISO(),
    transcript:
      'Went for a long walk this morning before the heat set in. The park was ' +
      'quiet except for a few joggers and the birds. Sat on my usual bench for ' +
      'a while and just watched the light come through the trees. Felt like a ' +
      'good, slow start to the day.',
    photos: [
      { variant: 'park', name: 'demo-park.jpg' },
      { variant: 'hills', name: 'demo-hills.jpg' },
    ],
  },
  {
    title: 'ഇന്നത്തെ പ്രധാന നിമിഷം',
    language: 'ml-IN',
    mood: '☕',
    entryDate: daysAgoISO(1),
    transcript:
      'ഇന്ന് വൈകുന്നേരം വീട്ടിന്റെ മുറ്റത്ത് ഇരുന്ന് ചായ കുടിച്ചു. ' +
      'മഴ കഴിഞ്ഞ് വന്ന തണുത്ത കാറ്റ് വളരെ ഇഷ്ടായിരുന്നു.',
    illustration: { variant: 'evening', name: 'demo-evening.png' },
    illustrationGens: 1,
  },
  {
    title: 'First rain of the season',
    language: 'en-US',
    mood: '🌧️',
    entryDate: daysAgoISO(2),
    transcript:
      'The first proper rain arrived today. I stood at the window with coffee ' +
      'and watched the street empty out. Everything smells like wet earth now. ' +
      'Did nothing productive and I am completely fine with that.',
    photos: [{ variant: 'rain', name: 'demo-rain.jpg' }],
  },
  {
    title: 'A quiet Sunday',
    language: 'en-IN',
    mood: '😊',
    entryDate: daysAgoISO(4),
    transcript:
      'Slept in, cooked a slow lunch, read a few chapters. No plans, no ' +
      'notifications. These days are rare and worth writing down.',
    photos: [],
  },
]

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

function audioBufferToWavBlob(buffer) {
  const numChannels = 1
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16

  const channelData = buffer.getChannelData(0)
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = channelData.length * bytesPerSample
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([view], { type: 'audio/wav' })
}

export async function createDemoAudioBlob(durationSeconds = 6) {
  try {
    const sampleRate = 44100
    const AudioCtx =
      typeof window !== 'undefined'
        ? window.OfflineAudioContext || window.webkitOfflineAudioContext
        : null
    if (!AudioCtx) return null

    const ctx = new AudioCtx(1, sampleRate * durationSeconds, sampleRate)
    const notes = [261.63, 329.63, 392.0, 523.25]
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = idx * 1.2
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 1.2)
    })

    const rendered = await ctx.startRendering()
    return audioBufferToWavBlob(rendered)
  } catch {
    return null
  }
}

export async function seedDemoEntries() {
  const sampleAudioBlob = await createDemoAudioBlob(6)

  for (let idx = 0; idx < DEMO_ENTRIES.length; idx++) {
    const demo = DEMO_ENTRIES[idx]
    const now = new Date().toISOString()
    const photos = await Promise.all(
      (demo.photos || []).map(async (p) => ({
        name: p.name,
        type: 'image/jpeg',
        blob: await sceneBlob(p.variant),
      })),
    )
    const illustration = demo.illustration
      ? {
        prompt:
          'soft watercolour illustration, warm ivory and forest-green palette',
        name: demo.illustration.name,
        type: 'image/jpeg',
        blob: await sceneBlob(demo.illustration.variant),
      }
      : null

    const audio =
      sampleAudioBlob && (idx === 0 || idx === 1)
        ? {
          blob: sampleAudioBlob,
          type: 'audio/wav',
          duration: 6,
        }
        : null

    await addEntry({
      title: demo.title,
      entryDate: demo.entryDate,
      language: demo.language,
      transcript: demo.transcript,
      photos,
      illustration,
      illustrationGens: demo.illustrationGens || 0,
      mood: demo.mood || '',
      audio,
      createdAt: now,
      updatedAt: now,
    })
  }
}
