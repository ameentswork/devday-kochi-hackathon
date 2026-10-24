import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEntries } from '../lib/db'
import EntryCard from '../components/EntryCard'
import EmptyState from '../components/EmptyState'

export default function Memories() {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    listEntries()
      .then((all) => alive && setEntries(all))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div>
      <h1 className="page-title">Memories</h1>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {entries === null && !error && <p className="muted">Loading…</p>}
      {entries?.length === 0 && (
        <EmptyState
          title="Nothing saved yet"
          message="Your saved memories will live here."
        >
          <Link to="/capture" className="btn btn-primary">
            Capture today&rsquo;s memory
          </Link>
        </EmptyState>
      )}
      {entries?.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
    </div>
  )
}
