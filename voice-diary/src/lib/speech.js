const SpeechRecognitionImpl =
  window.SpeechRecognition || window.webkitSpeechRecognition

export const speechSupported = Boolean(SpeechRecognitionImpl)

export const LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'en-US', label: 'English (US)' },
]

export function languageLabel(code) {
  return LANGUAGES.find((l) => l.code === code)?.label || code
}

const LANG_KEY = 'voice-diary-language'

export function getDefaultLanguage() {
  return localStorage.getItem(LANG_KEY) || 'en-IN'
}

export function setDefaultLanguage(code) {
  localStorage.setItem(LANG_KEY, code)
}

const ERROR_MESSAGES = {
  'not-allowed':
    'Microphone access was blocked. Allow the microphone in the browser address bar, or type instead.',
  'service-not-allowed':
    'Speech recognition is not allowed in this context. You can still type your entry.',
  'no-speech': "Didn't catch any speech — keep talking, or press Stop.",
  'audio-capture':
    'No microphone was found on this device. You can still type instead.',
  network:
    'Speech recognition needs an internet connection. Check your connection or type instead.',
  'language-not-supported':
    'That language is not supported for speech here. Try another language or type instead.',
  aborted: null,
}

const FATAL_ERRORS = new Set([
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'network',
  'language-not-supported',
])

export function createSpeechSession({ lang, onResult, onError, onStart, onEnd }) {
  if (!speechSupported) return null

  let stoppedByUser = false
  let everStarted = false
  let finalText = ''

  const rec = new SpeechRecognitionImpl()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = lang

  rec.onstart = () => {
    everStarted = true
    onStart?.()
  }

  rec.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) finalText += result[0].transcript
      else interim += result[0].transcript
    }
    onResult?.(finalText, interim)
  }

  rec.onerror = (event) => {
    if (FATAL_ERRORS.has(event.error)) stoppedByUser = true
    const message = ERROR_MESSAGES[event.error]
    if (message) onError?.(event.error, message)
  }

  rec.onend = () => {
    if (!stoppedByUser && everStarted) {
      try {
        rec.start()
        return
      } catch {
        // fall through and report the end
      }
    }
    onEnd?.()
  }

  return {
    start() {
      stoppedByUser = false
      try {
        rec.start()
      } catch {
        // already started
      }
    },
    stop() {
      stoppedByUser = true
      try {
        rec.stop()
      } catch {
        // not running
      }
    },
    getFinalText: () => finalText,
  }
}
