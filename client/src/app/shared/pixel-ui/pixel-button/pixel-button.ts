import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type PixelButtonVariant = 'primary' | 'secondary';
export type PixelButtonSize = 'default' | 'compact';

@Component({
  selector: 'app-pixel-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="pixel-button"
      [class.pixel-button--secondary]="variant() === 'secondary'"
      [class.pixel-button--compact]="size() === 'compact'"
      [type]="type()"
      [disabled]="disabled()"
    >
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }

    // Scoped here (not the shared .pixel-button base in styles.scss) since
    // it's an opt-in variant, not the default every button should get —
    // e.g. a small icon-only close "✕" button drowning in the same padding
    // as a full-width form submit button.
    .pixel-button--compact {
      padding: 0.4rem 0.6rem;
      font-size: 0.75rem;
    }
  `
})
export class PixelButton {
  readonly variant = input<PixelButtonVariant>('primary');
  readonly size = input<PixelButtonSize>('default');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
}
