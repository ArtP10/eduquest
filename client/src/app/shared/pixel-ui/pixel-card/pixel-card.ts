import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-pixel-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="pixel-card" (click)="select.emit()">
      <span class="pixel-card-title">{{ title() }}</span>
      @if (tags().length > 0) {
        <span class="pixel-card-tags">
          @for (tag of tags(); track tag) {
            <span class="pixel-card-tag">{{ tag }}</span>
          }
        </span>
      }
      @if (averageGrade(); as grade) {
        <span class="pixel-card-average">Promedio: {{ grade }}/100</span>
      }
      <span class="pixel-card-meta">
        <span class="pixel-card-author">{{ author() }}</span>
        <span class="pixel-card-stats">
          <span>{{ questionCount() }} preg.</span>
          <span>&#9654; {{ playCount() }}</span>
        </span>
      </span>
    </button>
  `,
  styles: `
    :host {
      display: block;
    }

    .pixel-card {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      width: 100%;
      height: 100%;
      padding: 1rem;
      text-align: left;
      cursor: pointer;
      font-family: var(--font-body);
      background: var(--ucab-ink-2);
      border: var(--pixel-border) solid var(--ucab-blue);
      border-radius: 0;
      color: var(--ucab-paper);
      box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ucab-ink);
      transition: none;

      &:hover {
        border-color: var(--ucab-gold);
      }

      &:active {
        transform: translate(var(--shadow-offset), var(--shadow-offset));
        box-shadow: 0 0 0 var(--ucab-ink);
      }

      &:focus-visible {
        outline: 3px solid var(--ucab-paper);
        outline-offset: 2px;
      }
    }

    .pixel-card-title {
      font-family: var(--font-display);
      font-size: 0.8rem;
      line-height: 1.4;
      color: var(--ucab-paper);
    }

    .pixel-card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .pixel-card-tag {
      padding: 0.15rem 0.5rem;
      background: var(--ucab-ink-3);
      color: var(--ucab-blue);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .pixel-card-meta {
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--ucab-paper-dim);
    }

    .pixel-card-author {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pixel-card-stats {
      display: flex;
      gap: 0.6rem;
      flex-shrink: 0;
      color: var(--ucab-gold);
    }

    .pixel-card-average {
      font-size: 0.7rem;
      color: var(--ucab-gold);
    }
  `
})
export class PixelCard {
  readonly title = input.required<string>();
  readonly author = input.required<string>();
  readonly questionCount = input.required<number>();
  readonly playCount = input.required<number>();
  readonly tags = input<string[]>([]);
  readonly averageGrade = input<number | null>(null);

  readonly select = output<void>();
}
