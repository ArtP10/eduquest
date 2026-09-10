import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../core/socket.service';

/**
 * Carries the display name entered in the Lobby across the navigation into
 * `/library` and back, and performs the actual room-creation call once a
 * card is picked there. A small injectable service is simpler than routing
 * a free-text display name through the URL and doesn't need a heavier
 * state-management dependency for two fields (see design.md decision 6).
 */
@Injectable({ providedIn: 'root' })
export class RoomCreationState {
  private readonly socketService = inject(SocketService);
  private readonly router = inject(Router);

  readonly pendingDisplayName = signal('');

  startCreatingRoom(displayName: string): void {
    this.pendingDisplayName.set(displayName);
    void this.router.navigate(['/library']);
  }

  async createRoomWithQuiz(quizId: string | undefined): Promise<void> {
    const displayName = this.pendingDisplayName().trim();
    if (!displayName) {
      void this.router.navigate(['/']);
      return;
    }
    await this.socketService.createRoom(displayName, quizId);
    void this.router.navigate(['/']);
  }
}
