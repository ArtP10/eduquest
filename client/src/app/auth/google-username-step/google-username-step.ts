import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { AuthService } from '../auth.service';
import { PixelPanel } from '../../shared/pixel-ui/pixel-panel/pixel-panel';
import { PixelInput } from '../../shared/pixel-ui/pixel-input/pixel-input';
import { PixelButton } from '../../shared/pixel-ui/pixel-button/pixel-button';

@Component({
  selector: 'app-google-username-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PixelPanel, PixelInput, PixelButton],
  templateUrl: './google-username-step.html',
  styleUrl: './google-username-step.scss'
})
export class GoogleUsernameStep {
  private readonly authService = inject(AuthService);

  readonly close = output<void>();

  readonly username = signal(this.authService.googleSignupPending()?.suggestedUsername ?? '');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.busy() || !this.username().trim()) return;
    this.busy.set(true);
    this.error.set(null);
    const result = await this.authService.completeGoogleSignup(this.username().trim());
    this.busy.set(false);
    if (result.ok) {
      this.close.emit();
    } else {
      this.error.set(result.error);
    }
  }

  cancel(): void {
    // The Google account was never created — this just discards the pending
    // token. Signing in with Google again re-starts the flow cleanly.
    this.authService.googleSignupPending.set(null);
    this.close.emit();
  }
}
