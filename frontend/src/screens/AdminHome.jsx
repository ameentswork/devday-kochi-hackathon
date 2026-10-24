import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../state/AuthContext'

export default function AdminHome() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([api('/api/admin/stats'), api('/api/admin/health')])
      .then(([s, h]) => alive && (setStats(s), setHealth(h)))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div>
      <div className="hero">
        <p className="hero-kicker">Admin dashboard</p>
        <h1>Welcome, {user?.name}</h1>
        <p className="page-date">Application overview — no diary content is ever shown here.</p>
        <Link to="/admin/members" className="btn btn-hero btn-big">
          Manage members
        </Link>
      </div>

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}

      <h2 className="section-heading">Statistics</h2>
      {!stats && !error && (
        <div className="stats-grid">
          <div className="card skeleton-card" aria-hidden="true" />
          <div className="card skeleton-card" aria-hidden="true" />
          <div className="card skeleton-card" aria-hidden="true" />
        </div>
      )}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card card">
            <span className="stat-value">{stats.totalMembers}</span>
            <span className="stat-label">Registered members</span>
          </div>
          <div className="stat-card card">
            <span className="stat-value">{stats.activeMembers}</span>
            <span className="stat-label">Active members</span>
          </div>
          <div className="stat-card card">
            <span className="stat-value">{stats.deactivatedMembers}</span>
            <span className="stat-label">Deactivated</span>
          </div>
          <div className="stat-card card">
            <span className="stat-value">{stats.totalEntries}</span>
            <span className="stat-label">Diary entries (reported)</span>
          </div>
        </div>
      )}

      <h2 className="section-heading" style={{ marginTop: '1.75rem' }}>
        Service health
      </h2>
      {!health && !error && (
        <div className="card skeleton-card" aria-hidden="true" />
      )}
      {health && (
        <div className="card health-card">
          <div className="health-row">
            <span>Status</span>
            <span className="chip">{health.status}</span>
          </div>
          <div className="health-row">
            <span>Started</span>
            <span>{new Date(health.startedAt).toLocaleString()}</span>
          </div>
          <div className="health-row">
            <span>Uptime</span>
            <span>{Math.floor(health.uptimeSeconds / 60)} min</span>
          </div>
          <div className="health-row">
            <span>Node</span>
            <span>{health.node}</span>
          </div>
          <div className="health-row">
            <span>Memory</span>
            <span>{health.memoryMB} MB</span>
          </div>
          <div className="health-row">
            <span>Active sessions</span>
            <span>{health.activeSessions}</span>
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: '0.85rem', marginTop: '1.25rem' }}>
        Diary entries stay inside each member's browser (IndexedDB). The count
        above is a self-reported number only — titles, transcripts and photos
        are never sent to this dashboard.
      </p>
    </div>
  )
}
