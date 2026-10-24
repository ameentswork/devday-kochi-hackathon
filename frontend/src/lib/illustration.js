import { PROMPT_MAX_CHARS } from './limits'

// Remote worker endpoint if specified in env
const WORKER_BASE = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '')

/**
 * Generate a watercolour illustration for a diary entry.
 * Tries the Cloudflare Worker first (if available either via VITE_WORKER_URL or local worker).
 * If unreachable (e.g. local worker offline, or Render deployment without worker binding),
 * seamlessly falls back to a high-res programmatic watercolour canvas painter so the feature
 * always succeeds on both local and Render environments!
 */
export async function generateIllustration(transcript, language) {
  const cleanTranscript = (transcript || '').slice(0, PROMPT_MAX_CHARS)

  // 1. Try Cloudflare Worker endpoint if reachable
  const workerUrls = []
  if (WORKER_BASE) {
    workerUrls.push(WORKER_BASE)
  }
  // Try localhost:8787 if running locally
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    if (!workerUrls.includes('http://localhost:8787')) {
      workerUrls.push('http://localhost:8787')
    }
  }
  // Also try same-origin backend API (Render or proxied dev)
  if (!workerUrls.includes('')) {
    workerUrls.push('')
  }

  for (const baseUrl of workerUrls) {
    try {
      const promptRes = await fetchWithTimeout(`${baseUrl}/api/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: cleanTranscript, language }),
      }, 4000)

      if (promptRes.ok) {
        const { prompt } = await promptRes.json()
        if (prompt) {
          const imgRes = await fetchWithTimeout(`${baseUrl}/api/image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          }, 8000)

          if (imgRes.ok) {
            const blob = await imgRes.blob()
            if (blob && blob.size > 0) {
              return { prompt, name: 'illustration.png', type: 'image/png', blob }
            }
          }
        }
      }
    } catch {
      // Continue to next URL or fallback
    }
  }

  // 2. Seamless local/Render artistic watercolour generator fallback
  const fallback = await createWatercolourCanvas(cleanTranscript, language)
  return fallback
}

async function fetchWithTimeout(url, options, timeoutMs = 4000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (err) {
    clearTimeout(id)
    throw err
  }
}

/**
 * Creates a beautiful high-resolution watercolour illustration on an HTML5 canvas.
 * Analyzes the text mood, generates rich layered watercolor gradients and organic shapes
 * reflecting the journal palette: warm ivory, deep forest, sage, and golden evening light.
 */
function createWatercolourCanvas(text = '', _language = 'en-IN') {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 768
    canvas.height = 512
    const ctx = canvas.getContext('2d')

    const lower = text.toLowerCase()
    let theme = 'nature'
    let moodTitle = 'Peaceful journal reflection'

    if (lower.includes('rain') || lower.includes('cloud') || lower.includes('storm') || lower.includes('മഴ')) {
      theme = 'rain'
      moodTitle = 'Gentle rain and misty morning'
    } else if (
      lower.includes('night') ||
      lower.includes('sunset') ||
      lower.includes('evening') ||
      lower.includes('stars') ||
      lower.includes('സന്ധ്യ')
    ) {
      theme = 'twilight'
      moodTitle = 'Golden evening glow over quiet hills'
    } else if (
      lower.includes('walk') ||
      lower.includes('travel') ||
      lower.includes('trip') ||
      lower.includes('mountain') ||
      lower.includes('യാത്ര')
    ) {
      theme = 'journey'
      moodTitle = 'A winding path through verdant hills'
    } else if (
      lower.includes('happy') ||
      lower.includes('joy') ||
      lower.includes('family') ||
      lower.includes('friend') ||
      lower.includes('സന്തോഷം')
    ) {
      theme = 'warmth'
      moodTitle = 'Warm sunlight and fond memories'
    }

    const { width: w, height: h } = canvas

    // Palettes matching app design tokens
    const themes = {
      nature: {
        sky: ['#FAF6EC', '#E6EDDE', '#A9BFA8'],
        hillsBack: '#5A7D69',
        hillsMid: '#3A7357',
        hillsFront: '#234A37',
        sun: '#E8C582',
      },
      rain: {
        sky: ['#F0EFEA', '#D5DFD7', '#9DB3A1'],
        hillsBack: '#6B8775',
        hillsMid: '#446853',
        hillsFront: '#2A4638',
        sun: '#D6DEC3',
      },
      twilight: {
        sky: ['#F5E6D3', '#E9C79A', '#8FAE93'],
        hillsBack: '#6B584E',
        hillsMid: '#3F5B49',
        hillsFront: '#234A37',
        sun: '#EFA459',
      },
      journey: {
        sky: ['#FAF6EC', '#D4E2CF', '#8FA88D'],
        hillsBack: '#527D64',
        hillsMid: '#3A7357',
        hillsFront: '#1F3C2C',
        sun: '#F2D082',
      },
      warmth: {
        sky: ['#FFF8ED', '#F7E7CE', '#C5D7BF'],
        hillsBack: '#7E9C7D',
        hillsMid: '#487A5B',
        hillsFront: '#2B513C',
        sun: '#FFBE5C',
      },
    }

    const pal = themes[theme] || themes.nature

    // 1. Paper texture base
    ctx.fillStyle = '#FAF6EC'
    ctx.fillRect(0, 0, w, h)

    // 2. Soft sky watercolor gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.75)
    skyGrad.addColorStop(0, pal.sky[0])
    skyGrad.addColorStop(0.5, pal.sky[1])
    skyGrad.addColorStop(1, pal.sky[2])
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, w, h)

    // 3. Gentle luminous Sun / Moon orb
    ctx.save()
    const sunGrad = ctx.createRadialGradient(
      w * 0.72,
      h * 0.28,
      w * 0.02,
      w * 0.72,
      h * 0.28,
      w * 0.16,
    )
    sunGrad.addColorStop(0, pal.sun)
    sunGrad.addColorStop(0.5, 'rgba(255, 246, 236, 0.4)')
    sunGrad.addColorStop(1, 'rgba(255, 246, 236, 0)')
    ctx.fillStyle = sunGrad
    ctx.beginPath()
    ctx.arc(w * 0.72, h * 0.28, w * 0.16, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 4. Watercolor mist bands
    ctx.save()
    ctx.fillStyle = 'rgba(255, 253, 247, 0.25)'
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.ellipse(w * (0.2 + i * 0.22), h * (0.35 + i * 0.08), w * 0.35, h * 0.06, -0.05, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Helper: Draw organic watercolor rolling ridge
    function drawRidge(yBase, amplitude, color, alpha) {
      ctx.save()
      ctx.fillStyle = color
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.moveTo(0, yBase)
      let prevX = 0
      let prevY = yBase
      const steps = 8
      for (let s = 1; s <= steps; s++) {
        const targetX = (w / steps) * s
        const targetY = yBase + Math.sin(s * 1.3 + yBase) * amplitude
        const midX = (prevX + targetX) / 2
        const midY = (prevY + targetY) / 2
        ctx.quadraticCurveTo(prevX, prevY, midX, midY)
        prevX = targetX
        prevY = targetY
      }
      ctx.lineTo(w, prevY)
      ctx.lineTo(w, h)
      ctx.lineTo(0, h)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // 5. Layered organic mountain ridges with atmospheric depth
    drawRidge(h * 0.52, 45, pal.hillsBack, 0.7)
    drawRidge(h * 0.65, 55, pal.hillsMid, 0.85)
    drawRidge(h * 0.80, 40, pal.hillsFront, 0.95)

    // 6. Watercolor wash vignettes & paper border
    const vignette = ctx.createLinearGradient(0, 0, 0, h)
    vignette.addColorStop(0, 'rgba(47, 93, 69, 0.08)')
    vignette.addColorStop(0.2, 'transparent')
    vignette.addColorStop(0.85, 'transparent')
    vignette.addColorStop(1, 'rgba(35, 74, 55, 0.25)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, w, h)

    // Convert canvas to PNG Blob
    canvas.toBlob((blob) => {
      const prompt = `Soft watercolour painting: ${moodTitle}. Warm ivory and forest green palette, serene journal atmosphere.`
      resolve({
        prompt,
        name: 'illustration.png',
        type: 'image/png',
        blob,
      })
    }, 'image/png')
  })
}
