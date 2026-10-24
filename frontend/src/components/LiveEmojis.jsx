import { useEffect, useRef, useState } from 'react'

export const MOOD_EMOJIS = [
  {
    emoji: '😊',
    label: 'Happy',
    words: ['happy', 'joy', 'smile', 'laugh', 'good', 'great', 'fun', 'love', 'സന്തോഷം', 'ചിരി', 'നല്ലത്', 'സ്നേഹം', 'खुश', 'मज़ा', 'आनंद'],
  },
  {
    emoji: '🌿',
    label: 'Peaceful',
    words: ['peace', 'calm', 'nature', 'tree', 'quiet', 'morning', 'walk', 'garden', 'ശാന്തം', 'മരം', 'നടത്തം', 'പൂന്തോട്ടം', 'शांति', 'सुकून', 'प्रकृति'],
  },
  {
    emoji: '☕',
    label: 'Cozy',
    words: ['coffee', 'tea', 'home', 'warm', 'cozy', 'evening', 'rain', 'ചായ', 'കാപ്പി', 'വീട്', 'മഴ', 'സന്ധ്യ', 'चाय', 'कॉफ़ी', 'घर'],
  },
  {
    emoji: '✨',
    label: 'Inspired',
    words: ['dream', 'create', 'write', 'art', 'think', 'idea', 'new', 'ചിന്ത', 'സ്വപ്നം', 'പുതിയത്', 'कला', 'विचार', 'सपना'],
  },
  {
    emoji: '🎉',
    label: 'Excited',
    words: ['party', 'celebrate', 'birthday', 'win', 'achievement', 'cheers', 'ആഘോഷം', 'വിജയം', 'ജന്മദിനം', 'उत्सव', 'जीत', 'बधाई'],
  },
  {
    emoji: '⚡',
    label: 'Energetic',
    words: ['workout', 'gym', 'run', 'power', 'fast', 'busy', 'done', 'ഊർജ്ജം', 'ജോലി', 'ഓട്ടം', 'ऊर्जा', 'दौड़', 'कसरत'],
  },
  {
    emoji: '💭',
    label: 'Reflective',
    words: ['remember', 'memory', 'past', 'reflect', 'life', 'deep', 'miss', 'ഓർമ്മ', 'ജീവിതം', 'പണ്ട്', 'यादें', 'ज़िंदगी', 'सोच'],
  },
  {
    emoji: '🌧️',
    label: 'Low',
    words: ['sad', 'tired', 'down', 'heavy', 'hard', 'exhausted', 'alone', 'സങ്കടം', 'ക്ഷീണം', 'ഒറ്റയ്ക്ക്', 'उदासी', 'थकान', 'अकेला'],
  },
]

export function detectMoodFromText(text = '') {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const m of MOOD_EMOJIS) {
    for (const w of m.words) {
      if (lower.includes(w)) {
        return m.emoji
      }
    }
  }
  return null
}

export default function LiveEmojis({ selectedMood, onSelectMood, liveText = '', active = false }) {
  const [particles, setParticles] = useState([])
  const nextId = useRef(0)
  const lastDetectedRef = useRef(null)

  // Auto-detect mood from speech live
  useEffect(() => {
    if (!active || !liveText) return
    const detected = detectMoodFromText(liveText)
    if (detected && detected !== lastDetectedRef.current) {
      lastDetectedRef.current = detected
      triggerFloatingEmoji(detected, 50)
      if (!selectedMood) {
        onSelectMood?.(detected)
      }
    }
  }, [liveText, active, selectedMood, onSelectMood])

  function triggerFloatingEmoji(emoji, percentX = 50) {
    const id = nextId.current++
    const newParticle = {
      id,
      emoji,
      left: Math.max(10, Math.min(90, percentX + (Math.random() * 20 - 10))),
      size: 24 + Math.random() * 12,
    }
    setParticles((prev) => [...prev.slice(-8), newParticle])

    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id))
    }, 1800)
  }

  function handleClick(m, idx) {
    onSelectMood?.(m.emoji === selectedMood ? '' : m.emoji)
    const percentX = (idx / (MOOD_EMOJIS.length - 1)) * 80 + 10
    triggerFloatingEmoji(m.emoji, percentX)
  }

  return (
    <div className="live-emojis-container">
      {/* Floating particles stage */}
      <div className="emoji-particles-stage" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="emoji-particle"
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      <div className="live-emojis-bar" role="radiogroup" aria-label="Live mood emojis">
        {MOOD_EMOJIS.map((m, idx) => {
          const isSelected = selectedMood === m.emoji
          return (
            <button
              key={m.emoji}
              type="button"
              className={`live-emoji-btn${isSelected ? ' selected' : ''}`}
              onClick={() => handleClick(m, idx)}
              title={`${m.label} (${m.emoji})`}
              aria-checked={isSelected}
              role="radio"
            >
              <span className="live-emoji-glyph">{m.emoji}</span>
              <span className="live-emoji-label">{m.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
