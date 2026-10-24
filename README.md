# Voice Diary — Your Day, Your Words

A mobile-first, installable (PWA) voice diary. Speak about your day in English
or Malayalam, edit the transcript, attach up to three photos, and keep
everything in a private diary stored in the browser's IndexedDB.

Docs: [SPEC.md](SPEC.md) (product spec, spec-driven development) ·
[STACK.md](STACK.md) (tech stack + architecture) · [AGENTS.md](AGENTS.md)
(contrib conventions)

## Project structure

```
devday-kochi-hackathon/
  frontend/    Vite + React PWA — the whole app (see STACK.md)
  backend/     Express server — serves the production build + /api/health
  worker/      Cloudflare Worker — the only place AI is called
               (/api/prompt + /api/image through Workers AI)
  SPEC.md  STACK.md  AGENTS.md
```

## Requirements

- Node.js + npm
- Chrome (desktop, and Chrome on Android for the phone)
- Docker — only needed to open an HTTPS tunnel for phone testing

## Setup

```powershell
npm run install:all   # installs frontend/, backend/ and worker/ dependencies
npm test              # backend auth/role/status test suite (node:test)
```

## Run in development

The app now requires sign-in, so the backend must run alongside Vite:

```powershell
npm run dev:backend   # terminal 1 → http://localhost:3000 (auth API)
npm run dev           # terminal 2 → http://localhost:5173 (app)
```

Open `http://localhost:5173` in Chrome and create an account — **the first
account you register becomes the admin**; later signups are members.
`localhost` is a secure context, so the microphone works there. Vite proxies
`/api` to the backend in dev, so no CORS setup is needed.

## Run in production (backend serves the frontend)

```powershell
npm run build         # frontend build → frontend/dist (+ service worker)
npm run start         # Express → http://localhost:3000
```

The backend serves `frontend/dist` statically and exposes `GET /api/health`.

## AI illustration worker (phase 2)

All model access goes through `worker/` — no API keys or secrets in browser
code. One-time setup:

```powershell
cd worker
npx wrangler login        # browser login to Cloudflare (free account)
```

Local dev (AI bindings only run in the cloud, hence `--remote`):

```powershell
npm run dev:worker        # → http://localhost:8787
```

The frontend calls `VITE_WORKER_URL` (default `http://localhost:8787`; see
`frontend/.env.example`). For the phone demo over the tunnel, deploy the worker
and point the frontend at it:

```powershell
npm run deploy:worker     # → https://voice-diary-api.<you>.workers.dev
# then create frontend/.env with VITE_WORKER_URL=https://voice-diary-api.<you>.workers.dev
# and restart npm run dev (or rebuild)
```

Limits: 5 illustrations per device per day, 2 regenerations per entry, only the
first 1000 characters of the transcript are sent, and the worker enforces its
own daily cap. If a limit or failure hits, the entry still saves — just without
an image.

## Open it on your phone (HTTPS tunnel)

Chrome only exposes the microphone and speech recognition on secure origins, so
`http://<laptop-ip>:5173` will not work on the phone. With `npm run dev` running,
start a quick tunnel in a second terminal:

```powershell
docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:5173
```

Open the `https://….trycloudflare.com` link it prints in Chrome on the phone.
To tunnel the production build instead, point the URL at port 3000 and run
`npm run start` instead of `npm run dev`.

**Warning:** the tunnel link changes every run, and every origin keeps its own
IndexedDB — each new tunnel URL is a separate, empty diary. Keep the tunnel
running for the whole demo, or deploy `frontend/dist` to a static host for a
stable link.

## Installable PWA

Upload `frontend/dist` to any static host (GitHub Pages, Netlify, Cloudflare
Pages) for a stable HTTPS link, then use Chrome's "Add to Home screen" on the
phone. If the host serves the app from a sub-path (e.g. a GitHub Pages project
site), set `base: '/<repo>/'` in `frontend/vite.config.js` before building.
You can also deploy `frontend/` + `backend/` together and let Express serve it.

## Notes

- Dictation uses the browser's Web Speech API (Chrome), which sends audio to a
  cloud service and needs internet. Typed entries work fully offline.
- Each browser/origin keeps its own diary — laptop and phone do not sync.
- Photos are resized to max 1280 px (JPEG q0.8) and stored as Blobs in IndexedDB,
  max 3 per entry.
