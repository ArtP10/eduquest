import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from './jwt.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth once a valid JWT access token is verified. */
      userId?: string;
    }
  }
}

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches
 * `req.userId`. Exported for future protected routes — not attached to any
 * existing gameplay/room/socket route by this change.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    return;
  }

  req.userId = payload.userId;
  next();
}

/**
 * Attaches `req.userId` if a valid Bearer token is present, but never
 * rejects — for routes whose visibility depends on *whether* the requester
 * is authenticated (e.g. GET /quizzes/:id: published quizzes are visible to
 * anyone, drafts only to their author), where `requireAuth` would wrongly
 * force a token even for the guest-visible case.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) req.userId = payload.userId;
  }
  next();
}
