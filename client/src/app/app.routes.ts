import { Routes } from '@angular/router';
import { Home } from './home/home';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'quizzes',
    canActivate: [authGuard],
    loadComponent: () => import('./quiz-builder/my-quizzes/my-quizzes').then((m) => m.MyQuizzes)
  },
  {
    path: 'quizzes/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./quiz-builder/quiz-editor/quiz-editor').then((m) => m.QuizEditor)
  }
];
