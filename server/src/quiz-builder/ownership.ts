import type { NextFunction, Request, Response } from 'express';
import { findQuizById, type QuizRecord } from './quizzes.js';
import { findQuestionById, type QuestionRecord } from './questions.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireQuizOwnership. */
      quiz?: QuizRecord;
      /** Set by requireQuestionOwnership. */
      question?: QuestionRecord;
    }
  }
}

/** Loads the quiz named by `:id`, 404s if missing, 403s if the requester isn't its author. Attaches it to `req.quiz`. */
export async function requireQuizOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  const quiz = await findQuizById(req.params['id']!);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }
  if (quiz.authorId !== req.userId) {
    res.status(403).json({ error: 'You do not own this quiz.' });
    return;
  }
  req.quiz = quiz;
  next();
}

/** Loads the question named by `:id` and its parent quiz, same 404/403 rules as requireQuizOwnership. Attaches both. */
export async function requireQuestionOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  const question = await findQuestionById(req.params['id']!);
  if (!question) {
    res.status(404).json({ error: 'Question not found.' });
    return;
  }
  const quiz = await findQuizById(question.quizId);
  if (!quiz || quiz.authorId !== req.userId) {
    res.status(403).json({ error: 'You do not own this question.' });
    return;
  }
  req.question = question;
  req.quiz = quiz;
  next();
}
