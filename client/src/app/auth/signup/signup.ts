import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { AuthService } from '../auth.service';
import { PixelPanel } from '../../shared/pixel-ui/pixel-panel/pixel-panel';
import { PixelInput } from '../../shared/pixel-ui/pixel-input/pixel-input';
import { PixelButton } from '../../shared/pixel-ui/pixel-button/pixel-button';

@Component({
  selector: 'app-signup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PixelPanel, PixelInput, PixelButton],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class Signup {
  private readonly authService = inject(AuthService);

  readonly switchToLogin = output<void>();
  readonly close = output<void>();

  readonly username = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  get canSubmit(): boolean {
    return !this.busy() && !!this.username().trim() && !!this.email().trim() && this.password().length >= 8;
  }

  async submit(): Promise<void> {
    if (!this.canSubmit) return;
    this.busy.set(true);
    this.error.set(null);
    const result = await this.authService.register({
      username: this.username().trim(),
      email: this.email().trim(),
      password: this.password()
    });
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
