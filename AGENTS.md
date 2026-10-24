# Agent notes

## Docs discipline (spec-driven)

- `SPEC.md` is the source of truth for product behavior. New features get a
  user story + acceptance criteria row **before** implementing.
- `STACK.md` documents the stack and architecture decisions. **Update it
  whenever dependencies, tooling, or structure change.**
- When a feature ships, mark its spec status and verify the acceptance criteria
  in the browser before checking the box.

## Structure

- `frontend/` — the Vite + React PWA (the whole app).
- `backend/` — Express server; serves `frontend/dist` + `/api/health`. Put
  future API routes here. Diary data stays client-side in IndexedDB — do not
  add server-side storage without updating SPEC.md first.
- `worker/` — Cloudflare Worker; the ONLY place AI is called. Never put API
  keys or secrets in `frontend/`. Illustration/usage-limit constants live in
  `frontend/src/lib/limits.js`; the recording limit is `MAX_RECORDING_SECONDS`
  in `frontend/src/lib/speech.js`.
- Commands run from the repo root and delegate via `npm --prefix`.

## Commands (repo root)

```powershell
npm run install:all   # install frontend + backend deps
npm run dev           # frontend dev server → http://localhost:5173 (secure context — mic works)
npm run dev:backend   # backend with --watch → http://localhost:3000
npm run build         # frontend build → frontend/dist/
npm run start         # backend serves frontend/dist → http://localhost:3000
npm run lint          # oxlint (frontend)
npm run dev:worker    # wrangler dev --remote → http://localhost:8787
npm run deploy:worker # deploy worker to *.workers.dev
```

## Conventions

- Plain JavaScript `.jsx`, function components + hooks. No TypeScript.
- No new dependencies without a reason; the stack is intentionally minimal
  (see `STACK.md`).
- All styles live in `frontend/src/styles/app.css` using its CSS variables.
- UI code never touches IndexedDB directly — always through `frontend/src/lib/db.js`.
- Never show a success toast unless the IndexedDB write resolved.
- Phone access needs HTTPS: `docker run --rm cloudflare/cloudflared:latest
  tunnel --no-autoupdate --url http://host.docker.internal:5173`. Each origin
  is a separate diary.
