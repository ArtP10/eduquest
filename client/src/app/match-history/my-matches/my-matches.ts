import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatchHistoryService, type MatchSummary } from '../match-history.service';
import { PixelPanel } from '../../shared/pixel-ui/pixel-panel/pixel-panel';

@Component({
  selector: 'app-my-matches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, PixelPanel],
  templateUrl: './my-matches.html',
  styleUrl: './my-matches.scss'
})
export class MyMatches {
  private readonly matchHistoryService = inject(MatchHistoryService);

  readonly matches = signal<MatchSummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.matches.set(await this.matchHistoryService.listMine());
      this.loadError.set(null);
    } catch {
      this.loadError.set('No se pudo cargar tu historial de partidas. Por favor, intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
