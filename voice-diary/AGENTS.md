# Agent notes

## Docs discipline (spec-driven)

- `SPEC.md` is the source of truth for product behavior. New features get a
  user story + acceptance criteria row **before** implementing.
- `STACK.md` documents the stack and architecture decisions. **Update it
  whenever dependencies, tooling, or structure change.**
- When a feature ships, mark its spec status and verify the acceptance criteria
  in the browser before checking the box.

## Commands

```powershell
npm run dev       # http://localhost:5173 (secure context — mic works)
npm run build     # production build → dist/
npm run preview   # serve the build (tests PWA/service worker)
npm run lint      # oxlint
```

## Conventions

- Plain JavaScript `.jsx`, function components + hooks. No TypeScript.
- No new dependencies without a reason; the stack is intentionally minimal
  (see `STACK.md`).
- All styles live in `src/styles/app.css` using the CSS variables defined there.
- UI code never touches IndexedDB directly — always through `src/lib/db.js`.
- Never show a success toast unless the IndexedDB write resolved.
- Phone access needs HTTPS: `docker run --rm cloudflare/cloudflared:latest
  tunnel --no-autoupdate --url http://host.docker.internal:5173`. Each origin
  is a separate diary.
