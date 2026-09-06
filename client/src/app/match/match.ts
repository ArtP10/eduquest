import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { SocketService } from '../core/socket.service';
import { PhaserBoard } from './phaser-board';
import { PixelIcon } from '../shared/pixel-icon';

@Component({
  selector: 'app-match',
  imports: [PhaserBoard, PixelIcon],
  templateUrl: './match.html',
  styleUrl: './match.scss'
})
export class Match implements OnInit, OnDestroy {
  protected readonly socketService = inject(SocketService);

  private readonly now = signal(Date.now());
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  protected readonly secondsLeft = computed(() => {
    const endsAt = this.socketService.phaseEndsAt();
    if (!endsAt) return 0;
    return Math.max(0, Math.ceil((endsAt - this.now()) / 1000));
  });

  // What the countdown is actually counting down to — shown next to the
  // clock so it never just reads as a bare number with no context.
  protected readonly nextActionLabel = computed(() => {
    switch (this.socketService.matchPhase()) {
      case 'climbing':
        return 'Pregunta en';
      case 'frozen':
        return 'Resultados en';
      case 'results': {
        const isLastQuestion = this.socketService.questionIndex() + 1 >= this.socketService.totalQuestions();
        return isLastQuestion ? 'Resultados finales en' : 'Siguiente subida en';
      }
      default:
        return '';
    }
  });

  protected readonly selectedChoice = signal<number | null>(null);
  protected readonly hasSubmitted = signal(false);

  constructor() {
    effect(() => {
      // A new question started: clear the previous answer selection.
      this.socketService.questionIndex();
      this.socketService.matchPhase();
      if (this.socketService.matchPhase() === 'climbing') {
        this.selectedChoice.set(null);
        this.hasSubmitted.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.tickHandle = setInterval(() => this.now.set(Date.now()), 250);
  }

  ngOnDestroy(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
  }

  protected async selectChoice(index: number): Promise<void> {
    if (this.hasSubmitted() || this.socketService.matchPhase() !== 'frozen') return;
    this.selectedChoice.set(index);
    this.hasSubmitted.set(true);
    await this.socketService.submitAnswer(index);
  }

  protected resultFor(index: number): 'correct' | 'incorrect' | null {
    const correctIndex = this.socketService.lastCorrectIndex();
    if (correctIndex === null) return null;
    if (index === correctIndex) return 'correct';
    if (index === this.selectedChoice()) return 'incorrect';
    return null;
  }
}
