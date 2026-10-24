import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { formatDate } from '../lib/format'

export default function AdminMembers() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null) // {user, status}
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const d = await api('/api/admin/users')
      setUsers(d.users)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    let alive = true
    api('/api/admin/users')
      .then((d) => alive && setUsers(d.users))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [])

  async function applyStatus() {
    setBusy(true)
    try {
      await api(`/api/admin/users/${pending.user.id}/status`, {
        method: 'PATCH',
        body: { status: pending.status },
      })
      toast(
        pending.status === 'deactivated'
          ? `${pending.user.name} deactivated`
          : `${pending.user.name} reactivated`,
        'success',
      )
      setPending(null)
      await load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const members = users?.filter((u) => u.role === 'member') || []

  return (
    <div>
      <h1 className="page-title">Members</h1>

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {!users && !error && (
        <>
          <div className="card skeleton-card" aria-hidden="true" />
          <div className="card skeleton-card" aria-hidden="true" />
        </>
      )}
      {users && members.length === 0 && (
        <EmptyState
          title="No members yet"
          message="Accounts that sign up will appear here."
        />
      )}

      {members.length > 0 && (
        <ul className="user-list">
          {members.map((u) => (
            <li key={u.id} className="user-row card">
              <div>
                <strong>{u.name}</strong>
                {u.demo && <span className="chip chip-ai">demo</span>}
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {u.email}
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  Joined {formatDate(u.createdAt?.slice(0, 10))}
                  {typeof u.entryCount === 'number' &&
                    ` · ${u.entryCount} ${u.entryCount === 1 ? 'entry' : 'entries'}`}
                </div>
              </div>
              <div className="member-actions">
                <span
                  className={`chip ${u.status === 'deactivated' ? 'chip-off' : 'chip-on'}`}
                >
                  {u.status === 'deactivated' ? 'deactivated' : 'active'}
                </span>
                {u.id !== me?.id && (
                  <button
                    type="button"
                    className={`btn ${u.status === 'deactivated' ? 'btn-ghost' : 'btn-danger'}`}
                    onClick={() =>
                      setPending({
                        user: u,
                        status:
                          u.status === 'deactivated' ? 'active' : 'deactivated',
                      })
                    }
                  >
                    {u.status === 'deactivated' ? 'Reactivate' : 'Deactivate'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.status === 'deactivated'
            ? `Deactivate ${pending?.user.name}?`
            : `Reactivate ${pending?.user.name}?`
        }
        message={
          pending?.status === 'deactivated'
            ? 'They will be signed out immediately and cannot sign in until reactivated. Their diary data stays on their own device.'
            : 'They will be able to sign in again.'
        }
        confirmLabel={busy ? 'Working…' : 'Confirm'}
        onCancel={() => setPending(null)}
        onConfirm={applyStatus}
      />
    </div>
  )
}
