# Voice Diary — Your Day, Your Words

A mobile-first, installable (PWA) voice diary. Speak about your day in English
or Malayalam, edit the transcript, attach up to three photos, and keep
everything in a private diary stored in the browser's IndexedDB.

Docs: [SPEC.md](SPEC.md) (product spec, spec-driven development) ·
[STACK.md](STACK.md) (tech stack + architecture) · [AGENTS.md](AGENTS.md)
(contrib conventions)

## Requirements

- Node.js + npm
- Chrome (desktop, and Chrome on Android for the phone)
- Docker — only needed to open an HTTPS tunnel for phone testing

## Run on the laptop

```powershell
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome. `localhost` is a secure context, so the
microphone works there.

## Open it on your phone (HTTPS tunnel)

Chrome only exposes the microphone and speech recognition on secure origins, so
`http://<laptop-ip>:5173` will not work on the phone. With `npm run dev` running,
start a quick tunnel in a second terminal:

```powershell
docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:5173
```

Open the `https://….trycloudflare.com` link it prints in Chrome on the phone.

**Warning:** the tunnel link changes every run, and every origin keeps its own
IndexedDB — each new tunnel URL is a separate, empty diary. Keep the tunnel
running for the whole demo, or deploy `dist/` to a static host for a stable link.

## Installable PWA + production build

```powershell
npm run build    # writes dist/ and generates the service worker
npm run preview  # serves the production build locally
```

Upload `dist/` to any static host (GitHub Pages, Netlify, Cloudflare Pages) for
a stable HTTPS link, then use Chrome's "Add to Home screen" on the phone. If the
host serves the app from a sub-path (e.g. a GitHub Pages project site), set
`base: '/<repo>/'` in `vite.config.js` before building.

## Notes

- Dictation uses the browser's Web Speech API (Chrome), which sends audio to a
  cloud service and needs internet. Typed entries work fully offline.
- Each browser/origin keeps its own diary — laptop and phone do not sync.
- Photos are resized to max 1280 px (JPEG q0.8) and stored as Blobs in IndexedDB,
  max 3 per entry.
