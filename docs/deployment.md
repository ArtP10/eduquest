# Deployment (Railway)

The repo is an **npm workspaces** monorepo:

```
package.json          → workspaces: ["shared", "server", "client"]
shared/               → @quizjumper/shared (type-only contracts, no build step)
server/               → quizjumper-server (Node + tsc)
client/               → Angular app
```

There is **one lockfile at the repo root** (`package-lock.json`). Every install
must run from the root so the workspace symlinks (`node_modules/@quizjumper/shared`)
are created. This is why every Railway service below uses **Root Directory = `/`**
(the repo root), not `server/` or `client/`.

## Server service

Set these in the service **Settings**. (Config-as-code / per-service
`railway.json` is deprecated and locked for services that never used it, so
every service here configures commands in the dashboard.)

| Setting              | Value                                  |
| -------------------- | -------------------------------------- |
| Root Directory       | `/`                                    |
| Custom Build Command | `npm ci && npm run build -w server`    |
| Custom Start Command | `npm run start -w server`              |
| Watch Paths          | `server/**`, `shared/**`               |

Required environment variables: see `server/.env.example`.

## Client service (Angular)

The client build resolves `@quizjumper/shared` the same way — so it also needs
Root Directory = `/`. `ng build` only emits static files (to `client/dist/client`
— the `browser` subfolder is flattened away by the `outputPath` override in
`angular.json`), so the service needs something to serve them.

**Recommended — let Railpack serve them with Caddy.** No start command:

| Setting              | Value                                  |
| -------------------- | -------------------------------------- |
| Root Directory       | `/`                                    |
| Custom Build Command | `npm ci && npm run build -w client`    |
| Custom Start Command | *(empty)*                              |
| Watch Paths          | `client/**`, `shared/**`               |

Plus one variable: `RAILPACK_SPA_OUTPUT_DIR=client/dist/client`. Caddy binds
`0.0.0.0:$PORT` itself and does SPA fallback.

**Fallback — the `serve` package.** Custom Start Command
`npm run serve:static -w client`. The script forces `-l tcp://0.0.0.0:$PORT`;
without the explicit host `serve` binds `localhost` only and Railway's proxy
gets "Application failed to respond".

Before the first production build, set `apiUrl` in
`client/src/environments/environment.prod.ts` to the deployed server URL.

## Why not build from inside `server/` or `client/`

Both apps import the shared contracts by package name (`@quizjumper/shared/events`).
That name only resolves through the workspace symlink created by a root install.
A build scoped to a subfolder has no root `node_modules`, so the import fails —
which was the original `Cannot find module '../../shared/events.js'` error.
