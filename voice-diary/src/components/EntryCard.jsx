import { Link } from 'react-router-dom'
import PhotoStrip from './PhotoStrip'
import { formatDate } from '../lib/format'
import { languageLabel } from '../lib/speech'

export default function EntryCard({ entry }) {
  return (
    <Link to={`/entry/${entry.id}`} className="entry-card card">
      <div className="entry-card-head">
        <h3>{entry.title || 'Untitled memory'}</h3>
        <span className="chip">{languageLabel(entry.language)}</span>
      </div>
      <p className="entry-date">{formatDate(entry.entryDate)}</p>
      <p className="entry-preview">{entry.transcript}</p>
      <PhotoStrip photos={entry.photos} />
    </Link>
  )
}
