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
  MAX_RECORDING_SECONDS,
  setDefaultLanguage,
  speechSupported,
} from '../lib/speech'
import { formatDuration } from '../lib/format'
import { useDraft } from '../state/DraftContext'
import { useAuth } from '../state/AuthContext'
import { audioRecordingSupported, startAudioRecording } from '../lib/audioRecorder'
import { createDemoAudioBlob } from '../lib/demo'
import { transcribeAudioBlob } from '../lib/cloud'
import AudioPlayer from '../components/AudioPlayer'

const WARN_AT_SECONDS = MAX_RECORDING_SECONDS - 10

// Featured quick-switch languages for one-tap convenience
const POPULAR_LANGUAGES = ['ml-IN', 'en-US', 'hi-IN', 'ta-IN', 'ur-IN', 'en-IN']

export default function Capture() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { dispatch } = useDraft()
  const toast = useToast()

  const [lang, setLang] = useState(() => getDefaultLanguage(user?.id))
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [isEditingText, setIsEditingText] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [mood, setMood] = useState('')
  const [audioMemo, setAudioMemo] = useState(null)

  const sessionRef = useRef(null)
  const audioRecorderRef = useRef(null)
  const finalRef = useRef('')
  const interimRef = useRef('')
  const elapsedRef = useRef(0)
  const timerRef = useRef(null)

  const stopTimer = () => {
    clearInterval(timerRef.current)
    timerRef.current = null
  }

  useEffect(
    () => () => {
      sessionRef.current?.stop()
      audioRecorderRef.current?.cancel()
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
    setAudioMemo(null)
  }

  function tick() {
    elapsedRef.current += 1
    setElapsed(elapsedRef.current)
    if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
      setNotice(
        'Recording reached 60 seconds — your words and voice recording are saved below. ' +
          'Tap Continue to review or start another take.',
      )
      stop()
    }
  }

  function handleLanguageChange(newLang) {
    if (listening) {
      stop()
    }
    setError('')
    setLang(newLang)
    setDefaultLanguage(newLang, user?.id)
  }

  /**
   * Transcribe recorded audio Blob using Cloudflare Workers AI Whisper
   */
  async function transcribeVoiceMemo(blob = null) {
    const targetBlob = blob || audioMemo?.blob
    if (!targetBlob) {
      toast('No voice audio available to transcribe', 'info')
      return
    }

    setTranscribing(true)
    setError('')
    setNotice('Transcribing your voice with AI Whisper…')

    try {
      const text = await transcribeAudioBlob(targetBlob, lang)
      if (text && text.trim()) {
        const combined = finalRef.current
          ? `${finalRef.current} ${text.trim()}`.trim()
          : text.trim()
        finalRef.current = combined
        setFinalText(combined)
        setNotice('')
        toast('Voice transcribed to text!', 'success')
      } else {
        setNotice('Voice memo captured! Tap Continue to review or type your thoughts.')
      }
    } catch (err) {
      console.warn('Transcription error:', err)
      setError('Could not transcribe audio: ' + (err.message || err))
    } finally {
      setTranscribing(false)
    }
  }

  /**
   * Start recording voice audio with MediaRecorder and concurrent Web Speech recognition
   */
  async function start() {
    setError('')
    setNotice('')
    setInterim('')
    interimRef.current = ''

    if (sessionRef.current) {
      sessionRef.current.stop()
      sessionRef.current = null
    }

    const sessionLang = lang

    // 1. Start audio recording to preserve original voice audio
    if (audioRecordingSupported) {
      try {
        const recorder = await startAudioRecording()
        audioRecorderRef.current = recorder
      } catch (err) {
        console.warn('Microphone audio capture warning:', err)
      }
    }

    setListening(true)
    elapsedRef.current = 0
    setElapsed(0)
    stopTimer()
    timerRef.current = setInterval(tick, 1000)

    // 2. Start speech recognition for live real-time transcript preview
    if (speechSupported) {
      try {
        const session = createSpeechSession({
          lang: sessionLang,
          seedText: finalRef.current,
          onStart: () => {},
          onResult: (final, currentInterim) => {
            finalRef.current = final
            interimRef.current = currentInterim
            setFinalText(final)
            setInterim(currentInterim)
          },
          onError: (code, message) => {
            // Non-fatal speech errors are handled gracefully without interrupting audio recording
            if (code === 'aborted' || code === 'no-speech') return
            console.warn('Speech engine note:', message)
          },
          onEnd: () => {
            const combined = interimRef.current
              ? `${finalRef.current} ${interimRef.current}`.trim()
              : finalRef.current.trim()
            finalRef.current = combined
            interimRef.current = ''
            setFinalText(combined)
            setInterim('')
          },
        })

        if (session) {
          sessionRef.current = session
          session.start()
        }
      } catch (err) {
        console.warn('Speech session setup note:', err)
      }
    }
  }

  /**
   * Stop voice recording and automatically transcribe with AI Whisper if speech was empty
   */
  async function stop() {
    stopTimer()
    setListening(false)

    if (sessionRef.current) {
      try {
        sessionRef.current.stop()
      } catch {}
      sessionRef.current = null
    }

    if (audioRecorderRef.current) {
      try {
        const recData = await audioRecorderRef.current.stop()
        audioRecorderRef.current = null
        if (recData?.blob) {
          setAudioMemo(recData)

          // If speech recognition was silent or didn't produce text, automatically transcribe with AI Whisper!
          if (!finalRef.current.trim()) {
            transcribeVoiceMemo(recData.blob)
          } else {
            toast('Voice memo and transcript saved', 'success')
          }
        }
      } catch (err) {
        console.warn('Audio recorder stop error:', err)
        audioRecorderRef.current = null
      }
    }
  }

  async function continueToReview() {
    let finalAudio = audioMemo
    const transcriptText = finalRef.current.trim()

    // If no raw audio was recorded, synthesize ambient memory audio
    if (!finalAudio && transcriptText) {
      try {
        const synthBlob = await createDemoAudioBlob(5)
        if (synthBlob) {
          finalAudio = {
            blob: synthBlob,
            type: 'audio/wav',
            duration: 5,
          }
        }
      } catch (err) {
        console.warn('Ambient memory audio synth note:', err)
      }
    }

    dispatch({
      type: 'new',
      uid: user?.id,
      patch: {
        transcript: transcriptText,
        language: lang,
        mood,
        audio: finalAudio,
      },
    })
    navigate('/review')
  }

  function typeInstead() {
    dispatch({
      type: 'new',
      uid: user?.id,
      patch: {
        transcript: '',
        language: lang,
        mood,
        audio: audioMemo,
      },
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
    if (audioRecorderRef.current) {
      audioRecorderRef.current.cancel()
      audioRecorderRef.current = null
    }
    setAudioMemo(null)
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
          <span className="privacy-badge" title="Local & Cloud persistent storage">
            🔒 Private · Cloud Synced
          </span>
        </div>
      </div>

      <h1 className="page-title">Capture today&rsquo;s memory</h1>

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
          ? `Recording in ${langObj.native || langObj.label}… tap to stop & transcribe`
          : hasTranscript
            ? 'Tap the mic for another take'
            : 'Tap the mic and speak your thoughts'}
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

      {/* AI Transcribing in progress banner */}
      {transcribing && (
        <div className="transcribing-banner" role="status">
          <span className="spinner" aria-hidden="true" />
          <span>⚡ Transcribing your voice with AI Whisper…</span>
        </div>
      )}

      {/* Live custom emojis with real-time mood reaction & floating burst particles */}
      <LiveEmojis
        selectedMood={mood}
        onSelectMood={setMood}
        liveText={finalText + ' ' + interim}
        active={listening || hasTranscript}
      />

      {/* Live transcript area with metadata header and tools */}
      <div className="transcript-wrapper">
        <div className="transcript-header">
          <div className="transcript-badge">
            {mood && (
              <span className="live-mood-tag" title="Entry mood">
                {mood}
              </span>
            )}
            <span className="lang-indicator" title={langObj.label}>
              🗣️ {langObj.native || langObj.label}
            </span>
            {wordCount > 0 && (
              <span className="word-count-badge">
                · {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
            )}
          </div>

          <div className="transcript-actions">
            {audioMemo && !listening && (
              <button
                type="button"
                className="btn-transcribe-ai"
                onClick={() => transcribeVoiceMemo()}
                disabled={transcribing}
                title="Transcribe or re-transcribe voice memo with AI Whisper"
              >
                ⚡ AI Transcribe
              </button>
            )}
            {hasTranscript && !listening && (
              <>
                <button
                  type="button"
                  className="btn-transcript-tool"
                  onClick={() => setIsEditingText(!isEditingText)}
                  title={isEditingText ? 'Done editing' : 'Edit transcript'}
                >
                  {isEditingText ? '✓ Done' : 'Edit'}
                </button>
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
              </>
            )}
          </div>
        </div>

        {isEditingText ? (
          <textarea
            className="transcript-box transcript-editable"
            value={finalText}
            onChange={(e) => {
              setFinalText(e.target.value)
              finalRef.current = e.target.value
            }}
            placeholder="Edit or type your entry here…"
            dir={rtlDirection}
            rows={5}
            style={{ width: '100%', resize: 'vertical' }}
          />
        ) : (
          <div className="transcript-box" aria-live="polite" dir={rtlDirection}>
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
                  ? `Listening & recording in ${langObj.native || langObj.label}… speak your day`
                  : 'Your transcript will appear here automatically when you speak.'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Audio memo preview if voice was recorded */}
      {audioMemo && !listening && (
        <div style={{ width: '100%', maxWidth: '440px', margin: '0.6rem auto' }}>
          <AudioPlayer
            audio={audioMemo}
            title="Spoken voice memo"
            onRemove={() => setAudioMemo(null)}
          />
        </div>
      )}

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

      {(hasTranscript || Boolean(audioMemo)) && !listening && (
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
