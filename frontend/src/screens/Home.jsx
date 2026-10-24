import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEntries } from '../lib/db'
import { seedDemoEntries } from '../lib/demo'
import { formatDate, todayISO } from '../lib/format'
import EntryCard from '../components/EntryCard'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useAuth } from '../state/AuthContext'

export default function Home() {
  const { user } = useAuth()
  const toast = useToast()
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    let alive = true
    listEntries()
      .then((all) => alive && setEntries(all.slice(0, 3)))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [])

  async function addDemo() {
    setSeeding(true)
    try {
      await seedDemoEntries()
      setEntries((await listEntries()).slice(0, 3))
      toast('Demo entries added', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div>
      <div className="hero">
        <p className="hero-kicker">Your Day, Your Words</p>
        <h1>Welcome back, {user?.name?.split(' ')[0] || 'friend'}</h1>
        <p className="page-date">{formatDate(todayISO())}</p>
        <Link to="/capture" className="btn btn-hero btn-big">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="17" x2="12" y2="22" />
          </svg>
          Capture today&rsquo;s memory
        </Link>
      </div>

      <h2 className="section-heading">Recent memories</h2>
      {error && <p className="inline-error">{error}</p>}
      {entries === null && !error && (
        <>
          <div className="card skeleton-card" aria-hidden="true" />
          <div className="card skeleton-card" aria-hidden="true" />
        </>
      )}
      {entries?.length === 0 && (
        <EmptyState
          title="No memories yet"
          message="Speak about your day and it will appear here."
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={addDemo}
            disabled={seeding}
          >
            {seeding ? 'Adding…' : 'Add demo entries'}
          </button>
        </EmptyState>
      )}
      {entries?.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
    </div>
  )
}
