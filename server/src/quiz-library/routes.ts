import { Router } from 'express';
import { withDbErrorHandling } from '../auth/errors.js';
import { listPublishedQuizzes } from './published-quizzes.js';
import { listTags } from './tags.js';
import { parseListParams } from './query-params.js';

export const quizLibraryRouter = Router();

// Public (no auth) — the Quiz Library browses/searches/filters published
// quizzes without requiring login, per spec's "Public Browsing Without
// Authentication" requirement.
quizLibraryRouter.get(
  '/quizzes/published',
  withDbErrorHandling(async (req, res) => {
    const params = parseListParams(req.query as Record<string, unknown>);
    const { quizzes, total } = await listPublishedQuizzes(params);
    res.json({ quizzes, page: params.page, limit: params.limit, total });
  })
);

quizLibraryRouter.get(
  '/tags',
  withDbErrorHandling(async (_req, res) => {
    const tags = await listTags();
    res.json({ tags });
  })
);
