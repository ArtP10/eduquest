import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SocketService } from '../core/socket.service';
import { Lobby } from '../lobby/lobby';
import { Match } from '../match/match';
import { Leaderboard } from '../leaderboard/leaderboard';

/**
 * Everything the app did at `/` before routing existed — unchanged
 * behaviorally, just moved out of `App` so the root route has a component
 * to render alongside the new guarded quiz-builder routes (see design.md
 * decision 10). `App` keeps the persistent header.
 */
@Component({
  selector: 'app-home',
  imports: [Lobby, Match, Leaderboard, DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  protected readonly socketService = inject(SocketService);
}
