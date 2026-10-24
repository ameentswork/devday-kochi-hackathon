import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'

export default function Auth() {
  const navigate = useNavigate()
  const { login, signup, demoLogin } = useAuth()
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isSignup = mode === 'signup'

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (isSignup && password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      const u = isSignup ? await signup(name.trim(), email, password) : await login(email, password)
      if (u?.role === 'member') {
        navigate('/capture')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function demo(role) {
    setError('')
    setBusy(true)
    try {
      const u = await demoLogin(role)
      if (u?.role === 'member') {
        navigate('/capture')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="auth-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="17" x2="12" y2="22" />
          </svg>
        </div>
        <h1 className="auth-brand">Voice Diary</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Your Day, Your Words
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={`auth-tab${!isSignup ? ' active' : ''}`}
            onClick={() => {
              setMode('signin')
              setError('')
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={`auth-tab${isSignup ? ' active' : ''}`}
            onClick={() => {
              setMode('signup')
              setError('')
            }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={submit}>
          {isSignup && (
            <div className="field">
              <label htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Password</label>
            <input
              id="auth-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </div>
          {isSignup && (
            <div className="field">
              <label htmlFor="auth-confirm">Confirm password</label>
              <input
                id="auth-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
          )}

          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={busy}
          >
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {isSignup && (
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
            New accounts are members. The very first account becomes the admin.
          </p>
        )}

        <div className="auth-divider">
          <span>or continue as</span>
        </div>
        <div className="demo-logins">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => demo('admin')}
            disabled={busy}
          >
            Admin demo
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => demo('member')}
            disabled={busy}
          >
            Member demo
          </button>
        </div>
      </div>
    </div>
  )
}
