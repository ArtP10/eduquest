import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * First use of a route guard in this app — protects the quiz-builder
 * screens only; the existing lobby/match/leaderboard flow at `/` is not
 * routed through this at all. Redirects to `/` with the login panel opened
 * (this app has no dedicated login page — login has always been a modal
 * over whatever screen is active, see AuthHeader) rather than a `/login` route.
 */
export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Must wait for the initial session restore, or a fresh page load /
  // direct link races this check against that still-pending request and
  // wrongly treats an actually-logged-in person as a guest.
  await authService.ensureSessionReady();

  if (authService.isAuthenticated()) return true;

  authService.requestedLoginRedirect.set(true);
  return router.parseUrl('/');
};
