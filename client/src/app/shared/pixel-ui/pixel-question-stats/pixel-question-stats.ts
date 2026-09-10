import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface QuestionStatRow {
  questionIndex: number;
  percentCorrect: number;
  correctCount: number;
  totalCount: number;
}

@Component({
  selector: 'app-pixel-question-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="pixel-question-stats">
      @for (row of rows(); track row.questionIndex) {
        <li class="stat-row">
          <span class="stat-label">Pregunta {{ row.questionIndex + 1 }}</span>
          <span class="stat-bar-track" role="img" [attr.aria-label]="row.percentCorrect + '% correcto'">
            <span class="stat-bar-fill" [style.width.%]="row.percentCorrect"></span>
          </span>
          <span class="stat-figures">{{ row.percentCorrect }}% ({{ row.correctCount }}/{{ row.totalCount }})</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .pixel-question-stats {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .stat-row {
      display: grid;
      grid-template-columns: minmax(5.5rem, auto) 1fr minmax(6rem, auto);
      align-items: center;
      gap: 0.6rem;
      font-size: 0.75rem;
      color: var(--ucab-paper);
    }

    .stat-label {
      white-space: nowrap;
    }

    .stat-bar-track {
      display: block;
      height: 0.9rem;
      background: var(--ucab-ink-3);
      border: 2px solid var(--ucab-ink);
    }

    .stat-bar-fill {
      display: block;
      height: 100%;
      background: var(--ucab-gold);
    }

    .stat-figures {
      text-align: right;
      color: var(--ucab-paper-dim);
      white-space: nowrap;
    }
  `
})
export class PixelQuestionStats {
  readonly rows = input.required<QuestionStatRow[]>();
}
