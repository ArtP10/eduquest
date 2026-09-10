import { Router } from 'express';
import { withDbErrorHandling } from '../auth/errors.js';
import { requireAuth } from '../auth/middleware.js';
import { getMatchDetail, getPlayerAnswers, isUuid, listMatchesForUser } from './matches.js';
import { isMatchHost, isMatchParticipant } from './access.js';

export const matchHistoryRouter = Router();

matchHistoryRouter.get(
  '/matches/mine',
  requireAuth,
  withDbErrorHandling(async (req, res) => {
    const matches = await listMatchesForUser(req.userId!);
    res.json({ matches });
  })
);

matchHistoryRouter.get(
  '/matches/:id',
  requireAuth,
  withDbErrorHandling(async (req, res) => {
    const matchId = req.params['id']!;
    if (!isUuid(matchId)) {
      res.status(404).json({ error: 'Match not found.' });
      return;
    }
    if (!(await isMatchParticipant(matchId, req.userId!))) {
      res.status(403).json({ error: 'You were not a participant in this match.' });
      return;
    }
    const match = await getMatchDetail(matchId);
    if (!match) {
      res.status(404).json({ error: 'Match not found.' });
      return;
    }
    res.json({ match });
  })
);

matchHistoryRouter.get(
  '/matches/:id/players/:matchPlayerId/answers',
  requireAuth,
  withDbErrorHandling(async (req, res) => {
    const matchId = req.params['id']!;
    const matchPlayerId = req.params['matchPlayerId']!;
    if (!isUuid(matchId) || !isUuid(matchPlayerId)) {
      res.status(404).json({ error: 'Match not found.' });
      return;
    }

    const match = await getMatchDetail(matchId);
    if (!match) {
      res.status(404).json({ error: 'Match not found.' });
      return;
    }
    const targetPlayer = match.leaderboard.find((entry) => entry.matchPlayerId === matchPlayerId);
    const isSelf = !!targetPlayer && targetPlayer.userId === req.userId;
    const isHost = await isMatchHost(matchId, req.userId!);
    if (!isSelf && !isHost) {
      res.status(403).json({ error: 'You can only view your own answers, unless you hosted this match.' });
      return;
    }

    const answers = await getPlayerAnswers(matchId, matchPlayerId);
    if (!answers) {
      res.status(404).json({ error: 'Player not found in this match.' });
      return;
    }
    res.json({ answers });
  })
);
