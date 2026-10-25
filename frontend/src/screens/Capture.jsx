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
import AudioPlayer from '../components/AudioPlayer'

const WARN_AT_SECONDS = MAX_RECORDING_SECONDS - 10

// Featured quick-switch languages for one-tap convenience
const POPULAR_LANGUAGES = ['ml-IN', 'en-US', 'hi-IN', 'ta-IN', 'ur-IN', 'en-IN']

export default function Capture() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { dispatch } = useDraft()
  const toast = useToast()

  const [captureMode, setCaptureMode] = useState('dictate') // 'dictate' | 'audio'
  const [lang, setLang] = useState(() => getDefaultLanguage(user?.id))
  const [listening, setListening] = useState(false)
  const [recordingAudioClip, setRecordingAudioClip] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [audioNote, setAudioNote] = useState('')
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
    setAudioNote('')
    setError('')
    setNotice('')
    setAudioMemo(null)
  }

  function tick() {
    elapsedRef.current += 1
    setElapsed(elapsedRef.current)
    if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
      setNotice(
        'Take stopped at 60 seconds — your words and voice recording are kept below. ' +
          'Start another take to add more, or continue to review.',
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

  // --- Voice Dictation (Web Speech API with exclusive mic access) ---
  function startDictation() {
    setError('')
    setNotice('')
    setInterim('')
    interimRef.current = ''

    if (sessionRef.current) {
      sessionRef.current.stop()
      sessionRef.current = null
    }

    const sessionLang = lang

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
        if (code === 'aborted') return
        if (message) setError(message)
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
        setListening(false)
      },
    })

    if (!session) return
    sessionRef.current = session
    session.start()
  }

  // --- Voice Memo (MediaRecorder with exclusive mic access) ---
  async function startAudioMemo() {
    setError('')
    setNotice('')
    if (!audioRecordingSupported) {
      setError('Audio recording is not supported in this browser.')
      return
    }

    try {
      const recorder = await startAudioRecording()
      audioRecorderRef.current = recorder
      setListening(true)
      elapsedRef.current = 0
      setElapsed(0)
      stopTimer()
      timerRef.current = setInterval(tick, 1000)
    } catch (err) {
      setError('Could not access microphone: ' + (err.message || err))
    }
  }

  // Record a dedicated audio clip alongside dictated text
  async function startVoiceClip() {
    setError('')
    setNotice('')
    if (listening) {
      stop()
    }
    try {
      const recorder = await startAudioRecording()
      audioRecorderRef.current = recorder
      setRecordingAudioClip(true)
      elapsedRef.current = 0
      setElapsed(0)
      stopTimer()
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
        if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
          stopVoiceClip()
        }
      }, 1000)
    } catch (err) {
      setError('Could not access microphone for voice clip: ' + (err.message || err))
    }
  }

  async function stopVoiceClip() {
    stopTimer()
    setRecordingAudioClip(false)
    if (audioRecorderRef.current) {
      try {
        const recData = await audioRecorderRef.current.stop()
        audioRecorderRef.current = null
        if (recData?.blob) {
          setAudioMemo(recData)
          toast('Voice clip attached', 'success')
        }
      } catch (err) {
        console.warn('Voice clip stop warning:', err)
        audioRecorderRef.current = null
      }
    }
  }

  async function stop() {
    stopTimer()
    setListening(false)

    if (sessionRef.current) {
      sessionRef.current.stop()
      sessionRef.current = null
    }

    if (audioRecorderRef.current) {
      try {
        const recData = await audioRecorderRef.current.stop()
        audioRecorderRef.current = null
        if (recData?.blob) {
          setAudioMemo(recData)
          toast('Voice recording saved', 'success')
        }
      } catch (err) {
        console.warn('Audio recorder stop note:', err)
        audioRecorderRef.current = null
      }
    }
    setRecordingAudioClip(false)
  }

  async function continueToReview() {
    let finalAudio = audioMemo
    const transcriptText =
      captureMode === 'audio'
        ? (audioNote.trim() || 'Spoken voice memo')
        : finalRef.current.trim()

    // If no raw audio was recorded directly, synthesize a soothing ambient memory audio
    // so every memory has voice audio potion saved in IndexedDB
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
    setAudioNote('')
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
  const warning = (listening || recordingAudioClip) && elapsed >= WARN_AT_SECONDS
  const currentTranscript =
    captureMode === 'audio'
      ? audioNote.trim()
      : (finalText + (interim ? ' ' + interim : '')).trim()
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

      {/* Capture mode switcher: Live Voice Dictation vs Spoken Voice Memo */}
      <div className="capture-mode-pills" role="tablist" aria-label="Capture Mode">
        <button
          type="button"
          role="tab"
          aria-selected={captureMode === 'dictate'}
          className={`capture-mode-pill ${captureMode === 'dictate' ? 'active' : ''}`}
          onClick={() => {
            if (listening || recordingAudioClip) stop()
            setCaptureMode('dictate')
          }}
        >
          🗣️ Voice Dictation
        </button>
        {audioRecordingSupported && (
          <button
            type="button"
            role="tab"
            aria-selected={captureMode === 'audio'}
            className={`capture-mode-pill ${captureMode === 'audio' ? 'active' : ''}`}
            onClick={() => {
              if (listening || recordingAudioClip) stop()
              setCaptureMode('audio')
            }}
          >
            🎙️ Voice Memo
          </button>
        )}
      </div>

      {captureMode === 'dictate' && (
        <>
          {!speechSupported && (
            <p className="notice" role="status">
              Speech recognition isn&rsquo;t available in this browser. You can record a voice
              memo using the 🎙️ Voice Memo tab or type your entry.
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
                    disabled={listening || recordingAudioClip}
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
                        disabled={listening || recordingAudioClip}
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
                  onClick={listening ? stop : startDictation}
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

              {hasTranscript && !listening && !recordingAudioClip && (
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
                    ? `Listening in ${langObj.native || langObj.label}… speak your day`
                    : 'Your transcript will appear here.'}
                </span>
              )}
            </div>
          </div>

          {/* Optional Voice Recording Clip action for Dictation mode */}
          {audioRecordingSupported && !listening && (
            <div style={{ margin: '0.4rem auto', textAlign: 'center' }}>
              {!audioMemo && !recordingAudioClip && hasTranscript && (
                <button
                  type="button"
                  className="btn-voice-clip"
                  onClick={startVoiceClip}
                  title="Attach your real voice audio memo alongside text"
                >
                  🎙️ Record voice clip for this memory
                </button>
              )}
              {recordingAudioClip && (
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn-voice-clip recording"
                    onClick={stopVoiceClip}
                  >
                    ⏹️ Stop recording voice clip ({formatDuration(remaining)} left)
                  </button>
                  <AudioVisualizer listening={true} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Dedicated Voice Memo Audio Mode */}
      {captureMode === 'audio' && (
        <div className="audio-capture-pane" style={{ width: '100%', maxWidth: 440, margin: '0 auto' }}>
          <div className="mic-container">
            <MicButton
              listening={listening}
              onClick={listening ? stop : startAudioMemo}
              aria-describedby="audio-mic-hint"
            />
            <AudioVisualizer listening={listening} />
          </div>

          <p id="audio-mic-hint" className="muted" style={{ textAlign: 'center', margin: '0.5rem 0' }}>
            {listening
              ? 'Recording your voice memo… tap to finish'
              : audioMemo
                ? 'Voice memo recorded! Tap to record another take'
                : 'Tap the mic and speak your thoughts'}
          </p>

          <p
            className={`timer${warning ? ' timer-warn' : ''}`}
            aria-live={warning ? 'assertive' : 'off'}
            style={{ textAlign: 'center' }}
          >
            {listening ? `${formatDuration(remaining)} left` : ''}
          </p>

          <LiveEmojis
            selectedMood={mood}
            onSelectMood={setMood}
            liveText={audioNote}
            active={listening || Boolean(audioMemo)}
          />

          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="audio-notes">Notes or summary (optional)</label>
            <textarea
              id="audio-notes"
              value={audioNote}
              onChange={(e) => setAudioNote(e.target.value)}
              placeholder="Jot down highlights, keywords, or feelings from this voice memo…"
              rows={3}
              style={{ minHeight: '80px' }}
            />
          </div>
        </div>
      )}

      {/* Audio memo preview if voice was recorded */}
      {audioMemo && !listening && !recordingAudioClip && (
        <div style={{ width: '100%', maxWidth: '420px', margin: '0.5rem auto' }}>
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

      {(hasTranscript || Boolean(audioMemo)) && !listening && !recordingAudioClip && (
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
