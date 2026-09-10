import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { QuizBuilderService } from '../quiz-builder.service';
import { PixelPanel } from '../../shared/pixel-ui/pixel-panel/pixel-panel';
import { PixelButton } from '../../shared/pixel-ui/pixel-button/pixel-button';

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 50;
const STEP = 5;
const DEFAULT_QUESTIONS = 10;

@Component({
  selector: 'app-generate-quiz',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PixelPanel, PixelButton],
  templateUrl: './generate-quiz.html',
  styleUrl: './generate-quiz.scss'
})
export class GenerateQuiz {
  private readonly quizBuilderService = inject(QuizBuilderService);
  private readonly router = inject(Router);

  readonly minQuestions = MIN_QUESTIONS;
  readonly maxQuestions = MAX_QUESTIONS;
  readonly step = STEP;

  readonly selectedFile = signal<File | null>(null);
  readonly questionCount = signal(DEFAULT_QUESTIONS);
  readonly generating = signal(false);
  readonly error = signal<string | null>(null);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  onQuestionCountInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.questionCount.set(value);
  }

  canSubmit(): boolean {
    return !this.generating() && !!this.selectedFile();
  }

  async generate(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.generating()) return;

    this.generating.set(true);
    this.error.set(null);

    const result = await this.quizBuilderService.generateFromPdf(file, this.questionCount());

    if (result.ok) {
      void this.router.navigate(['/quizzes', result.data.id]);
      return;
    }

    this.generating.set(false);
    this.error.set(result.error);
  }

  tryAgain(): void {
    this.error.set(null);
  }
}
