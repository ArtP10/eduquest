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

| Setting          | Value                                                     |
| ---------------- | -------------------------------------------------------- |
| Root Directory   | `/`                                                      |
| Build Command    | `npm ci && npm run build -w client`                      |
| Output           | `client/dist/client/browser` (static)                    |
| Watch Paths      | `client/**`, `shared/**`                                 |

Serving the static output (static host, `serve`, or Caddy) is not wired in this
repo yet — see `risks.md`. Also set `client/src/environments/environment.prod.ts`
`apiUrl` to the deployed server URL before the first production build.

## Why not build from inside `server/` or `client/`

Both apps import the shared contracts by package name (`@quizjumper/shared/events`).
That name only resolves through the workspace symlink created by a root install.
A build scoped to a subfolder has no root `node_modules`, so the import fails —
which was the original `Cannot find module '../../shared/events.js'` error.
