## 1. Project Setup

- [x] 1.1 Initialize Node.js backend project in TypeScript (package.json, `tsconfig.json`, entry point, dependencies: `socket.io`, `express` or equivalent HTTP server, `typescript`, `@types/node`, `@types/express`, build via `tsc`)
- [x] 1.2 Scaffold the Angular frontend project (Angular CLI workspace, `socket.io-client`, `phaser` as dependencies)
- [x] 1.3 Define a shared TypeScript types module for the Socket.IO event contract (event names + payload shapes) usable from both server and client
- [x] 1.4 Wire up local dev scripts to run backend and Angular dev server together

## 2. Quiz Content

- [x] 2.1 Define the quiz data shape (question, 4 choices, correct index, per-question seconds) as a TypeScript type
- [x] 2.2 Author 1-2 sample quizzes as a static typed TypeScript data module (~20 questions total per README default, or fewer for the demo)
- [x] 2.3 Load sample quizzes into server memory at startup

## 3. Room Management

- [x] 3.1 Implement room creation: generate unique room code, generate invite link resolving to the same code, assign a sample quiz, set status `lobby`, mark creator as host
- [x] 3.2 Implement join-by-code/invite-link with display name: validate room exists and is in `lobby`, generate a server-side `playerId`, add player to room
- [x] 3.3 Broadcast lobby player-list updates on join and on disconnect
- [x] 3.4 Implement host-starts-game: validate requester is host, room has a quiz and at least one player, transition room out of `lobby`
- [x] 3.5 Handle reject cases: join to nonexistent room, join to non-lobby room, non-host start attempt

## 4. Realtime Match Clock

- [x] 4.1 Implement per-room Socket.IO scoping (join/leave Socket.IO rooms keyed by room code)
- [x] 4.2 Implement the server-side match phase state machine: `lobby -> climbing -> frozen -> results -> climbing -> ... -> ended`
- [x] 4.3 Implement `climbing` phase start/duration and transition to `frozen` for the next question
- [x] 4.4 Implement `frozen` phase countdown timer with early-exit when all connected players have answered
- [x] 4.5 Implement first-answer-lock (ignore subsequent submissions from the same player for the current question)
- [x] 4.6 Implement `results` phase: reveal correct answer, compute per-player modifier (boost/slowdown), emit results payload
- [x] 4.7 Implement transition to `ended` once the assigned quiz's questions are exhausted
- [x] 4.8 Broadcast every phase change to all clients in the room with server timestamps

## 5. Jumper Gameplay (Phaser 3 inside Angular)

- [x] 5.1 Build an Angular component that owns the Phaser `Game` instance lifecycle (create on init, destroy on teardown) and hosts one jumper instance per connected player's own view
- [x] 5.2 Implement upward climbing movement and platform generation for the `climbing` phase
- [x] 5.3 Implement the starting floor and fall-back behavior with no elimination
- [x] 5.4 Implement applying a boost/slowdown modifier to jumper physics based on the `results` payload
- [x] 5.5 Implement modifier reset at the start of each new `climbing` phase
- [x] 5.6 Track each client's local climb height/progress for use in final placement scoring

## 6. Scoring & Leaderboard

- [x] 6.1 Implement server-side correctness scoring (base points for a correct locked answer)
- [x] 6.2 Implement speed bonus calculation scaled by remaining countdown time at answer submission
- [x] 6.3 Implement end-of-match ranking by final climb height/progress and F1-style descending placement bonus
- [x] 6.4 Implement live leaderboard broadcast after every question's results and at match end
- [x] 6.5 Ensure scores are computed and stored server-side only (no client-reported scores accepted)

## 7. Frontend Integration (Angular)

- [x] 7.1 Build an Angular service wrapping the Socket.IO client, exposing room/match/leaderboard state to components
- [x] 7.2 Build lobby components: create room, join by code/link, display name entry, player list, host start button
- [x] 7.3 Build in-match UI: question/choices display during `frozen`, countdown display, answer submission, results reveal
- [x] 7.4 Build live leaderboard component updating on each broadcast
- [x] 7.5 Wire all Socket.IO event handlers to the shared event contract types from 1.3

## 8. End-to-End Validation

- [x] 8.1 Manually validate a full match with 2 browser clients: create room, join via invite link, host starts, play through all questions, confirm boosts/slowdowns apply, confirm final leaderboard and placement bonuses are correct
- [x] 8.2 Validate edge cases: a player who never answers a question, a player who disconnects during the lobby, joining a full/started room
