# Tech Stack

Living document. **Update this file whenever a dependency, tool, or
architectural decision is added, removed, or changed.**

## Runtime stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| UI | React (JavaScript, `.jsx`) | 19.3.x | Function components + hooks; plain JS because the Web Speech API has no built-in types |
| Routing | `react-router-dom`, `HashRouter` | 7.18.x | Hash URLs need no rewrite rules on any static host |
| Storage | IndexedDB via `idb` | 8.0.x | Promise wrapper; survives browser restarts; stores Blobs natively |
| Speech | Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) | browser | Built into Chrome, no API key; needs internet (audio goes to a cloud service) |
| Photos | `<input type="file" accept="image/*" multiple>` + canvas resize | browser | Gallery/camera on Android; max 1280 px, JPEG q0.8, stored as Blob |
| Styling | Hand-written CSS, one file: `src/styles/app.css` | — | Design tokens as CSS variables; no UI kit |
| State | `useState`, `useReducer`, `DraftContext` | — | No state library |

## Toolchain

| Tool | Version | Purpose |
|---|---|---|
| Vite | 8.3.x | Dev server + bundler (`server.port` 5173, `strictPort`, `host`, `allowedHosts: ['.trycloudflare.com']`) |
| `@vitejs/plugin-react` | 6.1.x | React fast refresh + JSX |
| `vite-plugin-pwa` | 2.0.x | Manifest + Workbox service worker (`registerType: 'autoUpdate'`), precaches the build |
| `oxlint` | 1.88.x | `npm run lint` (bundled with the template) |
| Node / npm | 22.18 / 10.9 | Dev environment (Node ≥ 20.19 required by Vite 8) |
| Docker + `cloudflare/cloudflared` | 28.x / latest | HTTPS quick tunnel so the phone gets a secure origin — dev only, the app is not containerised |

## Data model (IndexedDB)

- Database `voice-diary`, object store `entries`, `keyPath: 'id'`, `autoIncrement`, index on `entryDate`.
- Entry: `id`, `title`, `entryDate` (local `YYYY-MM-DD`), `language` (BCP-47),
  `transcript`, `photos` `[{name, type, blob}]` (0–3), `createdAt`, `updatedAt`.
- All access goes through `src/lib/db.js` (`addEntry`, `updateEntry`, `getEntry`,
  `listEntries` newest-first, `deleteEntry`, `clearAll`). UI never touches IndexedDB.
- Photo previews use `URL.createObjectURL`, revoked on unmount (`useObjectUrls`
  in `src/components/PhotoStrip.jsx`).

## Project layout

```
src/
  main.jsx               mount + HashRouter + styles import
  App.jsx                providers, layout, routes, tab bar
  styles/app.css         design tokens + all styles
  lib/                   db.js, speech.js, photos.js, format.js
  state/DraftContext.jsx draft entry shared between Capture → Review
  screens/               Home, Capture, Review, Memories, Detail, Settings
  components/            MicButton, EntryCard, PhotoStrip, ConfirmDialog,
                         EmptyState, Toast, TabBar
```

## Commands

```powershell
npm run dev       # dev server on http://localhost:5173 (secure context, mic works)
npm run build     # production build → dist/ + service worker
npm run preview   # serve the production build (tests the PWA)
npm run lint      # oxlint
```

Phone over HTTPS (secure origin required for mic/speech):

```powershell
docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:5173
```

## Architecture decisions

- **No backend, no accounts, no API keys.** Everything runs in the browser;
  data stays in IndexedDB on that origin.
- **Each origin is a separate diary.** New tunnel URL = new empty diary.
- **Speech restart policy:** `onend` restarts recognition until the user presses
  Stop or a fatal error (`not-allowed`, `service-not-allowed`, `audio-capture`,
  `network`, `language-not-supported`) ends the session.
- **Draft flow:** Capture writes to `DraftContext`; Review reads/edits it;
  Detail → Edit loads an existing entry into the draft (`type: 'load'`).
- **PWA is off in `npm run dev`;** verify with `npm run build && npm run preview`.
