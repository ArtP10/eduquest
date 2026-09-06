const TOKEN_STORAGE_KEY = 'quizjumper_token';

// Standalone (no AuthService dependency) so the HTTP interceptor can read it
// without injecting AuthService — doing so from the interceptor caused a
// re-entrant DI call while AuthService's own constructor was still issuing
// its initial /auth/me request, which silently failed and looked like the
// stored token had disappeared on reload.
export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage unavailable (e.g. private browsing) — session just won't persist.
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
