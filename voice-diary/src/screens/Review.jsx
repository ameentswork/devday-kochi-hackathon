import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDraft } from '../state/DraftContext'
import { useToast } from '../components/Toast'
import { useObjectUrls } from '../components/PhotoStrip'
import ConfirmDialog from '../components/ConfirmDialog'
import { addEntry, updateEntry } from '../lib/db'
import { MAX_PHOTOS, processFiles } from '../lib/photos'
import { LANGUAGES } from '../lib/speech'
import { todayISO } from '../lib/format'

export default function Review() {
  const { draft, dispatch } = useDraft()
  const navigate = useNavigate()
  const toast = useToast()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const fileInputRef = useRef(null)
  const photoUrls = useObjectUrls(draft.photos)

  const isEditing = Boolean(draft.id)

  async function onPickPhotos(event) {
    try {
      const { photos, skipped } = await processFiles(
        event.target.files,
        draft.photos.length,
      )
      if (photos.length) dispatch({ type: 'addPhotos', photos })
      if (skipped > 0) {
        toast(
          `Only up to ${MAX_PHOTOS} photos per entry — kept the first ${MAX_PHOTOS - draft.photos.length}.`,
        )
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      event.target.value = ''
    }
  }

  async function save() {
    const transcript = draft.transcript.trim()
    if (!transcript) {
      setError('Write or speak something before saving.')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      title: draft.title.trim() || 'Untitled memory',
      entryDate: draft.entryDate || todayISO(),
      language: draft.language,
      transcript,
      photos: draft.photos,
    }

    try {
      let id = draft.id
      if (isEditing) {
        await updateEntry(id, payload)
      } else {
        const now = new Date().toISOString()
        id = await addEntry({ ...payload, createdAt: now, updatedAt: now })
        navigator.storage?.persist?.()
      }
      dispatch({ type: 'reset' })
      toast('Memory saved', 'success')
      navigate(`/entry/${id}`, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function discard() {
    if (draft.transcript.trim() || draft.title.trim() || draft.photos.length) {
      setConfirmDiscard(true)
    } else {
      dispatch({ type: 'reset' })
      navigate('/')
    }
  }

  return (
    <div>
      <h1 className="page-title">
        {isEditing ? 'Edit memory' : 'Review your memory'}
      </h1>

      <div className="field">
        <label htmlFor="review-title">Title</label>
        <input
          id="review-title"
          type="text"
          value={draft.title}
          placeholder="Untitled memory"
          onChange={(e) => dispatch({ type: 'set', patch: { title: e.target.value } })}
        />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="review-date">Date</label>
          <input
            id="review-date"
            type="date"
            value={draft.entryDate}
            onChange={(e) =>
              dispatch({ type: 'set', patch: { entryDate: e.target.value } })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="review-lang">Language</label>
          <select
            id="review-lang"
            value={draft.language}
            onChange={(e) =>
              dispatch({ type: 'set', patch: { language: e.target.value } })
            }
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="review-text">Your words</label>
        <textarea
          id="review-text"
          value={draft.transcript}
          placeholder="What happened today?"
          onChange={(e) =>
            dispatch({ type: 'set', patch: { transcript: e.target.value } })
          }
        />
      </div>

      <div className="field">
        <label>Photos (up to {MAX_PHOTOS})</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onPickPhotos}
        />
        <div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={draft.photos.length >= MAX_PHOTOS}
          >
            Add photos
          </button>
        </div>
        {draft.photos.length > 0 && (
          <div className="photo-edit-grid">
            {draft.photos.map((p, i) => (
              <div key={i} className="photo-edit-item">
                <img src={photoUrls[i]} alt={p.name || `Photo ${i + 1}`} />
                <button
                  type="button"
                  className="photo-remove"
                  onClick={() => dispatch({ type: 'removePhoto', index: i })}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={discard}>
          Discard
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this memory?"
        message="Your transcript and photos will be thrown away."
        confirmLabel="Discard"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false)
          dispatch({ type: 'reset' })
          navigate('/')
        }}
      />
    </div>
  )
}
