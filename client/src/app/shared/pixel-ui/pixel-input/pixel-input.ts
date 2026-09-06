import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

let nextId = 0;

@Component({
  selector: 'app-pixel-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="pixel-input-field" [for]="id">
      <span class="pixel-input-label">{{ label() }}</span>
      <input
        [id]="id"
        class="pixel-input"
        [class.pixel-input--error]="!!error()"
        [type]="type()"
        [placeholder]="placeholder()"
        [value]="value()"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-invalid]="!!error() || null"
        [attr.aria-describedby]="error() ? id + '-error' : null"
        (input)="valueChange.emit($any($event.target).value)"
      />
      @if (error(); as message) {
        <span class="pixel-input-error" [id]="id + '-error'">{{ message }}</span>
      }
    </label>
  `,
  styles: `
    :host {
      display: block;
    }

    .pixel-input-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .pixel-input-label {
      font-family: var(--font-body);
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--ucab-paper-dim);
    }

    .pixel-input-error {
      font-family: var(--font-body);
      font-size: 0.75rem;
      color: var(--danger);
    }
  `
})
export class PixelInput {
  readonly id = `pixel-input-${nextId++}`;

  readonly label = input.required<string>();
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly placeholder = input('');
  readonly value = input('');
  readonly error = input<string | null>(null);
  readonly autocomplete = input<string | null>(null);

  readonly valueChange = output<string>();
}
