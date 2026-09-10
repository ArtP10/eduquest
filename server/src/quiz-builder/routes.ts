import { Router } from 'express';
import { withDbErrorHandling } from '../auth/errors.js';
import { optionalAuth, requireAuth } from '../auth/middleware.js';
import { requireQuestionOwnership, requireQuizOwnership } from './ownership.js';
import { createQuiz, findQuizById, listQuizzesByAuthor, updateQuiz } from './quizzes.js';
import { createQuestion, deleteQuestion, listQuestionsByQuiz, updateQuestion } from './questions.js';
import { validateQuestionInput } from './validation.js';
import { attachTag, detachTag } from './quiz-tags.js';
import { findOrCreateTag, listTagsForQuiz } from '../quiz-library/tags.js';
import { getQuizGlobalStats } from '../match-history/matches.js';

export const quizBuilderRouter = Router();

quizBuilderRouter.post(
  '/quizzes',
  requireAuth,
  withDbErrorHandling(async (req, res) => {
    const { title } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'Title is required.' });
      return;
    }
    const quiz = await createQuiz({ title: title.trim(), authorId: req.userId! });
    res.status(201).json({ quiz });
  })
);

quizBuilderRouter.get(
  '/quizzes/mine',
  requireAuth,
  withDbErrorHandling(async (req, res) => {
    const quizzes = await listQuizzesByAuthor(req.userId!);
    res.json({ quizzes });
  })
);

quizBuilderRouter.get(
  '/quizzes/:id',
  optionalAuth,
  withDbErrorHandling(async (req, res) => {
    const quiz = await findQuizById(req.params['id']!);
    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }
    const isAuthor = !!req.userId && quiz.authorId === req.userId;
    if (quiz.status !== 'published' && !isAuthor) {
      // Same response as "doesn't exist" — a draft's existence isn't
      // revealed to anyone but its author.
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }
    const questions = await listQuestionsByQuiz(quiz.id);
    const tags = await listTagsForQuiz(quiz.id);
    res.json({ quiz, questions, tags });
  })
);

quizBuilderRouter.get(
  '/quizzes/:id/stats',
  withDbErrorHandling(async (req, res) => {
    const stats = await getQuizGlobalStats(req.params['id']!);
    res.json({ stats });
  })
);

quizBuilderRouter.patch(
  '/quizzes/:id',
  requireAuth,
  withDbErrorHandling(requireQuizOwnership),
  withDbErrorHandling(async (req, res) => {
    const { title, status } = req.body ?? {};
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      res.status(400).json({ error: 'Title cannot be empty.' });
      return;
    }
    if (status !== undefined) {
      if (status !== 'published') {
        res.status(400).json({ error: 'The only supported status change is publishing a draft.' });
        return;
      }
      if (req.quiz!.status !== 'draft') {
        res.status(400).json({ error: 'Only a draft quiz can be published.' });
        return;
      }
    }
    const quiz = await updateQuiz(req.quiz!.id, {
      title: typeof title === 'string' ? title.trim() : undefined,
      status: status === 'published' ? 'published' : undefined
    });
    res.json({ quiz });
  })
);

quizBuilderRouter.post(
  '/quizzes/:id/questions',
  requireAuth,
  withDbErrorHandling(requireQuizOwnership),
  withDbErrorHandling(async (req, res) => {
    const result = validateQuestionInput(req.body);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const question = await createQuestion({
      quizId: req.quiz!.id,
      questionText: result.questionText,
      choices: result.choices,
      correctChoice: result.correctChoice
    });
    res.status(201).json({ question });
  })
);

quizBuilderRouter.patch(
  '/questions/:id',
  requireAuth,
  withDbErrorHandling(requireQuestionOwnership),
  withDbErrorHandling(async (req, res) => {
    const result = validateQuestionInput(req.body);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const question = await updateQuestion(req.question!.id, {
      questionText: result.questionText,
      choices: result.choices,
      correctChoice: result.correctChoice
    });
    res.json({ question });
  })
);

quizBuilderRouter.delete(
  '/questions/:id',
  requireAuth,
  withDbErrorHandling(requireQuestionOwnership),
  withDbErrorHandling(async (req, res) => {
    await deleteQuestion(req.question!.id);
    res.json({ ok: true });
  })
);

quizBuilderRouter.post(
  '/quizzes/:id/tags',
  requireAuth,
  withDbErrorHandling(requireQuizOwnership),
  withDbErrorHandling(async (req, res) => {
    const { name } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Tag name is required.' });
      return;
    }
    const tag = await findOrCreateTag(name);
    await attachTag(req.quiz!.id, tag.id);
    res.status(201).json({ tag });
  })
);

quizBuilderRouter.delete(
  '/quizzes/:id/tags/:tagId',
  requireAuth,
  withDbErrorHandling(requireQuizOwnership),
  withDbErrorHandling(async (req, res) => {
    await detachTag(req.quiz!.id, req.params['tagId']!);
    res.json({ ok: true });
  })
);
