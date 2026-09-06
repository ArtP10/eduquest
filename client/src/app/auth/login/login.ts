import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { AuthService } from '../auth.service';
import { PixelPanel } from '../../shared/pixel-ui/pixel-panel/pixel-panel';
import { PixelInput } from '../../shared/pixel-ui/pixel-input/pixel-input';
import { PixelButton } from '../../shared/pixel-ui/pixel-button/pixel-button';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PixelPanel, PixelInput, PixelButton],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private readonly authService = inject(AuthService);

  readonly switchToSignup = output<void>();
  readonly close = output<void>();

  readonly email = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.busy() || !this.email().trim() || !this.password()) return;
    this.busy.set(true);
    this.error.set(null);
    const result = await this.authService.login({ email: this.email().trim(), password: this.password() });
    this.busy.set(false);
    if (result.ok) {
      this.close.emit();
    } else {
      this.error.set(result.error);
    }
  }

  async signInWithGoogle(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const result = await this.authService.startGoogleSignIn();
    if (!result.ok) {
      this.error.set(result.error);
      this.busy.set(false);
    }
    // On success the browser is already navigating away — no need to reset busy.
  }
}
