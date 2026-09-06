import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-pixel-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pixel-panel pixel-panel-content">
      @if (title(); as heading) {
        <h2 class="pixel-panel-title">{{ heading }}</h2>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .pixel-panel-content {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      box-sizing: border-box;
    }

    .pixel-panel-title {
      margin: 0;
      font-family: var(--font-display);
      font-size: 0.85rem;
      color: var(--ucab-paper);
    }
  `
})
export class PixelPanel {
  readonly title = input<string | null>(null);
}
