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
  clientOrigin: process.env['CLIENT_ORIGIN'] ?? 'http://localhost:4200'
};

export const isGoogleOAuthConfigured =
  !PLACEHOLDER_GOOGLE_VALUES.has(config.googleClientId) && !PLACEHOLDER_GOOGLE_VALUES.has(config.googleClientSecret);
