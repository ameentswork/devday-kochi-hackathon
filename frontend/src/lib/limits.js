import { todayISO } from './format'

// Phase-2 usage limits — all constants in one place.
export const PROMPT_MAX_CHARS = 1000
export const ILLUSTRATIONS_PER_DAY = 5
export const REGENERATIONS_PER_ENTRY = 2

const DAY_KEY = 'voice-diary-illustrations'

function readDay() {
  try {
    const raw = JSON.parse(localStorage.getItem(DAY_KEY))
    return raw?.day === todayISO() ? raw : { day: todayISO(), count: 0 }
  } catch {
    return { day: todayISO(), count: 0 }
  }
}

export function illustrationsUsedToday() {
  return readDay().count
}

export function illustrationAllowed() {
  return illustrationsUsedToday() < ILLUSTRATIONS_PER_DAY
}

export function recordIllustration() {
  const { day, count } = readDay()
  localStorage.setItem(DAY_KEY, JSON.stringify({ day, count: count + 1 }))
}
