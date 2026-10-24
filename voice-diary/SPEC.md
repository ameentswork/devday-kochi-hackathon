# Product Spec — Voice Diary

Spec-driven development: **describe changes here first, then implement.** New
features get a user story + acceptance criteria row before code. Mark criteria
`[x]` only after they've been verified in the browser.

**Voice Diary — Your Day, Your Words** lets a person speak about their day,
edit the transcript, attach up to three photos and keep the entry in a private,
local diary that survives closing and reopening the browser.

## Goal and non-goals

- **Goal:** one complete, polished flow — speak, transcribe, edit, add photos,
  save, reopen, edit, delete.
- **Non-goals:** accounts, cloud sync, AI-generated images, audio file storage,
  multi-user support, native app-store builds, export.

## User stories

| # | Story | Status |
|---|---|---|
| 1 | Pick English or Malayalam and speak; words appear live | ✅ implemented |
| 2 | Fix mistakes in the transcript and give the entry a title | ✅ implemented |
| 3 | Attach 1–3 photos and remove any before saving | ✅ implemented |
| 4 | Browse past entries newest-first and open one | ✅ implemented |
| 5 | Edit or delete an entry, with confirmation before deleting | ✅ implemented |
| 6 | Told plainly when speech recognition is unavailable; can type instead | ✅ implemented |

## Screens

| Screen | Contents | Status |
|---|---|---|
| Home | App name, today's date, large "Capture today's memory" button, 3 most recent entries with thumbnails, empty state | ✅ |
| Capture | Language selector, pulsing mic button, elapsed timer, live transcript (interim styled lighter), start/stop, "type instead", permission/error messages | ✅ |
| Review | Editable title/text, date, language, photo picker with previews + remove, Save/Discard | ✅ |
| Memories | All entries newest first, title/date/language/photo strip, empty state | ✅ |
| Entry detail | Full text, photo grid with enlarge-on-click, Edit and Delete (confirm) | ✅ |
| Settings | Default language, privacy note, about, "Delete all data" (confirm) | ✅ |

Navigation: bottom tab bar on narrow screens, left rail ≥860 px — Home,
Memories, Settings.

## Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Mic permission asked once; denial shows a clear message + typing fallback | ✅ |
| 2 | Interim + final transcript appear while speaking (English; Malayalam where the browser supports it) | ✅ |
| 3 | Stop opens Review with the transcript fully editable; nothing auto-rewritten | ✅ |
| 4 | Saving empty text blocked inline; failed save shows error, never claims success | ✅ |
| 5 | Saved entry with 3 photos survives closing Chrome and reopening | ✅ |
| 6 | Edits persist; deletion asks confirmation and removes entry + photos | ✅ |
| 7 | >3 photos keeps the first 3 and tells the user | ✅ |
| 8 | Unsupported browser still works with typed entries + shows a notice | ✅ |

## Design

- Warm ivory `#FAF6EC` background, forest `#2F5D45` primary, sage `#A9BFA8`
  secondary, dark ink text (≥4.5:1 contrast).
- Rounded cards, generous spacing, one restrained animation (mic pulse),
  44 px minimum touch targets, visible focus rings, `prefers-reduced-motion`
  respected.
- Mobile-first: designed at 360 px, scales up. Inputs ≥16 px (no iOS zoom),
  `viewport-fit=cover`, tab bar respects `env(safe-area-inset-bottom)`.
- Feels like a personal journal, not a CRUD admin page.

## Functional rules

- **Speech:** feature-detect first; if missing, hide the mic and show the typing
  fallback. `continuous` + `interimResults`, `lang` from selector (`en-IN`,
  `ml-IN`, `en-US`). Restart on `onend` until Stop or a fatal error. Never fake
  a transcript, never overwrite user text, never claim success before the
  IndexedDB write resolves. No audio-file recording.
- **Photos:** `accept="image/*" multiple`, max 3 per entry, resize to ≤1280 px
  long edge JPEG q0.8, stored as Blobs on the entry.
- **Data:** entries persist in IndexedDB (see STACK.md). Call
  `navigator.storage.persist()` after the first save. Object URLs revoked on
  unmount.
- **Privacy:** no analytics, no API keys, no third-party requests. Settings
  states that data stays in this browser and that Chrome dictation sends audio
  to a cloud service.

## Out of scope / backlog

Cut-if-short order (already all shipped): Settings extras, photo enlarge view,
left-rail layout, transitions.

Future ideas (need a user story + criteria row above before implementing):

- Search/filter memories
- Export entries (JSON or text)
- More dictation languages
- Audio recording alongside transcript (needs `MediaRecorder` interaction testing)

## Known constraints

- Speech recognition requires Chrome + internet; iOS Safari is best-effort,
  typing fallback must work everywhere.
- Each origin (localhost, each tunnel URL, static host) has a separate diary.
- Malayalam recognition quality depends on Chrome's service — always keep the
  typed fallback credible.
