import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../core/socket.service';
import { PixelIcon } from '../shared/pixel-icon';
import { RoomCreationState } from '../quiz-library/room-creation-state';

@Component({
  selector: 'app-lobby',
  imports: [FormsModule, PixelIcon],
  templateUrl: './lobby.html',
  styleUrl: './lobby.scss'
})
export class Lobby {
  protected readonly socketService = inject(SocketService);
  private readonly roomCreationState = inject(RoomCreationState);

  protected readonly displayName = signal('');
  protected readonly joinCode = signal(this.codeFromInviteUrl());
  protected readonly busy = signal(false);

  private codeFromInviteUrl(): string {
    const match = window.location.pathname.match(/\/join\/([A-Za-z0-9]{6})/);
    return match ? match[1].toUpperCase() : '';
  }

  /** Carries the display name into the Quiz Library — room creation itself now happens there once a card is picked (see RoomCreationState). */
  protected createRoom(): void {
    if (!this.displayName().trim()) return;
    this.roomCreationState.startCreatingRoom(this.displayName().trim());
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
