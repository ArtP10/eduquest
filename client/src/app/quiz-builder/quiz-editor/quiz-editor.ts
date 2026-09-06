import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { QuizBuilderService, type QuestionSummary, type QuizSummary } from '../quiz-builder.service';
import { PixelPanel } from '../../shared/pixel-ui/pixel-panel/pixel-panel';
import { PixelInput } from '../../shared/pixel-ui/pixel-input/pixel-input';
import { PixelButton } from '../../shared/pixel-ui/pixel-button/pixel-button';
import { PixelChoiceRow } from '../../shared/pixel-ui/pixel-choice-row/pixel-choice-row';
import { PixelIcon } from '../../shared/pixel-icon';

type QuestionEditTarget = { kind: 'new' } | { kind: 'edit'; id: string };

const EMPTY_CHOICES: [string, string, string, string] = ['', '', '', ''];

@Component({
  selector: 'app-quiz-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet, PixelPanel, PixelInput, PixelButton, PixelChoiceRow, PixelIcon],
  templateUrl: './quiz-editor.html',
  styleUrl: './quiz-editor.scss'
})
export class QuizEditor {
  private readonly quizBuilderService = inject(QuizBuilderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly quizId = this.route.snapshot.paramMap.get('id')!;

  readonly quiz = signal<QuizSummary | null>(null);
  readonly questions = signal<QuestionSummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly notFound = signal(false);

  readonly titleDraft = signal('');
  readonly savingTitle = signal(false);
  readonly titleError = signal<string | null>(null);
  readonly publishing = signal(false);
  readonly publishError = signal<string | null>(null);

  readonly editTarget = signal<QuestionEditTarget | null>(null);
  readonly formQuestionText = signal('');
  readonly formChoices = signal<[string, string, string, string]>([...EMPTY_CHOICES]);
  readonly formCorrectChoice = signal<0 | 1 | 2 | 3>(0);
  readonly formBusy = signal(false);
  readonly formError = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.quizBuilderService.getQuiz(this.quizId);
      if (!result) {
        this.notFound.set(true);
      } else {
        this.quiz.set(result.quiz);
        this.questions.set(result.questions);
        this.titleDraft.set(result.quiz.title);
      }
    } catch {
      this.loadError.set('Could not load this quiz. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async saveDraft(): Promise<void> {
    if (this.savingTitle() || !this.titleDraft().trim()) return;
    this.savingTitle.set(true);
    this.titleError.set(null);
    const result = await this.quizBuilderService.updateQuiz(this.quizId, { title: this.titleDraft().trim() });
    this.savingTitle.set(false);
    if (result.ok) {
      this.quiz.set(result.data);
    } else {
      this.titleError.set(result.error);
    }
  }

  async publish(): Promise<void> {
    if (this.publishing()) return;
    this.publishing.set(true);
    this.publishError.set(null);
    // Publishing also carries whatever title is currently in the field, so
    // an edited-but-unsaved title isn't silently lost on publish.
    const result = await this.quizBuilderService.updateQuiz(this.quizId, {
      title: this.titleDraft().trim() || undefined,
      status: 'published'
    });
    this.publishing.set(false);
    if (result.ok) {
      this.quiz.set(result.data);
    } else {
      this.publishError.set(result.error);
    }
  }

  startAddQuestion(): void {
    this.editTarget.set({ kind: 'new' });
    this.formQuestionText.set('');
    this.formChoices.set([...EMPTY_CHOICES]);
    this.formCorrectChoice.set(0);
    this.formError.set(null);
  }

  startEditQuestion(question: QuestionSummary): void {
    this.editTarget.set({ kind: 'edit', id: question.id });
    this.formQuestionText.set(question.questionText);
    this.formChoices.set([...question.choices]);
    this.formCorrectChoice.set(question.correctChoice);
    this.formError.set(null);
  }

  isEditingQuestion(id: string): boolean {
    const target = this.editTarget();
    return target?.kind === 'edit' && target.id === id;
  }

  isAddingQuestion(): boolean {
    return this.editTarget()?.kind === 'new';
  }

  cancelQuestionForm(): void {
    this.editTarget.set(null);
    this.formError.set(null);
  }

  setChoice(index: 0 | 1 | 2 | 3, value: string): void {
    const next = [...this.formChoices()] as [string, string, string, string];
    next[index] = value;
    this.formChoices.set(next);
  }

  async saveQuestionForm(): Promise<void> {
    const target = this.editTarget();
    if (!target || this.formBusy()) return;

    this.formBusy.set(true);
    this.formError.set(null);
    const input = {
      questionText: this.formQuestionText().trim(),
      choices: this.formChoices(),
      correctChoice: this.formCorrectChoice()
    };

    const result =
      target.kind === 'new'
        ? await this.quizBuilderService.addQuestion(this.quizId, input)
        : await this.quizBuilderService.updateQuestion(target.id, input);
    this.formBusy.set(false);

    if (!result.ok) {
      this.formError.set(result.error);
      return;
    }

    if (target.kind === 'new') {
      this.questions.set([...this.questions(), result.data]);
    } else {
      this.questions.set(this.questions().map((q) => (q.id === target.id ? result.data : q)));
    }
    this.editTarget.set(null);
  }

  async deleteQuestion(question: QuestionSummary): Promise<void> {
    const result = await this.quizBuilderService.deleteQuestion(question.id);
    if (result.ok) {
      this.questions.set(this.questions().filter((q) => q.id !== question.id));
    }
  }

  goToMyQuizzes(): void {
    void this.router.navigate(['/quizzes']);
  }
}
