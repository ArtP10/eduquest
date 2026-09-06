import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const ACCESS_TOKEN_EXPIRY = '7d';
// Short-lived on purpose — it only exists to carry an unverified Google
// profile from the OAuth callback to the "choose a username" submission a
// few seconds/minutes later. It is never accepted as an access token (see
// the `type` discriminator, checked by verifyGooglePendingToken only).
const GOOGLE_PENDING_TOKEN_EXPIRY = '15m';

export interface AccessTokenPayload {
  userId: string;
}

export interface GooglePendingPayload {
  type: 'google_pending';
  googleId: string;
  email: string;
  suggestedUsername: string;
}

export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { userId };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/** Returns null for a missing/invalid/expired token rather than throwing. */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === 'object' && decoded !== null && typeof decoded['userId'] === 'string') {
      return { userId: decoded['userId'] };
    }
    return null;
  } catch {
    return null;
  }
}

export function signGooglePendingToken(params: { googleId: string; email: string; suggestedUsername: string }): string {
  const payload: GooglePendingPayload = { type: 'google_pending', ...params };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: GOOGLE_PENDING_TOKEN_EXPIRY });
}

/** Returns null for a missing/invalid/expired/wrong-type token rather than throwing. */
export function verifyGooglePendingToken(token: string): GooglePendingPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      decoded['type'] === 'google_pending' &&
      typeof decoded['googleId'] === 'string' &&
      typeof decoded['email'] === 'string' &&
      typeof decoded['suggestedUsername'] === 'string'
    ) {
      return {
        type: 'google_pending',
        googleId: decoded['googleId'],
        email: decoded['email'],
        suggestedUsername: decoded['suggestedUsername']
      };
    }
    return null;
  } catch {
    return null;
  }
}
