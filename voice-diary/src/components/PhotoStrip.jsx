import { useEffect, useMemo } from 'react'

export function useObjectUrls(photos) {
  const urls = useMemo(
    () => (photos || []).map((p) => URL.createObjectURL(p.blob)),
    [photos],
  )
  useEffect(
    () => () => urls.forEach((u) => URL.revokeObjectURL(u)),
    [urls],
  )
  return urls
}

export default function PhotoStrip({ photos, onPhotoClick }) {
  const urls = useObjectUrls(photos)
  if (!photos?.length) return null

  return (
    <div className="photo-strip">
      {photos.map((p, i) =>
        onPhotoClick ? (
          <button
            key={i}
            type="button"
            className="photo-thumb clickable"
            onClick={() => onPhotoClick(i)}
            aria-label={`Enlarge photo ${i + 1}`}
          >
            <img src={urls[i]} alt={p.name || `Photo ${i + 1}`} />
          </button>
        ) : (
          <div key={i} className="photo-thumb">
            <img src={urls[i]} alt={p.name || `Photo ${i + 1}`} />
          </div>
        ),
      )}
    </div>
  )
}
