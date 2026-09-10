import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PixelIcon } from './shared/pixel-icon';
import { AuthHeader } from './auth/auth-header/auth-header';
import { SocketService } from './core/socket.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, PixelIcon, AuthHeader],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly socketService = inject(SocketService);

  protected readonly inActiveMatch = () =>
    !!this.socketService.roomCode() &&
    this.socketService.matchPhase() !== 'lobby' &&
    this.socketService.matchPhase() !== 'ended';
}
