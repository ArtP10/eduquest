# Risk Log

## [2026-09-05] Convert repo to npm workspaces so `shared/` resolves in CI/Railway

**Risks**
- `client` is now hoisted into the root `node_modules` (Angular toolchain included). Full `ng build` could not be verified locally — blocked by local Node v24.12.0 (< v24.15.0 required). Server build, server `tsx` dev, and `tsc --noEmit` on the client all pass; Railway uses a compliant Node.
- `@quizjumper/shared` exports point at raw `.ts`. Works because every consumer import is `import type` (fully erased) and both toolchains resolve `.ts` via `exports`. A future *runtime* export from `shared/` would break — it needs a real build step then.
- `server/dist` was committed; now untracked + gitignored. Any external tooling referencing `server/dist/server/src/index.js` must switch to `server/dist/index.js` (`rootDir` changed `..` → `src`).
- Existing Railway services must change Root Directory to `/` and pick up `server/railway.json`. Old per-subfolder config will still fail until updated.

**Technical debt / follow-ups**
- Client static serving on Railway is not wired (no `serve`/host config). See `docs/deployment.md`.
- `client/src/environments/environment.prod.ts` still has a placeholder `apiUrl`.
- `.nvmrc` / `engines` pin absent — local Node drift will keep biting Angular builds.
