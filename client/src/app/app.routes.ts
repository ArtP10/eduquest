import { Routes } from '@angular/router';
import { Home } from './home/home';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', component: Home },
  {
    // Public browsing surface — no authGuard: playing/browsing never
    // requires login, only publishing does (see design.md decision 8).
    path: 'library',
    loadComponent: () => import('./quiz-library/quiz-library').then((m) => m.QuizLibrary)
  },
  {
    path: 'quizzes',
    canActivate: [authGuard],
    loadComponent: () => import('./quiz-builder/my-quizzes/my-quizzes').then((m) => m.MyQuizzes)
  },
  {
    path: 'quizzes/generate',
    canActivate: [authGuard],
    loadComponent: () => import('./quiz-builder/generate-quiz/generate-quiz').then((m) => m.GenerateQuiz)
  },
  {
    path: 'quizzes/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./quiz-builder/quiz-editor/quiz-editor').then((m) => m.QuizEditor)
  },
  {
    path: 'matches',
    canActivate: [authGuard],
    loadComponent: () => import('./match-history/my-matches/my-matches').then((m) => m.MyMatches)
  },
  {
    path: 'matches/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./match-history/match-detail/match-detail').then((m) => m.MatchDetailPage)
  }
];
