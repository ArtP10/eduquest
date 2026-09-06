import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { QuizBuilderService, type QuizSummary } from '../quiz-builder.service';
import { PixelPanel } from '../../shared/pixel-ui/pixel-panel/pixel-panel';
import { PixelInput } from '../../shared/pixel-ui/pixel-input/pixel-input';
import { PixelButton } from '../../shared/pixel-ui/pixel-button/pixel-button';

@Component({
  selector: 'app-my-quizzes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PixelPanel, PixelInput, PixelButton],
  templateUrl: './my-quizzes.html',
  styleUrl: './my-quizzes.scss'
})
export class MyQuizzes {
  private readonly quizBuilderService = inject(QuizBuilderService);
  private readonly router = inject(Router);

  readonly quizzes = signal<QuizSummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly newTitle = signal('');
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.quizzes.set(await this.quizBuilderService.listMine());
      this.loadError.set(null);
    } catch {
      this.loadError.set('Could not load your quizzes. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async createQuiz(): Promise<void> {
    if (this.creating() || !this.newTitle().trim()) return;
    this.creating.set(true);
    this.createError.set(null);
    const result = await this.quizBuilderService.createQuiz(this.newTitle().trim());
    this.creating.set(false);
    if (result.ok) {
      void this.router.navigate(['/quizzes', result.data.id]);
    } else {
      this.createError.set(result.error);
    }
  }
}
