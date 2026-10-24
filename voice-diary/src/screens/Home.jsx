import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEntries } from '../lib/db'
import { formatDate, todayISO } from '../lib/format'
import EntryCard from '../components/EntryCard'
import EmptyState from '../components/EmptyState'

export default function Home() {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    listEntries()
      .then((all) => alive && setEntries(all.slice(0, 3)))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div>
      <div className="home-hero">
        <h1>Voice Diary</h1>
        <p className="page-date">{formatDate(todayISO())}</p>
      </div>

      <Link to="/capture" className="btn btn-primary btn-big btn-block">
        Capture today&rsquo;s memory
      </Link>

      <div style={{ height: '2rem' }} />

      <h2 className="section-heading">Recent memories</h2>
      {error && <p className="inline-error">{error}</p>}
      {entries === null && !error && <p className="muted">Loading…</p>}
      {entries?.length === 0 && (
        <EmptyState
          title="No memories yet"
          message="Speak about your day and it will appear here."
        />
      )}
      {entries?.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
    </div>
  )
}
