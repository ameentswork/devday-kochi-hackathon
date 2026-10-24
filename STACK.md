# Tech Stack

Living document. **Update this file whenever a dependency, tool, or
architectural decision is added, removed, or changed.**

## Repository layout

```
devday-kochi-hackathon/
  frontend/            Vite + React PWA — the app
    index.html
    vite.config.js     port 5173, allowedHosts, PWA manifest
    public/icons/      icon-192.png, icon-512.png
    src/
      main.jsx         mount + HashRouter + styles import
      App.jsx          providers, layout, routes, tab bar
      styles/app.css   design tokens + all styles
      lib/             db.js, speech.js, audioRecorder.js, photos.js, format.js,
                       limits.js, illustration.js, demo.js (canvas-drawn seed entries)
      state/           DraftContext.jsx (Capture → Review draft with audio)
      screens/         Auth, Home, Capture, Review, Memories, Detail, Settings
      components/      MicButton, AudioPlayer, AudioVisualizer, LiveEmojis,
                       EntryCard, PhotoStrip, ConfirmDialog, EmptyState, Toast, TabBar
  backend/             Express server (production serving + future API)
    server.js          static dist/ hosting, SPA fallback, /api/health
    package.json
  worker/              Cloudflare Worker — all AI access goes through here
    wrangler.toml      Workers AI binding: AI
    src/index.js       POST /api/prompt, POST /api/image, 8 KB cap, daily cap
    package.json       wrangler (dev dep)
  package.json         orchestration scripts (dev, build, start, install:all)
  SPEC.md  STACK.md  AGENTS.md  README.md
```

## Frontend stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| UI | React (JavaScript, `.jsx`) | 19.3.x | Function components + hooks; plain JS because the Web Speech API has no built-in types |
| Routing | `react-router-dom`, `HashRouter` | 7.18.x | Hash URLs need no rewrite rules on any static host |
| Storage | IndexedDB via `idb` | 8.0.x | Promise wrapper; survives browser restarts; stores Blobs (photos + voice memos) natively |
| Speech | Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) | browser | Native BCP-47 binding (`ml-IN` for Malayalam, `en-US` for English, etc.); preserves raw script without translation or transliteration; non-fatal silence and clean abort suppression |
| Voice Memo Recorder | `MediaRecorder` + Web Audio API | browser | Simultaneous voice capture during dictation; encodes `audio/webm` (or `audio/wav`), tracked with duration and saved as Blob |
| Voice Memo Player | Custom `AudioPlayer.jsx` component | — | Play/pause, scrubbing slider, time indicators, live bouncing visualizer bars, download option |
| Audio Visualizer | Web Audio API (`AudioContext`, `AnalyserNode`) | browser | Zero-dependency live waveform equalizer feedback during active microphone recording |
| Photos | `<input type="file" accept="image/*" multiple>` + canvas resize | browser | Gallery/camera on Android; max 1280 px, JPEG q0.8, stored as Blob |
| Styling | Hand-written CSS, one file: `src/styles/app.css` | — | Design tokens as CSS variables; no UI kit |
| State | `useState`, `useReducer`, `DraftContext` | — | No state library |

## Backend stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| Server | Node.js + Express | Node 22, express 5.x | Serves `frontend/dist` with SPA fallback; `/api/health`; auth + admin endpoints |
| Auth | Hand-rolled in `backend/server.js` | — | `crypto.scrypt` password hashes, Bearer-token sessions, `backend/data.json` JSON-file store (gitignored). First registered user = `admin`, rest = `member`, `status` field for deactivation (sessions purged). `POST /api/auth/demo {role}` = passwordless demo logins (hackathon only) |
| Admin API | `requireAdmin` middleware | — | `GET /api/admin/stats`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/status`, `GET /api/admin/health`; members self-report entry counts via `POST /api/me/stats` (counts only, no content) |
| Frontend auth | `src/lib/api.js` + `src/state/AuthContext.jsx` | — | Token + uid in localStorage; `App.jsx` gates the app and routes admins to the admin dashboard; Vite dev proxy maps `/api` → `localhost:3000` |
| Tests | `node:test` (built-in) | — | `backend/test/auth.test.js`, 8 cases: roles, status, session lifecycle, stats, self-protection |

## AI / illustration stack

| Layer | Choice | Notes |
|---|---|---|
| Gateway | Cloudflare Worker (`worker/`) + Local/Render Fallback | Dual-environment: Cloudflare Worker AI (Llama 3.1 + Flux 1) with seamless local watercolor canvas generator fallback when worker is offline or on Render without worker config |
| Prompt model | `@cf/meta/llama-3.1-8b-instruct` | Turns the transcript into a ≤60-word English image prompt |
| Image model | `@cf/black-forest-labs/flux-1-schnell` | Watercolour illustration → PNG bytes |
| Tooling | `wrangler` 4.x (local dev dep) | `npx wrangler dev --remote` — AI bindings only run in the cloud |
| Frontend client | `src/lib/illustration.js` | `VITE_WORKER_URL` env (default `http://localhost:8787`), with automatic watercolor fallback |
| Limits | `src/lib/limits.js` | 1000-char prompt input (daily illustration and regeneration limits removed for testing) |

## Toolchain

| Tool | Version | Purpose |
|---|---|---|
| Vite | 8.3.x | Dev server + bundler (`server.port` 5173, `strictPort`, `host`, `allowedHosts: ['.trycloudflare.com']`) |
| `@vitejs/plugin-react` | 6.1.x | React fast refresh + JSX |
| `vite-plugin-pwa` | 2.0.x | Manifest + Workbox service worker (`registerType: 'autoUpdate'`), precaches the build |
| `oxlint` | 1.88.x | `npm run lint` (frontend) |
| Node / npm | 22.18 / 10.9 | Dev environment (Node ≥ 20.19 required by Vite 8) |
| Docker + `cloudflare/cloudflared` | 28.x / latest | HTTPS quick tunnel so the phone gets a secure origin — dev only |

## Data model (IndexedDB)

- **Per-account database:** `voice-diary-<uid>` (uid = account id from login;
  `guest` for legacy), object store `entries`, `keyPath: 'id'`,
  `autoIncrement`, index on `entryDate`. Entries carry an `owner` field
  re-checked on read/update/delete. The pre-auth `voice-diary` DB is inherited
  once by the first account to sign in (`voice-diary-legacy-migrated` flag) —
  never deleted.
- Entry: `id`, `title`, `entryDate` (local `YYYY-MM-DD`), `language` (BCP-47),
  `transcript`, `photos` `[{name, type, blob}]` (0–3), `audio` `{blob, type, duration}`,
  `mood`, `createdAt`, `updatedAt`.
- All access goes through `frontend/src/lib/db.js` (`addEntry`, `updateEntry`,
  `getEntry`, `listEntries` newest-first, `deleteEntry`, `clearAll`). UI never
  touches IndexedDB.
- Photo previews use `URL.createObjectURL`, revoked on unmount (`useObjectUrls`
  in `frontend/src/components/PhotoStrip.jsx`). Audio Blobs rendered with
  `AudioPlayer.jsx`.

## Commands (run from repo root)

```powershell
npm run install:all   # install frontend + backend deps
npm run dev           # Vite dev server → http://localhost:5173 (secure context, mic works)
npm run dev:backend   # Express with --watch → http://localhost:3000
npm run build         # frontend production build → frontend/dist + service worker
npm run start         # Express serves frontend/dist → http://localhost:3000
npm run lint          # oxlint (frontend)
npm run preview       # vite preview (tests PWA without backend)
npm run dev:worker    # wrangler dev --remote → http://localhost:8787 (needs `npx wrangler login` once)
npm run deploy:worker # deploy the worker → https://voice-diary-api.<you>.workers.dev
```

Phone over HTTPS (secure origin required for mic/speech):

```powershell
docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:5173
```

## Architecture decisions

- **Local-first data.** Diary entries live only in IndexedDB; the backend stores
  nothing and today only serves the built frontend. It exists so the repo has a
  clean `frontend/`/`backend/` split and a place for a future API.
- **Each origin is a separate diary.** New tunnel URL = new empty diary.
- **Speech fidelity policy:** `rec.lang` is strictly bound to the user's chosen
  BCP-47 locale (`ml-IN` for Malayalam, `en-US` for English US, `hi-IN` for Hindi,
  `ta-IN` for Tamil, etc.) before recognition begins. Speech recognition results
  preserve the engine's original script verbatim (never translated, never
  transliterated into Latin characters). If a browser engine lacks recognition
  for a language, a polite message is displayed without forcing English conversion.
  Abort signals (`error: aborted`) and natural pauses (`error: no-speech`) are
  handled cleanly without alarming errors.
- **Simultaneous voice recording:** each take simultaneously captures microphone
  audio via `MediaRecorder` (`audio/webm` or `audio/wav`), saving the raw voice
  memo alongside the transcript for future playback.
- **Recording takes:** `MAX_RECORDING_SECONDS = 60` in `speech.js`; a take
  auto-stops and keeps the transcript and voice recording, and the next take seeds
  the session (`seedText`) so text appends.
- **AI goes through the Worker only.** Uploaded photos always win: the
  illustration UI and stored `illustration` appear only when `photos` is empty.
  Daily illustration limits (device counter + worker cap) were removed for the
  demo — the 2-regens-per-entry rule remains.
- **Draft flow:** Capture writes `transcript`, `language`, `mood`, and `audio` to
  `DraftContext`; Review previews and plays the voice memo; Detail provides
  playback and audio download. Drafts are strictly isolated per logged-in user.
- **Individual member navigation:** member logins land directly on `#/capture`
  with personal identity badge and 4-tab bar (Home, Capture, Memories, Settings).
  Admins are restricted from diary routes.
- **PWA is off in `npm run dev`;** verify with `npm run build && npm run preview`.
