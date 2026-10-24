import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MicButton from '../components/MicButton'
import {
  createSpeechSession,
  getDefaultLanguage,
  LANGUAGES,
  speechSupported,
} from '../lib/speech'
import { formatDuration } from '../lib/format'
import { useDraft } from '../state/DraftContext'

export default function Capture() {
  const navigate = useNavigate()
  const { dispatch } = useDraft()

  const [lang, setLang] = useState(getDefaultLanguage)
  const [listening, setListening] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')

  const sessionRef = useRef(null)
  const finalRef = useRef('')
  const interimRef = useRef('')
  const pendingStop = useRef(false)
  const timerRef = useRef(null)

  const stopTimer = () => {
    clearInterval(timerRef.current)
    timerRef.current = null
  }

  useEffect(
    () => () => {
      sessionRef.current?.stop()
      stopTimer()
    },
    [],
  )

  function start() {
    setError('')
    finalRef.current = ''
    interimRef.current = ''
    setFinalText('')
    setInterim('')

    const session = createSpeechSession({
      lang,
      onStart: () => {
        setListening(true)
        setElapsed(0)
        stopTimer()
        timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
      },
      onResult: (final, currentInterim) => {
        finalRef.current = final
        interimRef.current = currentInterim
        setFinalText(final)
        setInterim(currentInterim)
      },
      onError: (code, message) => setError(message),
      onEnd: () => {
        stopTimer()
        setListening(false)
        if (pendingStop.current) {
          pendingStop.current = false
          const transcript = (finalRef.current + interimRef.current).trim()
          dispatch({ type: 'new', patch: { transcript, language: lang } })
          navigate('/review')
        }
      },
    })
    if (!session) return
    sessionRef.current = session
    session.start()
  }

  function stop() {
    pendingStop.current = true
    sessionRef.current?.stop()
  }

  function typeInstead() {
    dispatch({ type: 'new', patch: { transcript: '', language: lang } })
    navigate('/review')
  }

  return (
    <div className="capture">
      <h1 className="page-title">Capture today&rsquo;s memory</h1>

      {!speechSupported && (
        <p className="notice" role="status">
          Speech recognition isn&rsquo;t available in this browser, but you can
          still type your entry.
        </p>
      )}

      {speechSupported && (
        <>
          <div className="field" style={{ maxWidth: 280 }}>
            <label htmlFor="capture-lang">Speaking in</label>
            <select
              id="capture-lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={listening}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <MicButton
            listening={listening}
            onClick={listening ? stop : start}
            aria-describedby="mic-hint"
          />
          <p id="mic-hint" className="muted" style={{ margin: 0 }}>
            {listening ? 'Listening… tap to stop' : 'Tap the mic and start speaking'}
          </p>
          <p className="timer" aria-live="off">
            {listening ? formatDuration(elapsed) : ''}
          </p>
        </>
      )}

      <div className="transcript-box" aria-live="polite">
        {finalText || interim ? (
          <>
            {finalText}
            <span className="transcript-interim">{interim}</span>
          </>
        ) : (
          <span className="placeholder">
            {listening
              ? 'Your words will appear here…'
              : 'Your transcript will appear here.'}
          </span>
        )}
      </div>

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="linklike" onClick={typeInstead}>
        Type instead
      </button>
    </div>
  )
}
