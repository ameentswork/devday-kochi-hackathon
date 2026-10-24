import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEntries } from '../lib/db'
import EntryCard from '../components/EntryCard'
import EmptyState from '../components/EmptyState'

export default function Memories() {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [date, setDate] = useState('')

  const filtered = entries?.filter((e) => {
    const matchesQuery =
      !query ||
      `${e.title} ${e.transcript}`.toLowerCase().includes(query.toLowerCase())
    const matchesDate = !date || e.entryDate === date
    return matchesQuery && matchesDate
  })

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
      {entries === null && !error && (
        <>
          <div className="card skeleton-card" aria-hidden="true" />
          <div className="card skeleton-card" aria-hidden="true" />
          <div className="card skeleton-card" aria-hidden="true" />
        </>
      )}
      {entries?.length > 0 && (
        <div className="filter-bar">
          <input
            type="search"
            placeholder="Search memories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search memories"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Filter by date"
          />
          {(query || date) && (
            <button
              type="button"
              className="linklike"
              onClick={() => {
                setQuery('')
                setDate('')
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

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
      {filtered?.length === 0 && entries?.length > 0 && (
        <EmptyState
          title="No matches"
          message="Try a different search or date."
        />
      )}
      {filtered?.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
    </div>
  )
}
