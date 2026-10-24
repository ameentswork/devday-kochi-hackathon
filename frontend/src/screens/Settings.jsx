import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import {
  getDefaultLanguage,
  LANGUAGES,
  setDefaultLanguage,
  speechSupported,
} from '../lib/speech'
import { clearAll } from '../lib/db'
import { seedDemoEntries } from '../lib/demo'
import { exportJSON, exportText } from '../lib/export'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Settings() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const [lang, setLang] = useState(getDefaultLanguage)
  const [users, setUsers] = useState(null)
  const [usersError, setUsersError] = useState('')

  useEffect(() => {
    if (user?.role !== 'admin') return
    let alive = true
    api('/api/admin/users')
      .then((d) => alive && setUsers(d.users))
      .catch((err) => alive && setUsersError(err.message))
    return () => {
      alive = false
    }
  }, [user?.role])
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)

  async function addDemo() {
    setSeeding(true)
    try {
      await seedDemoEntries()
      toast('Demo entries added — see Memories', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSeeding(false)
    }
  }

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
        <h2>Account</h2>
        <div className="detail-meta" style={{ margin: 0 }}>
          <strong>{user?.name}</strong>
          <span>{user?.email}</span>
          <span className="chip">{user?.role}</span>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Your diary stays in this browser — signing in only unlocks the app on
          this device.
        </p>
      </section>

      {user?.role === 'admin' && (
        <section className="settings-section">
          <h2>Members</h2>
          {usersError && <p className="inline-error">{usersError}</p>}
          {!users && !usersError && <p className="muted">Loading…</p>}
          {users && (
            <ul className="user-list">
              {users.map((u) => (
                <li key={u.id} className="user-row card">
                  <div>
                    <strong>{u.name}</strong>
                    <span className="muted"> · {u.email}</span>
                  </div>
                  <div className="detail-meta" style={{ margin: 0 }}>
                    <span className="chip">{u.role}</span>
                    <span className="muted">
                      {formatDate(u.createdAt?.slice(0, 10))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
          Your entries and photos stay in this browser on this device — each
          account gets its own IndexedDB store. They are not uploaded, synced,
          or visible to admins.
        </p>
        <p>
          Honest limits: IndexedDB is per-browser and per-device (no automatic
          sync to your phone or other computers), and it is{' '}
          <strong>not</strong> encrypted storage — anyone with access to this
          browser profile could read it. Use export for backups.
        </p>
        <p>
          Dictation uses Chrome&rsquo;s speech recognition, which sends audio to
          a cloud service and needs an internet connection. Typing works
          offline.
        </p>
      </section>

      <section className="settings-section">
        <h2>Export</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Download your whole diary — photos are embedded as base64 in JSON.
        </p>
        <div className="detail-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              try {
                const n = await exportJSON()
                toast(`Exported ${n} ${n === 1 ? 'entry' : 'entries'} as JSON`, 'success')
              } catch (err) {
                toast(err.message, 'error')
              }
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              try {
                const n = await exportText()
                toast(`Exported ${n} ${n === 1 ? 'entry' : 'entries'} as text`, 'success')
              } catch (err) {
                toast(err.message, 'error')
              }
            }}
          >
            Export text
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>About</h2>
        <p className="muted">
          Voice Diary — Your Day, Your Words. A private, local-first journal.
        </p>
      </section>

      <section className="settings-section">
        <h2>Data</h2>
        <div className="detail-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={addDemo}
            disabled={seeding}
          >
            {seeding ? 'Adding…' : 'Add demo entries'}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirmClear(true)}
          >
            Delete all data
          </button>
        </div>
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
