import { Link } from 'react-router-dom'
import PhotoStrip from './PhotoStrip'
import { formatDate, formatDuration } from '../lib/format'
import { languageLabel } from '../lib/speech'

export default function EntryCard({ entry }) {
  const hasPhotos = entry.photos?.length > 0
  const thumbs = hasPhotos
    ? entry.photos
    : entry.illustration
      ? [entry.illustration]
      : []

  return (
    <Link to={`/entry/${entry.id}`} className="entry-card card">
      <div className="entry-card-head">
        <h3 dir="auto">
          {entry.mood && <span className="entry-mood-badge" title="Mood">{entry.mood} </span>}
          {entry.title || 'Untitled memory'}
        </h3>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {entry.audio && (
            <span className="chip chip-audio" title="Contains original voice recording">
              🎙️ {formatDuration(entry.audio.duration || 0)}
            </span>
          )}
          <span className="chip">{languageLabel(entry.language)}</span>
        </div>
      </div>
      <p className="entry-date">{formatDate(entry.entryDate)}</p>
      <p className="entry-preview" dir="auto">{entry.transcript}</p>
      <PhotoStrip photos={thumbs} />
      {!hasPhotos && entry.illustration && (
        <span className="chip chip-ai">AI illustration</span>
      )}
    </Link>
  )
}
