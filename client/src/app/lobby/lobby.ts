import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../core/socket.service';
import { PixelIcon } from '../shared/pixel-icon';
import { QuizBuilderService, type AvailableQuiz } from '../quiz-builder/quiz-builder.service';

@Component({
  selector: 'app-lobby',
  imports: [FormsModule, PixelIcon],
  templateUrl: './lobby.html',
  styleUrl: './lobby.scss'
})
export class Lobby {
  protected readonly socketService = inject(SocketService);
  private readonly quizBuilderService = inject(QuizBuilderService);

  protected readonly displayName = signal('');
  protected readonly joinCode = signal(this.codeFromInviteUrl());
  protected readonly busy = signal(false);

  // Empty string = "no selection" -> server picks a random mock quiz,
  // exactly today's default behavior (see shared/events.ts RoomCreateRequest.quizId).
  protected readonly availableQuizzes = signal<AvailableQuiz[]>([]);
  protected readonly selectedQuizId = signal('');

  constructor() {
    void this.loadAvailableQuizzes();
  }

  private async loadAvailableQuizzes(): Promise<void> {
    try {
      this.availableQuizzes.set(await this.quizBuilderService.listAvailable());
    } catch {
      // Non-critical for the guest flow — the picker just stays empty and
      // room creation still works via the random-quiz fallback.
    }
  }

  private codeFromInviteUrl(): string {
    const match = window.location.pathname.match(/\/join\/([A-Za-z0-9]{6})/);
    return match ? match[1].toUpperCase() : '';
  }

  protected async createRoom(): Promise<void> {
    if (!this.displayName().trim()) return;
    this.busy.set(true);
    await this.socketService.createRoom(this.displayName().trim(), this.selectedQuizId() || undefined);
    this.busy.set(false);
  }

  protected async joinRoom(): Promise<void> {
    if (!this.displayName().trim() || !this.joinCode().trim()) return;
    this.busy.set(true);
    await this.socketService.joinRoom(this.joinCode().trim().toUpperCase(), this.displayName().trim());
    this.busy.set(false);
  }

  protected async startMatch(): Promise<void> {
    this.busy.set(true);
    await this.socketService.startMatch();
    this.busy.set(false);
  }
}
