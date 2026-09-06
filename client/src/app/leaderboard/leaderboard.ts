import { Component, inject } from '@angular/core';
import { SocketService } from '../core/socket.service';
import { PixelIcon } from '../shared/pixel-icon';

@Component({
  selector: 'app-leaderboard',
  imports: [PixelIcon],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss'
})
export class Leaderboard {
  protected readonly socketService = inject(SocketService);
}
