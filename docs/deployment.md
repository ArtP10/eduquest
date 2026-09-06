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

| Setting          | Value                                  |
| ---------------- | -------------------------------------- |
| Root Directory   | `/`                                    |
| Config File      | `server/railway.json`                  |
| Build Command    | `npm ci && npm run build -w server`    |
| Start Command    | `npm run start -w server`              |
| Watch Paths      | `server/**`, `shared/**`               |

`server/railway.json` already encodes the build/start commands, so once the
Config File path is set the commands do not need to be entered by hand.

Required environment variables: see `server/.env.example`.

## Client service (Angular)

The client build resolves `@quizjumper/shared` the same way — so it also needs
Root Directory = `/`.

| Setting          | Value                                  |
| ---------------- | -------------------------------------- |
| Root Directory   | `/`                                    |
| Config File      | `client/railway.json`                  |
| Build Command    | `npm ci && npm run build -w client`    |
| Start Command    | `npm run serve:static -w client`       |
| Watch Paths      | `client/**`, `shared/**`               |

`ng build` only emits static files (to `client/dist/client` — the `browser`
subfolder is flattened away by the `outputPath` override in `angular.json`).
`serve:static` runs the `serve` package over that folder as an SPA (`-s`, so
deep links fall back to `index.html`); `serve` binds to Railway's `$PORT`
automatically.

Before the first production build, set `apiUrl` in
`client/src/environments/environment.prod.ts` to the deployed server URL.

## Why not build from inside `server/` or `client/`

Both apps import the shared contracts by package name (`@quizjumper/shared/events`).
That name only resolves through the workspace symlink created by a root install.
A build scoped to a subfolder has no root `node_modules`, so the import fails —
which was the original `Cannot find module '../../shared/events.js'` error.
