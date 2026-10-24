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
      lib/             db.js, speech.js, photos.js, format.js, limits.js,
                       illustration.js, demo.js (canvas-drawn seed entries)
      state/           DraftContext.jsx (Capture → Review draft)
      screens/         Auth, Home, Capture, Review, Memories, Detail, Settings
      components/      MicButton, EntryCard, PhotoStrip, ConfirmDialog,
                       EmptyState, Toast, TabBar
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
| Storage | IndexedDB via `idb` | 8.0.x | Promise wrapper; survives browser restarts; stores Blobs natively |
| Speech | Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) | browser | Built into Chrome, no API key; needs internet (audio goes to a cloud service) |
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
| Gateway | Cloudflare Worker (`worker/`) | Only place AI is called — no secrets in browser code |
| Prompt model | `@cf/meta/llama-3.1-8b-instruct` | Turns the transcript into a ≤60-word English image prompt |
| Image model | `@cf/black-forest-labs/flux-1-schnell` | Watercolour illustration → PNG bytes |
| Tooling | `wrangler` 4.x (local dev dep) | `npx wrangler dev --remote` — AI bindings only run in the cloud |
| Frontend client | `src/lib/illustration.js` | `VITE_WORKER_URL` env (default `http://localhost:8787`) |
| Limits | `src/lib/limits.js` | 1000-char prompt input, 5 illustrations/day/device, 2 regenerations/entry, worker-side daily cap |

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
  `transcript`, `photos` `[{name, type, blob}]` (0–3), `createdAt`, `updatedAt`.
- All access goes through `frontend/src/lib/db.js` (`addEntry`, `updateEntry`,
  `getEntry`, `listEntries` newest-first, `deleteEntry`, `clearAll`). UI never
  touches IndexedDB.
- Photo previews use `URL.createObjectURL`, revoked on unmount (`useObjectUrls`
  in `frontend/src/components/PhotoStrip.jsx`).

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
- **Speech restart policy:** `onend` restarts recognition until the user presses
  Stop or a fatal error (`not-allowed`, `service-not-allowed`, `audio-capture`,
  `network`, `language-not-supported`) ends the session.
- **Language fallback:** `language-not-supported` restarts the session in
  `SPEECH_FALLBACK_LANG` (`en-IN`) with the transcript preserved — the API can't
  enumerate supported languages, so we attempt and degrade.
- **Recording takes:** `MAX_RECORDING_SECONDS = 60` in `speech.js`; a take
  auto-stops and keeps the transcript, and the next take seeds the session
  (`seedText`) so text appends.
- **AI goes through the Worker only.** Uploaded photos always win: the
  illustration UI and stored `illustration` appear only when `photos` is empty.
  The worker's daily cap is per-isolate (best-effort — Cloudflare can run
  multiple isolates); the device's 5/day and 2-regens rules are the real UX
  limits.
- **Draft flow:** Capture writes to `DraftContext`; Review reads/edits it;
  Detail → Edit loads an existing entry into the draft (`type: 'load'`).
- **PWA is off in `npm run dev`;** verify with `npm run build && npm run preview`.
