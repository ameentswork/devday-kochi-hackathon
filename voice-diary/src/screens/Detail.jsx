import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteEntry, getEntry } from '../lib/db'
import { formatDate } from '../lib/format'
import { languageLabel } from '../lib/speech'
import { useDraft } from '../state/DraftContext'
import { useToast } from '../components/Toast'
import { useObjectUrls } from '../components/PhotoStrip'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Detail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { dispatch } = useDraft()
  const toast = useToast()

  const [entry, setEntry] = useState(undefined)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [enlarged, setEnlarged] = useState(null)

  useEffect(() => {
    let alive = true
    getEntry(id)
      .then((e) => alive && (e ? setEntry(e) : setError('Entry not found.')))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [id])

  const photoUrls = useObjectUrls(entry?.photos || [])

  function startEdit() {
    dispatch({ type: 'load', entry })
    navigate('/review')
  }

  async function doDelete() {
    try {
      await deleteEntry(id)
      toast('Memory deleted', 'success')
      navigate('/memories', { replace: true })
    } catch (err) {
      setConfirmDelete(false)
      toast(err.message, 'error')
    }
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">Memory</h1>
        <p className="inline-error" role="alert">
          {error}
        </p>
      </div>
    )
  }

  if (!entry) return <p className="muted">Loading…</p>

  return (
    <div>
      <h1 className="page-title">{entry.title || 'Untitled memory'}</h1>
      <div className="detail-meta">
        <span>{formatDate(entry.entryDate)}</span>
        <span className="chip">{languageLabel(entry.language)}</span>
      </div>

      <p className="entry-full">{entry.transcript}</p>

      {entry.photos?.length > 0 && (
        <div className="photo-grid">
          {entry.photos.map((p, i) => (
            <button
              key={i}
              type="button"
              className="photo-thumb clickable"
              onClick={() => setEnlarged(i)}
              aria-label={`Enlarge photo ${i + 1}`}
            >
              <img src={photoUrls[i]} alt={p.name || `Photo ${i + 1}`} />
            </button>
          ))}
        </div>
      )}

      <div className="detail-actions">
        <button type="button" className="btn btn-ghost" onClick={startEdit}>
          Edit
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this memory?"
        message="This removes the entry and its photos permanently."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />

      {enlarged !== null && (
        <div
          className="lightbox"
          role="presentation"
          onClick={() => setEnlarged(null)}
        >
          <img
            src={photoUrls[enlarged]}
            alt={entry.photos[enlarged]?.name || `Photo ${enlarged + 1}`}
          />
        </div>
      )}
    </div>
  )
}
