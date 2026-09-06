## Context

Greenfield project (README only, no code yet). The README's long-term stack (Angular, Postgres, Google/email auth, quiz authoring, AI generation) is locked as the *eventual* target. This change builds a self-contained slice first — a playable, synced climb-quiz-score loop for 2+ browsers, with no accounts and no persistence — but, per revised scope, builds it on the real frontend framework (Angular) and language (TypeScript, both frontend and backend) rather than a throwaway plain-JS placeholder. The goal is still to de-risk the two hardest things — realtime sync and the gameplay loop — together, without paying for infrastructure (Postgres, OAuth) that this slice doesn't need yet; only the frontend framework and language choices moved earlier.

Because accounts are still explicitly future work (not "never"), the design treats **player identity** as a seam that must not require rework later: today a display name + generated id, later a real account id.

The defining gameplay/sync decision, from the README, is: **each player climbs in their own world; only questions and the leaderboard are shared.** Physics stays fully client-side. The server does not simulate player position — it only coordinates room membership, match-phase timing, and scores.

## Goals / Non-Goals

**Goals:**
- Prove the room lifecycle (create, room code, invite link, join by display name, lobby, host-starts-game) end-to-end.
- Prove a server-authoritative shared clock can drive climb → freeze → results → climb phases identically for all clients in a room.
- Prove the Doodle-Jump-style jumper (climb, starting floor, no elimination, boost/slowdown) feels right and correctly reflects each player's last answer.
- Prove the three-part scoring model (correct answer, speed bonus, final placement) computes correctly and drives a live F1-style leaderboard.
- Ship 1-2 hardcoded quizzes sufficient to play a full match.
- Design room/session/score state so a future `auth` capability can attach real accounts without changing the room/socket event contracts.
- Build the Angular app and Phaser canvas integration on TypeScript throughout (frontend and backend), establishing the project structure later phases extend.

**Non-Goals:**
- Real accounts, Google OAuth, email/password, or any persistence of users (future `auth` capability).
- Quiz builder UI, published/public quiz library, AI PDF-to-quiz generation.
- Database of any kind — Phase 0 state is in-memory and lost on server restart; that's acceptable for this slice.
- Production hosting, horizontal scaling of the Socket.IO server, or reconnect/resume-after-disconnect handling.
- Real pixel art — placeholder shapes/sprites are sufficient.
- Classroom-scale load testing (30+ players); design should not preclude it, but this change validates with 2+ clients only.

## Decisions

**Server owns room/match/score state; clients own physics.** The Node server is the single source of truth for: room membership, room status (lobby/climbing/frozen/results/ended), the current question index, the match-phase timer, and every player's score. It never tracks player x/y position. This matches the README's "own worlds, shared quiz/leaderboard" decision.
- *Alternative considered:* server-authoritative physics. Rejected — explicitly ruled out by the README, and unnecessary since only questions/leaderboard are shared.

**Player identity is a server-generated `playerId`, entered display name, socket-bound.** On join, the client sends a display name; the server assigns a `playerId` (e.g., a UUID) that owns that connection's score/state for the room. Every room/leaderboard event key is `playerId`, never the raw socket id or display name string.
- *Why this matters for forward-compatibility:* when the future `auth` capability lands, `playerId` becomes (or maps 1:1 to) the authenticated user id — the event contracts, leaderboard shape, and scoring logic do not need to change, only how `playerId` is minted (login-derived instead of join-time-generated).
- *Alternative considered:* key everything by socket id. Rejected — socket ids are transport artifacts that change on reconnect and have no path to becoming an account id later.

**Socket.IO rooms map 1:1 to game rooms**, using `socket.join(roomCode)` so `io.to(roomCode).emit(...)` scopes broadcasts for free. Single server instance; no message broker. Sufficient for the 2+ client validation target of this change.

**Match phases are a server-driven state machine, pushed to clients.** Room status cycles: `lobby → climbing → frozen → results → climbing → ... → ended`. The server holds the authoritative phase and question index and emits phase-change events (`match:climb-start`, `match:freeze-start` with the question payload and a server timestamp, `match:results` with the answer/leaderboard delta, `match:ended` with final placements) to the whole room at the moment each phase begins. Clients react to pushes; they do not poll or independently decide when a freeze starts.
- This directly implements the README's "shared timer... identical for every player" decision and generalizes cleanly to the freeze-phase countdown (closes on timer OR all-answered).

**Freeze-phase resolution: timer OR all-answered, first-answer-locked.** The server starts a countdown on `freeze-start`; each player's first answer for that question is recorded and locked (further answers from that player are ignored). The freeze ends when the countdown elapses or every connected player has answered, whichever comes first — per README §4.

**Boost/slowdown is a per-player modifier recomputed every question, applied client-side.** After `match:results`, the server includes each player's new modifier (`boost` | `slowdown` | `none`) in the payload; each client applies it to its own local jumper physics for the following climb phase only, then it resets. This keeps physics client-side (per the sync model) while keeping the modifier's *source of truth* server-side (derived from the player's locked answer), consistent with "player identity/score truth lives on the server."

**Scoring model, computed server-side from locked answers and final climb progress:**
- Correct answer: flat base points (README default 100).
- Speed bonus: scaled by remaining time at the moment of the locked answer (README default `round(100 × timeLeft / totalTime)`), 0 for wrong answers.
- Final placement: at `match:ended`, rank players by final height/progress and award a descending F1-style point table (README default `25,18,15,12,10,8,6,4,2,1,0…`, extended/truncated to player count).
- The server is the only place these are computed; the leaderboard broadcast after every question and at match end is a direct projection of this state — no client-side score computation, to prevent desync or cheating via a modified client.

**Quiz content is a static in-memory module, not a database.** 1-2 quizzes (question, 4 choices, correct index, per-question seconds) live in a typed TypeScript data module loaded by the server at startup; a room is assigned a random sample quiz at creation, since there's no picker UI yet. The server never trusts the client with the correct answer — only the question text/choices are sent to clients; the correct index and per-answer correctness are resolved server-side.
- *Why this matters for forward-compatibility:* the server already treats "quiz" as an opaque typed object it reads questions from — swapping the static loader for a future Postgres-backed quiz-authoring/AI-generation source later is a loader change, not an event-contract change.

**Frontend is an Angular application hosting the Phaser 3 canvas**, per the README's locked long-term stack, built directly rather than deferred. A dedicated Angular component owns the Phaser `Game` instance lifecycle (create on `ngAfterViewInit`, destroy on `ngOnDestroy`); Angular services wrap the Socket.IO client and expose room/match/leaderboard state (e.g., via RxJS observables or signals) that both the Phaser scene and the surrounding Angular UI (lobby, question overlay, leaderboard) consume. Keeping the Socket.IO event contract itself framework-agnostic (plain named events/payloads, defined once and shared as TypeScript types between server and client) means the contract doesn't change even though the frontend now is Angular from the start.

**Backend and frontend share TypeScript types for the Socket.IO event contract.** Event names and payload shapes (room state, match phase events, answer submission, leaderboard) are defined as TypeScript interfaces in a shared location (a small shared types module) so client and server can't drift silently out of sync.

## Risks / Trade-offs

- [No persistence — server restart loses all room/score state] → Acceptable for this change; explicitly deferred until a database-backed phase exists. Document this as a known limitation, not silently discovered.
- [No reconnect handling — a dropped connection mid-match just leaves that player stuck] → Acceptable for a 2+ client proof-of-concept demo; track as a follow-up before any real multi-session use.
- [Fixed single quiz per room (no picker) may feel limited even for a demo] → Acceptable since quiz-content is explicitly hardcoded scope; a picker is trivial to add later without touching the event contract.
- [Client-side physics with server-side modifier truth means a modified client could ignore its boost/slowdown] → Acceptable since scoring/leaderboard truth (the part that matters for fairness) stays server-side regardless of what a client's physics does locally; anti-cheat hardening is out of scope for this change.
- [Single Socket.IO instance is a ceiling for future classroom-scale (30+) rooms] → Not addressed here; the room/event model doesn't preclude adding a Redis adapter later, but this change validates only at small scale.

## Open Questions

- Exact boost/slowdown magnitudes (e.g., +40%/-25%) — per README, tune during playtesting; not a spec-blocking decision, can default to a reasonable starting value and adjust.
- Whether `playerId` should be a UUID generated at join or something more structured — implementation detail, doesn't affect the event contract, resolve during task execution.
