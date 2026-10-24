import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MicButton from '../components/MicButton'
import AudioVisualizer from '../components/AudioVisualizer'
import LiveEmojis from '../components/LiveEmojis'
import { useToast } from '../components/Toast'
import {
  createSpeechSession,
  getDefaultLanguage,
  getLanguage,
  getLanguageShort,
  isRTL,
  LANGUAGES,
  languageLabel,
  MAX_RECORDING_SECONDS,
  setDefaultLanguage,
  SPEECH_FALLBACK_LANG,
  speechSupported,
} from '../lib/speech'
import { formatDuration } from '../lib/format'
import { useDraft } from '../state/DraftContext'
import { useAuth } from '../state/AuthContext'

const WARN_AT_SECONDS = MAX_RECORDING_SECONDS - 10

// Featured quick-switch languages for one-tap convenience
const POPULAR_LANGUAGES = ['en-IN', 'ml-IN', 'hi-IN', 'ta-IN', 'ur-IN', 'en-US']

export default function Capture() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { dispatch } = useDraft()
  const toast = useToast()

  const [lang, setLang] = useState(() => getDefaultLanguage(user?.id))
  const [listening, setListening] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [mood, setMood] = useState('')

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

  const [prevUserId, setPrevUserId] = useState(user?.id)
  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id)
    setLang(getDefaultLanguage(user?.id))
    finalRef.current = ''
    interimRef.current = ''
    setFinalText('')
    setInterim('')
    setError('')
    setNotice('')
  }

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

  function handleLanguageChange(newLang) {
    setLang(newLang)
    setDefaultLanguage(newLang, user?.id)
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
            `${languageLabel(sessionLang)} speech is not supported on this browser — continuing in English.`,
          )
        } else {
          setError(message)
        }
      },
      onEnd: () => {
        stopTimer()
        const combined = interimRef.current
          ? `${finalRef.current} ${interimRef.current}`.trim()
          : finalRef.current.trim()
        finalRef.current = combined
        interimRef.current = ''
        setFinalText(combined)
        setInterim('')

        if (fallbackPending.current) {
          fallbackPending.current = false
          handleLanguageChange(SPEECH_FALLBACK_LANG)
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
      uid: user?.id,
      patch: { transcript: finalRef.current.trim(), language: lang, mood },
    })
    navigate('/review')
  }

  function typeInstead() {
    dispatch({
      type: 'new',
      uid: user?.id,
      patch: { transcript: '', language: lang, mood },
    })
    navigate('/review')
  }

  function clearTranscript() {
    finalRef.current = ''
    interimRef.current = ''
    setFinalText('')
    setInterim('')
    setError('')
    setNotice('')
  }

  async function copyTranscript() {
    const full = (finalText + (interim ? ' ' + interim : '')).trim()
    if (!full) return
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      toast('Transcript copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Failed to copy', 'error')
    }
  }

  const remaining = Math.max(0, MAX_RECORDING_SECONDS - elapsed)
  const warning = listening && elapsed >= WARN_AT_SECONDS
  const currentTranscript = (finalText + (interim ? ' ' + interim : '')).trim()
  const hasTranscript = Boolean(currentTranscript)

  // Compute word count
  const wordCount = currentTranscript
    ? currentTranscript.split(/\s+/).filter(Boolean).length
    : 0

  const langObj = getLanguage(lang)
  const rtlDirection = isRTL(lang) ? 'rtl' : 'ltr'

  const userInitial = user?.name ? user.name.trim()[0].toUpperCase() : '👤'
  const userDisplayName = user?.name ? user.name.split(' ')[0] : 'My'

  return (
    <div className="capture">
      <div className="capture-header-badge">
        <div className="capture-user-pill">
          <span className="user-avatar-dot" aria-hidden="true">
            {userInitial}
          </span>
          <span className="user-name-text">
            {user?.name ? `${userDisplayName}’s Journal` : 'Personal Journal'}
          </span>
          <span className="privacy-badge" title="Local to your device only">
            🔒 Private
          </span>
        </div>
      </div>

      <h1 className="page-title">Capture today&rsquo;s memory</h1>

      {!speechSupported && (
        <p className="notice" role="status">
          Speech recognition isn&rsquo;t available in this browser, but you can
          still type your entry.
        </p>
      )}

      {speechSupported && (
        <>
          <div className="capture-lang-container">
            <div className="field" style={{ maxWidth: 300, margin: '0 auto' }}>
              <label htmlFor="capture-lang">Speaking in</label>
              <select
                id="capture-lang"
                value={lang}
                onChange={(e) => handleLanguageChange(e.target.value)}
                disabled={listening}
                className="capture-lang-select"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick-switch pills for fast language switching */}
            <div className="lang-pills" role="radiogroup" aria-label="Quick language switch">
              {POPULAR_LANGUAGES.map((code) => {
                const isActive = lang === code
                return (
                  <button
                    key={code}
                    type="button"
                    className={`lang-pill${isActive ? ' active' : ''}`}
                    onClick={() => handleLanguageChange(code)}
                    disabled={listening}
                    aria-checked={isActive}
                  >
                    {getLanguageShort(code)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mic-container">
            <MicButton
              listening={listening}
              onClick={listening ? stop : start}
              aria-describedby="mic-hint"
            />
            {/* Live visualizer bar feedback */}
            <AudioVisualizer listening={listening} />
          </div>

          <p id="mic-hint" className="muted" style={{ margin: 0 }}>
            {listening
              ? `Listening in ${langObj.native || langObj.label}… tap to stop`
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

          {/* Live custom emojis with real-time mood reaction & floating burst particles */}
          <LiveEmojis
            selectedMood={mood}
            onSelectMood={setMood}
            liveText={finalText + ' ' + interim}
            active={listening || hasTranscript}
          />
        </>
      )}

      {/* Live transcript area with metadata header and tools */}
      <div className="transcript-wrapper">
        <div className="transcript-header">
          <div className="transcript-badge">
            {mood && <span className="live-mood-tag" title="Entry mood">{mood}</span>}
            <span className="lang-indicator" title={langObj.label}>
              🗣️ {langObj.native || langObj.label}
            </span>
            {wordCount > 0 && (
              <span className="word-count-badge">
                · {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
            )}
          </div>

          {hasTranscript && !listening && (
            <div className="transcript-actions">
              <button
                type="button"
                className="btn-transcript-tool"
                onClick={copyTranscript}
                title="Copy transcript"
                aria-label="Copy transcript"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className="btn-transcript-tool btn-transcript-clear"
                onClick={clearTranscript}
                title="Clear transcript"
                aria-label="Clear transcript"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div
          className="transcript-box"
          aria-live="polite"
          dir={rtlDirection}
        >
          {finalText || interim ? (
            <>
              {finalText}
              {interim && (
                <span className="transcript-interim">
                  {finalText ? ' ' : ''}
                  {interim}
                </span>
              )}
            </>
          ) : (
            <span className="placeholder">
              {listening
                ? `Listening in ${langObj.native || langObj.label}… speak your day`
                : 'Your transcript will appear here.'}
            </span>
          )}
        </div>
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
