import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MicButton from '../components/MicButton'
import {
  createSpeechSession,
  getDefaultLanguage,
  LANGUAGES,
  languageLabel,
  MAX_RECORDING_SECONDS,
  SPEECH_FALLBACK_LANG,
  speechSupported,
} from '../lib/speech'
import { formatDuration } from '../lib/format'
import { useDraft } from '../state/DraftContext'

const WARN_AT_SECONDS = MAX_RECORDING_SECONDS - 10

export default function Capture() {
  const navigate = useNavigate()
  const { dispatch } = useDraft()

  const [lang, setLang] = useState(getDefaultLanguage)
  const [listening, setListening] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const sessionRef = useRef(null)
  const finalRef = useRef('')
  const interimRef = useRef('')
  const elapsedRef = useRef(0)
  const timerRef = useRef(null)
  const fallbackPending = useRef(false)

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

  function tick() {
    elapsedRef.current += 1
    setElapsed(elapsedRef.current)
    if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
      setNotice(
        'Take stopped at 60 seconds — your words are kept below. ' +
          'Start another take to add more, or continue to review.',
      )
      sessionRef.current?.stop()
    }
  }

  function start(langOverride = null, { keepNotice = false } = {}) {
    setError('')
    if (!keepNotice) setNotice('')
    setInterim('')
    interimRef.current = ''

    const sessionLang = langOverride || lang

    const session = createSpeechSession({
      lang: sessionLang,
      seedText: finalRef.current,
      onStart: () => {
        setListening(true)
        elapsedRef.current = 0
        setElapsed(0)
        stopTimer()
        timerRef.current = setInterval(tick, 1000)
      },
      onResult: (final, currentInterim) => {
        finalRef.current = final
        interimRef.current = currentInterim
        setFinalText(final)
        setInterim(currentInterim)
      },
      onError: (code, message) => {
        if (
          code === 'language-not-supported' &&
          sessionLang !== SPEECH_FALLBACK_LANG
        ) {
          fallbackPending.current = true
          setNotice(
            `${languageLabel(sessionLang)} isn't supported here — continuing in English.`,
          )
        } else {
          setError(message)
        }
      },
      onEnd: () => {
        stopTimer()
        finalRef.current = (finalRef.current + interimRef.current).trimEnd()
        interimRef.current = ''
        setFinalText(finalRef.current)
        setInterim('')
        if (fallbackPending.current) {
          fallbackPending.current = false
          setLang(SPEECH_FALLBACK_LANG)
          start(SPEECH_FALLBACK_LANG, { keepNotice: true })
          return
        }
        setListening(false)
      },
    })
    if (!session) return
    sessionRef.current = session
    session.start()
  }

  function stop() {
    sessionRef.current?.stop()
  }

  function continueToReview() {
    dispatch({
      type: 'new',
      patch: { transcript: finalRef.current.trim(), language: lang },
    })
    navigate('/review')
  }

  function typeInstead() {
    dispatch({ type: 'new', patch: { transcript: '', language: lang } })
    navigate('/review')
  }

  const remaining = Math.max(0, MAX_RECORDING_SECONDS - elapsed)
  const warning = listening && elapsed >= WARN_AT_SECONDS
  const hasTranscript = Boolean(finalText.trim())

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
            {listening
              ? 'Listening… tap to stop'
              : hasTranscript
                ? 'Tap the mic for another take'
                : 'Tap the mic and start speaking'}
          </p>
          <p
            className={`timer${warning ? ' timer-warn' : ''}`}
            aria-live={warning ? 'assertive' : 'off'}
          >
            {listening ? `${formatDuration(remaining)} left` : ''}
          </p>
          {warning && (
            <p className="inline-error" role="alert" style={{ margin: 0 }}>
              Recording stops in {remaining}s
            </p>
          )}
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

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}

      {hasTranscript && !listening && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={continueToReview}
        >
          Continue to review
        </button>
      )}
      <button type="button" className="linklike" onClick={typeInstead}>
        Type instead
      </button>
    </div>
  )
}
