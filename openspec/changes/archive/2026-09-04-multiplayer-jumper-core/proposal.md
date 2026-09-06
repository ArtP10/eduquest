## Why

QuizJumper's biggest technical risk is combining two things at once: real-time multiplayer sync (rooms, a shared question timer, a live leaderboard) and the actual jump-and-quiz gameplay loop (climb, freeze, boost/slowdown, score). Neither is provable in isolation — a synced-but-empty skeleton doesn't validate the game feel, and gameplay without sync doesn't validate multiplayer. This change builds both together, end to end, as a self-contained playable slice: two browsers can open a room and play a full climb-quiz-score loop against each other. Accounts, quiz authoring, AI generation, and real art are deliberately deferred, but this change's design must treat identity (currently a display name) as something a future `auth` capability will replace with real accounts — room/session/score state should key off a player identifier in a way that doesn't need reworking when accounts arrive.

## What Changes

- Stand up the Node.js backend, written in TypeScript, with Socket.IO for realtime transport.
- Add room lifecycle: create a room, generate a room code and shareable invite link (both resolve to the same room), join via either with a display name (accounts are a future capability — see Design's note on forward compatibility), a lobby showing joined players, and a host-starts-game control.
- Add a server-authoritative shared game clock driving the match through repeating phases: **climb** (players free-climb in their own world) → **question freeze** (all players see the same question at the same wall-clock moment, on a shared timer) → **results** (reveal correct answer, apply boost/slowdown) → back to **climb** — until the quiz's questions are exhausted.
- Add the Phaser 3 jumper: Doodle-Jump-style upward climbing, a starting floor a player can fall back to without ever being eliminated, and boost/slowdown movement modifiers that apply after each question and persist only until the next question.
- Add a live F1-style leaderboard with three-part scoring: points for a correct answer, a speed bonus for answering quickly, and a final-placement bonus (descending by finishing height/progress) at the end of the match.
- Add hardcoded quiz content: 1-2 sample multiple-choice quizzes (question, 4 choices, correct answer, per-question time) defined in a static TypeScript data module — no authoring UI, no persistence, no AI generation.
- Build the Angular frontend app (TypeScript, per the README's long-term stack) hosting the Phaser 3 canvas plus lobby/leaderboard UI, wired to the backend over Socket.IO.

Explicitly out of scope for this change: real authentication (Google OAuth / email-password), quiz builder UI, AI PDF-to-quiz generation, publishing/public quiz library, production hosting/deployment, and real pixel art (placeholder shapes/sprites are fine). These are future capabilities this change must not block — see Design for how player identity is kept forward-compatible with the future `auth` capability. Angular and TypeScript, originally deferred, are now in scope for this change (see revision note below).

> **Revision note:** the initial version of this proposal deferred Angular and used plain JavaScript, matching an earlier scope instruction. That instruction was reversed during implementation — this change now builds the real Angular + Phaser frontend and uses TypeScript across both frontend and backend, rather than a placeholder framework-light client that would need to be rebuilt later.

## Capabilities

### New Capabilities
- `room-management`: Room creation, room code + invite link generation, joining by display name, lobby state, and host-starts-game.
- `realtime-sync`: Socket.IO server infrastructure, per-room connection handling, and the server-authoritative shared clock driving the climb → freeze → results → climb match phases.
- `jumper-gameplay`: Phaser 3 climbing mechanics — upward movement, starting floor with no elimination, and boost/slowdown modifiers scoped to the current question interval.
- `quiz-content`: Hardcoded sample quizzes (JSON/JS) with questions, 4-choice MCQ, correct answers, and per-question timing, loaded by the server to drive freeze phases.
- `leaderboard`: Server-authoritative live scoring and ranking — correct-answer points, speed bonus, and end-of-match F1-style placement bonus — broadcast to all clients in a room in real time.

### Modified Capabilities
(none — this is a greenfield project with no existing specs)

## Impact

- New backend service: Node.js + TypeScript + Socket.IO (in-memory room/session/score state; no database required for this change since there is no persisted content or accounts yet).
- New frontend app: Angular (TypeScript) hosting the Phaser 3 canvas plus lobby/leaderboard UI.
- New static content: 1-2 hardcoded sample quizzes.
- Establishes the room/socket/match-phase event contracts and scoring model that later phases (real accounts, quiz authoring, AI generation, real art) will build on top of rather than rework. In particular, player identity is modeled as a stable player id (display-name-backed for now) so a future `auth` capability can attach real accounts without changing the room/leaderboard event contracts.
- No existing code, specs, or systems affected — this is the first implementation work in the repo.
