import { Router } from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';
import { config, isGoogleOAuthConfigured } from '../config.js';
import { withDbErrorHandling } from './errors.js';
import { requireAuth } from './middleware.js';
import { signAccessToken, signGooglePendingToken, verifyGooglePendingToken } from './jwt.js';
import {
  createUserWithGoogle,
  createUserWithPassword,
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  findUserByUsername,
  toPublicUser,
  type User
} from './users.js';

const BCRYPT_ROUNDS = 10;

/** Either an already-existing account (returning sign-in) or a not-yet-created one still needing a username. */
type GoogleAuthResolution =
  | { kind: 'existing'; user: User }
  | { kind: 'new'; googleId: string; email: string; suggestedUsername: string };

if (isGoogleOAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId!,
        clientSecret: config.googleClientSecret!,
        callbackURL: config.googleCallbackUrl
      },
      (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
        void resolveGoogleProfile(profile).then(
          (result) => done(null, result),
          (err) => done(err)
        );
      }
    )
  );
}

/**
 * Deliberately does NOT create the account here for a first-time sign-in —
 * only looks up whether one already exists. Account creation is deferred to
 * POST /auth/google/complete, once the person has chosen (or accepted a
 * suggested) username, instead of one being picked for them silently.
 */
async function resolveGoogleProfile(profile: Profile): Promise<GoogleAuthResolution> {
  const existing = await findUserByGoogleId(profile.id);
  if (existing) return { kind: 'existing', user: existing };

  const email = profile.emails?.[0]?.value;
  if (!email) throw new Error('Google account has no email.');

  const suggestedUsername = await suggestAvailableUsername(profile.displayName || email.split('@')[0] || 'player');
  return { kind: 'new', googleId: profile.id, email, suggestedUsername };
}

/** Best-effort suggestion only — /auth/google/complete re-checks uniqueness at creation time regardless. */
async function suggestAvailableUsername(seed: string): Promise<string> {
  const base = seed.replace(/\s+/g, '').slice(0, 24) || 'player';
  let username = base;
  let suffix = 0;
  while (await findUserByUsername(username)) {
    suffix += 1;
    username = `${base}${suffix}`;
  }
  return username;
}

export const authRouter = Router();

authRouter.post(
  '/register',
  withDbErrorHandling(async (req, res) => {
    const { username, email, password } = req.body ?? {};
    if (typeof username !== 'string' || !username.trim()) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }
    if (typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    if (await findUserByUsername(username)) {
      res.status(409).json({ error: 'That username is already taken.' });
      return;
    }
    if (await findUserByEmail(email)) {
      res.status(409).json({ error: 'That email is already registered.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await createUserWithPassword({ username, email, passwordHash });
    const token = signAccessToken(user.id);
    res.status(201).json({ token, user: toPublicUser(user) });
  })
);

authRouter.post(
  '/login',
  withDbErrorHandling(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }
    if (!user.passwordHash) {
      res.status(401).json({ error: 'This account uses Google sign-in. Use the "Sign in with Google" button.' });
      return;
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }

    const token = signAccessToken(user.id);
    res.json({ token, user: toPublicUser(user) });
  })
);

authRouter.get('/google', (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    res.status(503).json({ error: 'Google sign-in is not configured yet.' });
    return;
  }
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] })(req, res, next);
});

authRouter.get(
  '/google/callback',
  (req, res, next) => {
    if (!isGoogleOAuthConfigured) {
      res.status(503).json({ error: 'Google sign-in is not configured yet.' });
      return;
    }
    next();
  },
  passport.authenticate('google', { session: false, failureRedirect: '/auth/google/failure' }),
  (req, res) => {
    const result = req.user as GoogleAuthResolution | undefined;
    if (!result) {
      res.status(401).json({ error: 'Google sign-in failed.' });
      return;
    }

    // Land back on the Angular app (no server-side page of our own) — either
    // logged in (returning account) or with a short-lived pending token so
    // the person can choose a username before the account is actually
    // created. AuthService picks either up on init and strips it from the
    // URL. See design.md decision 6/8.
    const redirectUrl = new URL(config.clientOrigin);
    if (result.kind === 'existing') {
      redirectUrl.searchParams.set('token', signAccessToken(result.user.id));
    } else {
      const pendingToken = signGooglePendingToken({
        googleId: result.googleId,
        email: result.email,
        suggestedUsername: result.suggestedUsername
      });
      redirectUrl.searchParams.set('googlePendingToken', pendingToken);
      redirectUrl.searchParams.set('suggestedUsername', result.suggestedUsername);
    }
    res.redirect(redirectUrl.toString());
  }
);

authRouter.get('/google/failure', (_req, res) => {
  res.status(401).json({ error: 'Google sign-in failed.' });
});

authRouter.post(
  '/google/complete',
  withDbErrorHandling(async (req, res) => {
    const { pendingToken, username } = req.body ?? {};
    if (typeof pendingToken !== 'string' || typeof username !== 'string' || !username.trim()) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }

    const payload = verifyGooglePendingToken(pendingToken);
    if (!payload) {
      res.status(401).json({ error: 'This sign-up link has expired. Please try "Sign in with Google" again.' });
      return;
    }

    // Someone may have finished this same Google sign-up already (e.g. a
    // double submit, or two tabs) — treat that as success rather than a
    // duplicate-account error.
    const alreadyCreated = await findUserByGoogleId(payload.googleId);
    if (alreadyCreated) {
      res.json({ token: signAccessToken(alreadyCreated.id), user: toPublicUser(alreadyCreated) });
      return;
    }

    const trimmedUsername = username.trim();
    if (await findUserByUsername(trimmedUsername)) {
      res.status(409).json({ error: 'That username is already taken.' });
      return;
    }

    const user = await createUserWithGoogle({ username: trimmedUsername, email: payload.email, googleId: payload.googleId });
    const token = signAccessToken(user.id);
    res.status(201).json({ token, user: toPublicUser(user) });
  })
);

authRouter.post('/logout', requireAuth, (_req, res) => {
  // Access tokens are not server-tracked (no revocation list) — logout just
  // confirms the request; the client is responsible for discarding its copy.
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  withDbErrorHandling(async (req, res) => {
    const user = await findUserById(req.userId!);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: toPublicUser(user) });
  })
);
