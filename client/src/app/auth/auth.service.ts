import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { clearStoredToken, getStoredToken, setStoredToken } from './token-storage';
import { environment } from '../../environments/environment';

export interface PublicUser {
  id: string;
  username: string;
  email: string;
}

export type AuthResult = { ok: true } | { ok: false; error: string };

interface AuthResponse {
  token: string;
  user: PublicUser;
}

interface MeResponse {
  user: PublicUser;
}

export interface GoogleSignupPending {
  pendingToken: string;
  suggestedUsername: string;
}

/**
 * Purely additive: nothing in the app requires this service to have a user.
 * Guests keep joining/playing exactly as before — this only tracks optional
 * logged-in state for the header and the login/signup screens.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<PublicUser | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /** Set when a first-time Google sign-in is waiting on a chosen username (see /auth/google/complete). */
  readonly googleSignupPending = signal<GoogleSignupPending | null>(null);

  /** Set by authGuard when an unauthenticated visitor is redirected to `/` — tells AuthHeader to open the login panel. */
  readonly requestedLoginRedirect = signal(false);

  /**
   * Resolves once the initial session restore (a stored token -> GET
   * /auth/me on app init) has settled. authGuard awaits this before reading
   * `isAuthenticated()` — otherwise a fresh page load / deep link into a
   * guarded route races the guard against that still-in-flight request and
   * incorrectly bounces an actually-logged-in person back to `/`.
   */
  private readonly sessionReady: Promise<void>;

  constructor() {
    this.consumeGoogleRedirectToken();
    this.sessionReady = this.restoreSession();
  }

  async ensureSessionReady(): Promise<void> {
    await this.sessionReady;
  }

  async register(params: { username: string; email: string; password: string }): Promise<AuthResult> {
    return this.submitAuth('/auth/register', params);
  }

  async login(params: { email: string; password: string }): Promise<AuthResult> {
    return this.submitAuth('/auth/login', params);
  }

  async logout(): Promise<void> {
    const hadToken = !!getStoredToken();
    if (hadToken) {
      try {
        await firstValueFrom(this.http.post(`${environment.apiUrl}/auth/logout`, {}));
      } catch {
        // Best-effort — the client-side token is cleared below regardless.
      }
    }
    clearStoredToken();
    this.currentUser.set(null);
  }

  /**
   * Preflights /auth/google with `redirect: 'manual'` so an unconfigured
   * backend's 503 can be shown inline instead of the browser navigating to a
   * dead redirect. A configured backend responds with a 302 towards Google,
   * which `redirect: 'manual'` reports as an opaque redirect without
   * actually following it — only then do we do the real full-page navigation.
   */
  async startGoogleSignIn(): Promise<AuthResult> {
    try {
      const res = await fetch(`${environment.apiUrl}/auth/google`, { redirect: 'manual' });
      if (res.status === 503) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        return { ok: false, error: body?.error ?? 'Google sign-in is not configured yet.' };
      }
      window.location.href = `${environment.apiUrl}/auth/google`;
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
  }

  async completeGoogleSignup(username: string): Promise<AuthResult> {
    const pending = this.googleSignupPending();
    if (!pending) return { ok: false, error: 'This sign-up link has expired. Please try "Sign in with Google" again.' };
    const result = await this.submitAuth('/auth/google/complete', { pendingToken: pending.pendingToken, username });
    if (result.ok) this.googleSignupPending.set(null);
    return result;
  }

  getToken(): string | null {
    return getStoredToken();
  }

  private async submitAuth(path: string, body: unknown): Promise<AuthResult> {
    try {
      const res = await firstValueFrom(this.http.post<AuthResponse>(`${environment.apiUrl}${path}`, body));
      setStoredToken(res.token);
      this.currentUser.set(res.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err) };
    }
  }

  private async restoreSession(): Promise<void> {
    const token = getStoredToken();
    if (!token) return;
    try {
      const res = await firstValueFrom(this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`));
      this.currentUser.set(res.user);
    } catch {
      clearStoredToken();
    }
  }

  /**
   * Picks up whatever the Google OAuth callback redirect left in the URL
   * (see server design.md decision 6/8), then strips it. Two cases:
   *  - `?token=...` — a returning account, already logged in.
   *  - `?googlePendingToken=...&suggestedUsername=...` — a first-time
   *    sign-in that still needs a chosen username before the account exists.
   */
  private consumeGoogleRedirectToken(): void {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    const pendingToken = url.searchParams.get('googlePendingToken');
    const suggestedUsername = url.searchParams.get('suggestedUsername');

    if (token) {
      setStoredToken(token);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    } else if (pendingToken && suggestedUsername) {
      this.googleSignupPending.set({ pendingToken, suggestedUsername });
      url.searchParams.delete('googlePendingToken');
      url.searchParams.delete('suggestedUsername');
      window.history.replaceState({}, '', url.toString());
    }
  }
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: string } | undefined;
    if (body?.error) return body.error;
    if (err.status === 0) return 'Could not reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
