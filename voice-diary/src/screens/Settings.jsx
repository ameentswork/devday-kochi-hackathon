import { useState } from 'react'
import {
  getDefaultLanguage,
  LANGUAGES,
  setDefaultLanguage,
  speechSupported,
} from '../lib/speech'
import { clearAll } from '../lib/db'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Settings() {
  const toast = useToast()
  const [lang, setLang] = useState(getDefaultLanguage)
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false)

  function onLangChange(e) {
    setLang(e.target.value)
    setDefaultLanguage(e.target.value)
    toast('Default language saved', 'success')
  }

  async function doClear() {
    setBusy(true)
    try {
      await clearAll()
      setConfirmClear(false)
      toast('All data deleted', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>

      <section className="settings-section">
        <h2>Dictation</h2>
        <div className="field">
          <label htmlFor="default-lang">Default language</label>
          <select id="default-lang" value={lang} onChange={onLangChange}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        {!speechSupported && (
          <p className="notice">
            Speech recognition isn&rsquo;t available in this browser. Typed
            entries still work.
          </p>
        )}
      </section>

      <section className="settings-section">
        <h2>Privacy</h2>
        <p>
          Your entries and photos stay in this browser on this device. They are
          not uploaded or synced anywhere.
        </p>
        <p>
          Dictation uses Chrome&rsquo;s speech recognition, which sends audio to
          a cloud service and needs an internet connection. Typing works
          offline.
        </p>
      </section>

      <section className="settings-section">
        <h2>About</h2>
        <p className="muted">
          Voice Diary — Your Day, Your Words. A private, local-first journal.
        </p>
      </section>

      <section className="settings-section">
        <h2>Data</h2>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setConfirmClear(true)}
        >
          Delete all data
        </button>
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="Delete all data?"
        message="Every entry and photo in this browser will be permanently removed."
        confirmLabel={busy ? 'Deleting…' : 'Delete everything'}
        onCancel={() => setConfirmClear(false)}
        onConfirm={doClear}
      />
    </div>
  )
}
