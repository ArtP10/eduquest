import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth/middleware.js';
import { withDbErrorHandling } from '../auth/errors.js';
import { config } from '../config.js';
import { validateQuestionCount } from './validation.js';
import { extractPdfText } from './pdf.js';
import { generateQuestions } from './gemini-client.js';
import { createGeneratedQuiz } from './persistence.js';

export const quizGenerationRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.pdfUploadMaxBytes }
});

quizGenerationRouter.post(
  '/quizzes/generate',
  requireAuth,
  (req, res, next) => {
    upload.single('pdf')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: 'The PDF could not be uploaded. Check its size and try again.' });
        return;
      }
      next();
    });
  },
  withDbErrorHandling(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'A PDF file is required.' });
      return;
    }

    const countResult = validateQuestionCount(req.body?.questionCount);
    if (!countResult.ok) {
      res.status(400).json({ error: countResult.error });
      return;
    }

    const textResult = await extractPdfText(req.file.buffer);
    if (!textResult.ok) {
      res.status(400).json({ error: textResult.error });
      return;
    }

    let generated;
    try {
      generated = await generateQuestions(textResult.text, countResult.questionCount);
    } catch {
      res.status(502).json({ error: 'Quiz generation failed. Please try again.' });
      return;
    }

    const title = req.file.originalname.replace(/\.pdf$/i, '').trim() || 'Cuestionario generado';
    const { quiz, questions } = await createGeneratedQuiz({
      title,
      authorId: req.userId!,
      questions: generated
    });

    res.status(201).json({ quiz, questions });
  })
);
