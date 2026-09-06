import type { NextFunction, Request, Response } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  '57P03' // Postgres: cannot_connect_now
]);

function isDbConnectionError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return typeof code === 'string' && CONNECTION_ERROR_CODES.has(code);
}

/**
 * Wraps an auth route handler so a Postgres connection failure returns a
 * clean 503 instead of throwing and taking down the process — the game
 * (rooms/match/scoring/sockets) never touches the DB, so this only ever
 * affects /auth/* availability.
 */
export function withDbErrorHandling(handler: AsyncHandler): AsyncHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      if (isDbConnectionError(err)) {
        res.status(503).json({ error: 'Account services are temporarily unavailable. Please try again shortly.' });
        return;
      }
      next(err);
    }
  };
}
