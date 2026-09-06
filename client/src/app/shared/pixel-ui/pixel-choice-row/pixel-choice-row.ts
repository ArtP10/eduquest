import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PixelIcon } from '../../pixel-icon';

let nextId = 0;

/**
 * One choice in a 4-choice question editor: a "mark as correct" toggle
 * (reusing the existing `correct` PixelIcon rather than inventing new radio
 * styling) plus the choice's text input. The parent owns which one of the
 * four rows is correct (`checked`) — this component only reports intent
 * via `checkedChange`, it doesn't enforce single-selection itself.
 */
@Component({
  selector: 'app-pixel-choice-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PixelIcon],
  template: `
    <div class="pixel-choice-row">
      <button
        type="button"
        class="pixel-choice-mark"
        [class.pixel-choice-mark--checked]="checked()"
        [attr.aria-pressed]="checked()"
        [attr.aria-label]="'Marcar ' + label() + ' como correcta'"
        (click)="checkedChange.emit(true)"
      >
        @if (checked()) {
          <app-pixel-icon name="correct" [size]="14" />
        }
      </button>
      <label class="pixel-choice-label" [for]="id">
        <span class="visually-hidden">{{ label() }}</span>
        <input
          [id]="id"
          class="pixel-input"
          [placeholder]="placeholder()"
          [value]="value()"
          (input)="valueChange.emit($any($event.target).value)"
        />
      </label>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .pixel-choice-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .pixel-choice-label {
      flex: 1;
      min-width: 0;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    .pixel-choice-mark {
      flex-shrink: 0;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--ucab-ink);
      border: 3px solid var(--ucab-blue);
      border-radius: 0;
      color: var(--ucab-green);
      cursor: pointer;

      &:focus-visible {
        outline: 3px solid var(--ucab-gold);
        outline-offset: 2px;
      }
    }

    .pixel-choice-mark--checked {
      background: var(--ucab-ink-3);
      border-color: var(--ucab-green);
    }
  `
})
export class PixelChoiceRow {
  readonly id = `pixel-choice-row-${nextId++}`;

  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly value = input('');
  readonly checked = input(false);

  readonly valueChange = output<string>();
  readonly checkedChange = output<boolean>();
}
