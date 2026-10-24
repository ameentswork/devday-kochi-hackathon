const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export const speechSupported = Boolean(SpeechRecognitionImpl)

// One recording take auto-stops at this many seconds.
export const MAX_RECORDING_SECONDS = 60

export const LANGUAGES = [
  {
    code: 'en-IN',
    label: 'English (India)',
    native: 'English',
    short: 'English',
    fallbacks: ['en-GB', 'en-US', 'en'],
    dir: 'ltr',
  },
  {
    code: 'ml-IN',
    label: 'Malayalam (മലയാളം)',
    native: 'മലയാളം',
    short: 'മലയാളം',
    fallbacks: ['ml'],
    dir: 'ltr',
  },
  {
    code: 'hi-IN',
    label: 'Hindi (हिन्दी)',
    native: 'हिन्दी',
    short: 'हिन्दी',
    fallbacks: ['hi'],
    dir: 'ltr',
  },
  {
    code: 'ta-IN',
    label: 'Tamil (தமிழ்)',
    native: 'தமிழ்',
    short: 'தமிழ்',
    fallbacks: ['ta-LK', 'ta'],
    dir: 'ltr',
  },
  {
    code: 'te-IN',
    label: 'Telugu (తెలుగు)',
    native: 'తెలుగు',
    short: 'తెలుగు',
    fallbacks: ['te'],
    dir: 'ltr',
  },
  {
    code: 'kn-IN',
    label: 'Kannada (ಕನ್ನಡ)',
    native: 'ಕನ್ನಡ',
    short: 'ಕನ್ನಡ',
    fallbacks: ['kn'],
    dir: 'ltr',
  },
  {
    code: 'bn-IN',
    label: 'Bengali (বাংলা)',
    native: 'বাংলা',
    short: 'বাংলা',
    fallbacks: ['bn-BD', 'bn'],
    dir: 'ltr',
  },
  {
    code: 'mr-IN',
    label: 'Marathi (मराठी)',
    native: 'मराठी',
    short: 'मराठी',
    fallbacks: ['mr'],
    dir: 'ltr',
  },
  {
    code: 'gu-IN',
    label: 'Gujarati (ગુજરાતી)',
    native: 'ગુજરાતી',
    short: 'ગુજરાતી',
    fallbacks: ['gu'],
    dir: 'ltr',
  },
  {
    code: 'pa-Guru-IN',
    label: 'Punjabi (ਪੰਜਾਬੀ)',
    native: 'ਪੰਜਾਬੀ',
    short: 'ਪੰਜਾਬੀ',
    fallbacks: ['pa-IN', 'pa'],
    dir: 'ltr',
  },
  {
    code: 'ur-IN',
    label: 'Urdu (اردو)',
    native: 'اردو',
    short: 'اردو',
    fallbacks: ['ur-PK', 'ur'],
    dir: 'rtl',
  },
  {
    code: 'en-US',
    label: 'English (US)',
    native: 'English (US)',
    short: 'English US',
    fallbacks: ['en-GB', 'en'],
    dir: 'ltr',
  },
  {
    code: 'es-ES',
    label: 'Spanish (Español)',
    native: 'Español',
    short: 'Español',
    fallbacks: ['es-MX', 'es'],
    dir: 'ltr',
  },
  {
    code: 'fr-FR',
    label: 'French (Français)',
    native: 'Français',
    short: 'Français',
    fallbacks: ['fr'],
    dir: 'ltr',
  },
  {
    code: 'de-DE',
    label: 'German (Deutsch)',
    native: 'Deutsch',
    short: 'Deutsch',
    fallbacks: ['de'],
    dir: 'ltr',
  },
  {
    code: 'ar-SA',
    label: 'Arabic (العربية)',
    native: 'العربية',
    short: 'العربية',
    fallbacks: ['ar-AE', 'ar-EG', 'ar'],
    dir: 'rtl',
  },
]

// Fallback if user's chosen language cannot be recognized anywhere
export const SPEECH_FALLBACK_LANG = 'en-IN'

export function getLanguage(code) {
  if (!code) return LANGUAGES[0]
  const clean = code.toLowerCase()
  return (
    LANGUAGES.find(
      (l) =>
        l.code.toLowerCase() === clean ||
        l.fallbacks?.some((f) => f.toLowerCase() === clean),
    ) || LANGUAGES[0]
  )
}

export function languageLabel(code) {
  const match = getLanguage(code)
  return match ? match.label : code
}

export function getLanguageShort(code) {
  const match = getLanguage(code)
  return match ? match.short : code
}

export function isRTL(code) {
  const match = getLanguage(code)
  return match?.dir === 'rtl'
}

const LANG_KEY = 'voice-diary-language'

export function getDefaultLanguage(uid) {
  const key = uid ? `${LANG_KEY}-${uid}` : LANG_KEY
  const stored = localStorage.getItem(key) || localStorage.getItem(LANG_KEY)
  if (stored) {
    if (stored === 'pa-IN') return 'pa-Guru-IN'
    return stored
  }
  return 'en-IN'
}

export function setDefaultLanguage(code, uid) {
  if (!code) return
  if (uid) localStorage.setItem(`${LANG_KEY}-${uid}`, code)
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

function isNoSpaceScript(langCode) {
  return /^(zh|ja)/i.test(langCode)
}

export function appendWithSpacing(existing = '', incoming = '', langCode = 'en-IN') {
  const trimExisting = existing.trimEnd()
  const trimIncoming = incoming.trim()
  if (!trimExisting) return trimIncoming
  if (!trimIncoming) return trimExisting

  if (isNoSpaceScript(langCode)) {
    return trimExisting + trimIncoming
  }

  // If incoming starts with common punctuation, don't add space before it
  if (/^[,.!?;:，。！？]/.test(trimIncoming)) {
    return trimExisting + trimIncoming
  }

  return `${trimExisting} ${trimIncoming}`
}

export function createSpeechSession({
  lang,
  seedText = '',
  onResult,
  onError,
  onStart,
  onEnd,
}) {
  if (!speechSupported) return null

  let stoppedByUser = false
  let everStarted = false
  let activeLang = lang || getDefaultLanguage()
  let triedFallbacks = new Set([activeLang])
  let restartTimeout = null

  // Ensure initial seed text preserves trailing boundary
  let finalText = seedText ? seedText.trimEnd() : ''

  let rec = null

  function getNextFallback(currentCode) {
    const langObj = getLanguage(currentCode)
    if (!langObj?.fallbacks) return null
    for (const fb of langObj.fallbacks) {
      if (!triedFallbacks.has(fb)) {
        triedFallbacks.add(fb)
        return fb
      }
    }
    return null
  }

  function setupRecognition() {
    if (rec) {
      try {
        rec.onstart = null
        rec.onresult = null
        rec.onerror = null
        rec.onend = null
        rec.abort()
      } catch {
        // ignore cleanup error
      }
    }

    rec = new SpeechRecognitionImpl()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = activeLang

    rec.onstart = () => {
      everStarted = true
      onStart?.()
    }

    rec.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript || ''
        if (result.isFinal) {
          finalText = appendWithSpacing(finalText, text, activeLang)
        } else {
          interim = appendWithSpacing(interim, text, activeLang)
        }
      }
      onResult?.(finalText, interim)
    }

    rec.onerror = (event) => {
      const err = event.error
      if (err === 'no-speech') {
        // Natural pauses during multilingual dictation shouldn't kill session or flash fatal error
        return
      }

      if (err === 'language-not-supported') {
        const nextVariant = getNextFallback(activeLang)
        if (nextVariant) {
          activeLang = nextVariant
          try {
            setupRecognition()
            rec.start()
            return
          } catch {
            // continue to error handler
          }
        }
      }

      if (FATAL_ERRORS.has(err)) {
        stoppedByUser = true
      }

      const message = ERROR_MESSAGES[err]
      if (message) onError?.(err, message)
    }

    rec.onend = () => {
      if (!stoppedByUser && everStarted) {
        // Chrome requires non-synchronous restart to avoid InvalidStateError
        clearTimeout(restartTimeout)
        restartTimeout = setTimeout(() => {
          if (stoppedByUser) return
          try {
            setupRecognition()
            rec.start()
          } catch {
            onEnd?.()
          }
        }, 60)
        return
      }
      onEnd?.()
    }
  }

  setupRecognition()

  return {
    start() {
      stoppedByUser = false
      try {
        rec.start()
      } catch {
        // already active
      }
    },
    stop() {
      stoppedByUser = true
      clearTimeout(restartTimeout)
      try {
        rec.stop()
      } catch {
        // not running
      }
    },
    getFinalText: () => finalText,
    getActiveLang: () => activeLang,
  }
}
