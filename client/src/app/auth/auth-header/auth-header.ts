import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AuthService } from '../auth.service';
import { Login } from '../login/login';
import { Signup } from '../signup/signup';
import { GoogleUsernameStep } from '../google-username-step/google-username-step';
import { PixelButton } from '../../shared/pixel-ui/pixel-button/pixel-button';

type AuthPanel = 'closed' | 'login' | 'signup' | 'google-username';

@Component({
  selector: 'app-auth-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Login, Signup, GoogleUsernameStep, PixelButton],
  templateUrl: './auth-header.html',
  styleUrl: './auth-header.scss'
})
export class AuthHeader {
  protected readonly authService = inject(AuthService);

  readonly panel = signal<AuthPanel>('closed');

  constructor() {
    // A first-time Google sign-in lands here from a full-page redirect (see
    // AuthService.consumeGoogleRedirectToken), not a button click — nothing
    // else opens this panel for that case, so it has to self-open.
    effect(() => {
      if (this.authService.googleSignupPending() && this.panel() === 'closed') {
        this.panel.set('google-username');
      }
    });

    // authGuard sets this when redirecting an unauthenticated visitor away
    // from a guarded route (see auth.guard.ts).
    effect(() => {
      if (this.authService.requestedLoginRedirect()) {
        this.panel.set('login');
        this.authService.requestedLoginRedirect.set(false);
      }
    });
  }

  openLogin(): void {
    this.panel.set('login');
  }

  openSignup(): void {
    this.panel.set('signup');
  }

  closePanel(): void {
    this.panel.set('closed');
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
