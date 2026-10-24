export const MAX_PHOTOS = 3
const MAX_EDGE = 1280
const JPEG_QUALITY = 0.8

export async function processFiles(fileList, existingCount = 0) {
  const files = Array.from(fileList || []).filter((f) =>
    f.type.startsWith('image/'),
  )
  const room = Math.max(0, MAX_PHOTOS - existingCount)
  const accepted = files.slice(0, room)
  const skipped = files.length - accepted.length

  const photos = []
  for (const file of accepted) {
    photos.push(await resizeToBlob(file))
  }
  return { photos, skipped }
}

async function resizeToBlob(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(
      1,
      MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight),
    )
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(img, 0, 0, w, h)
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob) throw new Error('Could not resize that image')
    return { name: file.name, type: 'image/jpeg', blob }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = url
  })
}
