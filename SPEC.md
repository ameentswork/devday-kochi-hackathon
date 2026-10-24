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
- **Architecture:** `frontend/` is the Vite + React PWA containing the whole
  app; `backend/` is a thin Express server that only serves the production
  build and health check — diary data stays client-side in IndexedDB.

## User stories

| # | Story | Status |
|---|---|---|
| 1 | Pick English or Malayalam and speak; words appear live | ✅ implemented |
| 2 | Fix mistakes in the transcript and give the entry a title | ✅ implemented |
| 3 | Attach 1–3 photos and remove any before saving | ✅ implemented |
| 4 | Browse past entries newest-first and open one | ✅ implemented |
| 5 | Edit or delete an entry, with confirmation before deleting | ✅ implemented |
| 6 | Told plainly when speech recognition is unavailable; can type instead | ✅ implemented |
| 7 | Recording take auto-stops at 60s with a countdown and a 50s warning; a new take appends to the transcript | ✅ implemented |
| 8 | An entry with no uploaded photos can get a watercolour AI illustration (unlimited during testing) | ✅ implemented |
| 9 | Illustration limits and failures degrade gracefully — friendly message, entry still saves without an image | ✅ implemented |
| 10 | One-tap demo entries (with generated images) so the UI can be explored without a mic or photos | ✅ implemented |
| 11 | Pick from 12 languages incl. major Indian languages; if the browser can't recognise the chosen one, the session continues in English automatically with a notice | ✅ implemented |
| 12 | Sign in / sign up gates the app; roles are `member` (default) and `admin` (first registered account); admins see a Members list in Settings | ✅ implemented |
| 13 | One-tap "Admin demo" / "Member demo" buttons on the auth screen log straight into each role (demo accounts auto-created) | ✅ implemented |
| 14 | Admin dashboard: member stats (total/active/deactivated), total entry count, service health — never any diary content | ✅ implemented |
| 15 | Admin member management: name/email/role/status/joined list with activate/deactivate + confirmation | ✅ implemented |
| 16 | Member dashboard: welcome message, create-entry CTA, searchable/date-filterable timeline, JSON + text export | ✅ implemented |
| 17 | Speak in non-English languages (Malayalam, Hindi, Tamil, Punjabi, Urdu, Spanish, etc.) with smart word spacing, resilient silence handling, dialect fallbacks, and RTL script support | ✅ implemented |
| 18 | Capture UI enhancements: real-time audio visualizer, native script language switcher pills, word count badge, copy/clear tools, and hybrid AI illustration support across local & Render | ✅ implemented |
| 19 | Custom live emojis: real-time voice emotion detection, interactive animated floating emojis during capture, and persistent mood tagging across Review and Memories | ✅ implemented |

## Screens

| Screen | Contents | Status |
|---|---|---|
| Home | App name, today's date, large "Capture today's memory" button, 3 most recent entries with thumbnails, empty state | ✅ |
| Capture | Language selector with native scripts & quick-switch pills, pulsing mic button with live audio visualizer, live mood emoji reactions, elapsed timer, live word counter, live transcript (interim styled lighter), copy/clear actions, start/stop, "type instead", permission/error messages | ✅ |
| Review | Editable title/text, mood emoji selector, date, language, photo picker with previews + remove, Save/Discard | ✅ |
| Memories | All entries newest first, title/date/language/mood/photo strip, empty state | ✅ |
| Entry detail | Full text, mood badge, photo grid with enlarge-on-click, Edit and Delete (confirm) | ✅ |
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
| 9 | Take auto-stops at 60s keeping the transcript; countdown visible, warning at 50s; new take appends | ✅ |
| 10 | No-photo entries offer "Add an AI illustration"; one or more uploaded photos hides it entirely | ✅ |
| 11 | Regenerations unlimited during testing; generation failure → friendly message, save without image | ✅ |
| 12 | No secrets in browser code; all model calls go through the Cloudflare Worker | ✅ |
| 13 | "Add demo entries" (Home empty state + Settings → Data) seeds 4 sample entries incl. photos, an illustration and a Malayalam entry | ✅ |
| 14 | Choosing an unsupported language restarts recognition in `en-IN` mid-take, keeps the transcript and shows a notice | ✅ |
| 15 | Logged-out users see only the auth screen; signup validates fields + matching passwords; wrong credentials show an error, never crash | ✅ |
| 16 | Sessions persist via Bearer token (localStorage) until sign-out; `/api/auth/me` restores the session on reload | ✅ |
| 17 | Deactivated members cannot sign in (403) and their existing tokens die (401); admins cannot deactivate themselves or other admins | ✅ |
| 18 | Members only ever see their own diary — IndexedDB is namespaced per account (`voice-diary-<uid>`) and entries carry an `owner` stamp checked on read/update/delete | ✅ |
| 19 | Admin API routes are server-side role-checked (401/403); signup ignores any client-supplied role; first account = admin | ✅ |
| 20 | Personal export downloads JSON (photos embedded base64) or plain text | ✅ |
| 21 | Non-English speech recognition survives speech pauses without aborting take, formats inter-chunk spacing correctly, respects RTL text auto-direction, and resolves dialect codes (e.g. `pa-Guru-IN`) | ✅ |
| 22 | Live audio visualizer gives visual sound wave feedback during speech, language preference persists instantly, and AI illustrations resolve reliably across both local and Render deployments | ✅ |
| 23 | Live emojis react to spoken thoughts in real-time or via one-tap reaction pills with floating particle micro-animations, persist to IndexedDB, and display on entry cards and detail view | ✅ |

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
  fallback. `continuous` + `interimResults`, `lang` from selector — 12 options:
  `en-IN`, `ml-IN`, `hi-IN`, `ta-IN`, `te-IN`, `kn-IN`, `bn-IN`, `mr-IN`,
  `gu-IN`, `pa-IN`, `ur-IN`, `en-US` (`LANGUAGES` in `speech.js`). Restart on
  `onend` until Stop or a fatal error. On `language-not-supported`, the session
  transparently restarts in `en-IN` (`SPEECH_FALLBACK_LANG`), keeps the
  transcript and shows a notice — the Web Speech API can't list supported
  languages, so we try and handle failure. Never fake a transcript, never
  overwrite user text, never claim success before the IndexedDB write resolves.
  No audio-file recording.
- **Photos:** `accept="image/*" multiple`, max 3 per entry, resize to ≤1280 px
  long edge JPEG q0.8, stored as Blobs on the entry.
- **Data:** entries persist in IndexedDB (see STACK.md). Call
  `navigator.storage.persist()` after the first save. Object URLs revoked on
  unmount.
- **Privacy:** no analytics, no API keys, no secrets in browser code. Settings
  states that data stays in this browser and that Chrome dictation sends audio
  to a cloud service. Illustration requests send only the first 1000 characters
  of the transcript to the Worker.
- **Recording limit:** `MAX_RECORDING_SECONDS = 60` in `speech.js`. A take
  auto-stops at 60s keeping its transcript; starting another take appends.
- **Illustration:** offered in Review only when `photos` is empty. All limits in
  `src/lib/limits.js`: `PROMPT_MAX_CHARS = 1000`,
  `REGENERATIONS_PER_ENTRY = 2`. Worker URL comes from
  `VITE_WORKER_URL` (default `http://localhost:8787`). Saved on the entry as
  `illustration: {prompt, name, type, blob}` + `illustrationGens`; dropped when
  photos exist.
- **Worker (`worker/`):** `POST /api/prompt` (chat model → ≤60-word English
  prompt in fixed watercolour style), `POST /api/image` (flux-1-schnell → PNG),
  8 KB body cap, CORS POST-only. Daily illustration limits (device + worker
  cap) were removed — cost guardrails currently rely on Workers AI free tier.
- **Auth (`backend/`):** signup → `member`; the FIRST registered user becomes
  `admin` (synchronous JSON-file writes make the first-account race safe).
  Passwords hashed with `crypto.scrypt` + per-user salt; sessions are random
  Bearer tokens (7-day expiry) in `backend/data.json` (gitignored). Users carry
  a `status` (`active`/`deactivated`) — deactivated accounts get 403 at login
  and their sessions are purged.
- **Admin API (all behind `requireAdmin` — server-side role check):**
  `GET /api/admin/stats`, `GET /api/admin/users`,
  `PATCH /api/admin/users/:id/status`, `GET /api/admin/health`. Members report
  only an entry *count* via `POST /api/me/stats` — diary content never reaches
  the server, so admins cannot read, export, or delete anyone's entries.
- **Diary ownership (client-side):** each account gets its own IndexedDB
  (`voice-diary-<uid>`); entries carry an `owner` field re-checked on
  read/update/delete. Pre-auth data in the legacy `voice-diary` DB is inherited
  by the first account to sign in on that browser — never deleted. Honest
  boundary: this is browser-local storage — same-origin scripts could read it,
  it is not a server-enforced wall and not encrypted.
  `GET /api/admin/users` (admin only). `POST /api/auth/demo {role}` is a
  demo-only one-tap login that finds-or-creates `demo-admin@`/`demo-member@`
  accounts — **remove before any real deployment.** The Vite dev server
  proxies `/api` → `localhost:3000`.

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
