// Usage limits — daily caps disabled for development/hackathon demo.
export const PROMPT_MAX_CHARS = 1000
export const ILLUSTRATIONS_PER_DAY = Infinity
export const REGENERATIONS_PER_ENTRY = Infinity

export function illustrationsUsedToday() {
  return 0
}

export function illustrationAllowed() {
  return true // Unlimited daily illustrations
}

export function recordIllustration() {
  // no-op: daily limits disabled
}
