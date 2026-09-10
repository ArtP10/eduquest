// Central place for auth-related env vars. Every value here is allowed to be
// a placeholder — nothing in this module throws or connects to anything on
// import, so the rest of the server (rooms/match/scoring/sockets) is never
// affected by auth config being unset or wrong.
const PLACEHOLDER_GOOGLE_VALUES = new Set(['placeholder', '', undefined]);

export const config = {
  databaseUrl: process.env['DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5433/quizjumper',
  jwtSecret: process.env['JWT_SECRET'] ?? 'dev-only-placeholder-change-me',
  googleClientId: process.env['GOOGLE_CLIENT_ID'],
  googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'],
  googleCallbackUrl: process.env['GOOGLE_CALLBACK_URL'] ?? 'http://localhost:3000/auth/google/callback',
  // Where to send the browser after a Google OAuth callback completes. Same
  // default/env var as the existing CORS origin in index.ts.
  clientOrigin: process.env['CLIENT_ORIGIN'] ?? 'http://localhost:4200',

  // AI quiz generation (see openspec/changes/add-ai-quiz-generation). Allowed
  // to be unset like the Google OAuth values above — nothing at import time
  // throws or calls the Gemini API.
  geminiApiKey: process.env['GEMINI_API_KEY'],
  // 'low' is the right default for bounded structured extraction (map source
  // text to a fixed question shape), not multi-step reasoning — bump to
  // 'medium' via env only, no code change, if quality ever needs it.
  geminiThinkingLevel: process.env['GEMINI_THINKING_LEVEL'] ?? 'low',
  // Upload cap for the source PDF (bytes) — keeps memory-storage multer
  // uploads bounded.
  pdfUploadMaxBytes: 15 * 1024 * 1024,
  // Cap on extracted text sent to Gemini, to bound token cost regardless of
  // how large the source PDF is (extra text beyond this is truncated, not
  // rejected).
  pdfExtractedTextMaxChars: 60_000,
  // Below this, extracted text is rejected as too short to plausibly
  // generate meaningful questions from.
  pdfExtractedTextMinChars: 200
};

export const isGoogleOAuthConfigured =
  !PLACEHOLDER_GOOGLE_VALUES.has(config.googleClientId) && !PLACEHOLDER_GOOGLE_VALUES.has(config.googleClientSecret);
