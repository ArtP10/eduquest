# Risk Log

## [2026-09-05] Convert repo to npm workspaces so `shared/` resolves in CI/Railway

**Risks**
- `client` is now hoisted into the root `node_modules` (Angular toolchain included). Full `ng build` could not be verified locally — blocked by local Node v24.12.0 (< v24.15.0 required). Server build, server `tsx` dev, and `tsc --noEmit` on the client all pass; Railway uses a compliant Node.
- `@quizjumper/shared` exports point at raw `.ts`. Works because every consumer import is `import type` (fully erased) and both toolchains resolve `.ts` via `exports`. A future *runtime* export from `shared/` would break — it needs a real build step then.
- `server/dist` was committed; now untracked + gitignored. Any external tooling referencing `server/dist/server/src/index.js` must switch to `server/dist/index.js` (`rootDir` changed `..` → `src`).
- Existing Railway services must change Root Directory to `/` and pick up `server/railway.json`. Old per-subfolder config will still fail until updated.

**Technical debt / follow-ups**
- `client/src/environments/environment.prod.ts` still has a placeholder `apiUrl`.
- `.nvmrc` / `engines` pin absent — local Node drift will keep biting Angular builds.

## [2026-09-05] Wire client static serving on Railway

**Risks**
- `serve` (v14) serves the SPA and reads `$PORT` from the env — verified locally (SPA fallback returns 200 on deep routes). It is HTTP-only with no compression/caching tuning; fine for a demo, not a CDN.
- `angular.json` `outputPath` override flattens output to `client/dist/client` (drops the `browser/` subfolder). Any script referencing the old `dist/client/browser` path must be updated.
- `serve` is a full runtime dependency now (adds ~90 transitive packages to the client).

**Technical debt / follow-ups**
- For production, consider a real static host / CDN instead of `serve`.
