import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDuration } from '../lib/format'

export default function AudioPlayer({
  audio,
  title = 'Voice memory',
  onRemove = null,
  showDownload = true,
}) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(() => audio?.duration || 0)

  const audioRef = useRef(null)

  // Manage Blob URL lifecycle safely via useMemo and cleanup
  const audioBlob = audio?.blob
  const audioUrl = useMemo(() => {
    if (!audioBlob) return ''
    return URL.createObjectURL(audioBlob)
  }, [audioBlob])

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  // Sync duration when metadata loads
  const handleLoadedMetadata = () => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setDuration(Math.round(audioRef.current.duration))
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleEnded = () => {
    setPlaying(false)
    setCurrentTime(0)
    if (audioRef.current) {
      audioRef.current.currentTime = 0
    }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
    }
  }

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const handleDownload = () => {
    if (!audioUrl) return
    const a = document.createElement('a')
    a.href = audioUrl
    const ext = audio?.type?.includes('ogg')
      ? 'ogg'
      : audio?.type?.includes('mp4')
        ? 'm4a'
        : 'webm'
    a.download = `voice-memory-${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (!audio?.blob && !audioUrl) return null

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="audio-player-card">
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />

      <div className="audio-player-header">
        <div className="audio-player-title">
          <span className="audio-icon-badge" aria-hidden="true">
            🎙️
          </span>
          <span className="audio-title-text">{title}</span>
        </div>

        <div className="audio-player-tools">
          {showDownload && (
            <button
              type="button"
              className="btn-audio-tool"
              onClick={handleDownload}
              title="Download original voice recording"
              aria-label="Download voice memo"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="btn-audio-tool btn-audio-remove"
              onClick={onRemove}
              title="Remove voice memo"
              aria-label="Remove voice memo"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="audio-player-controls">
        <button
          type="button"
          className={`btn-play-pause${playing ? ' playing' : ''}`}
          onClick={togglePlay}
          aria-label={playing ? 'Pause voice memory' : 'Play voice memory'}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ marginLeft: 2 }}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        <div className="audio-timeline">
          <input
            type="range"
            min="0"
            max={duration || 60}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="audio-seek-slider"
            style={{ '--progress': `${progressPercent}%` }}
            aria-label="Audio scrubber"
          />
          <div className="audio-time-row">
            <span className="audio-time-current">
              {formatDuration(Math.floor(currentTime))}
            </span>
            <span className="audio-time-total">
              {formatDuration(Math.max(1, duration))}
            </span>
          </div>
        </div>

        {/* Live waveform animation bars when playing */}
        <div className={`audio-mini-visualizer${playing ? ' active' : ''}`} aria-hidden="true">
          <span className="wave-bar bar-1" />
          <span className="wave-bar bar-2" />
          <span className="wave-bar bar-3" />
          <span className="wave-bar bar-4" />
        </div>
      </div>
    </div>
  )
}
