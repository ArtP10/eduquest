import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  viewChild
} from '@angular/core';
import Phaser from 'phaser';
import { SocketService } from '../core/socket.service';
import { JumperScene, WORLD_WIDTH, CANVAS_HEIGHT } from './jumper-scene';

const PROGRESS_REPORT_INTERVAL_MS = 500;

@Component({
  selector: 'app-phaser-board',
  template: `<div class="phaser-host" #host></div>`,
  styleUrl: './phaser-board.scss'
})
export class PhaserBoard implements AfterViewInit, OnDestroy {
  private readonly socketService = inject(SocketService);
  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private game: Phaser.Game | null = null;
  private scene: JumperScene | null = null;
  private latestProgress = 0;
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const phase = this.socketService.matchPhase();
      this.scene?.setFrozen(phase !== 'climbing');
    });

    effect(() => {
      const modifier = this.socketService.myModifier();
      const phase = this.socketService.matchPhase();
      if (phase === 'climbing') {
        this.scene?.setModifier(modifier);
      }
    });
  }

  ngAfterViewInit(): void {
    const scene = new JumperScene();
    scene.onProgress = (progress) => {
      this.latestProgress = progress;
    };
    // The `effect`s above may have already fired once with `this.scene`
    // still null (they run as soon as the component is constructed, which
    // happens before this lifecycle hook creates the scene) — so sync the
    // scene with the current signal values now, or it starts frozen and
    // never receives the phase it missed.
    scene.setFrozen(this.socketService.matchPhase() !== 'climbing');
    scene.setModifier(this.socketService.myModifier());
    this.scene = scene;

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      width: WORLD_WIDTH,
      height: CANVAS_HEIGHT,
      parent: this.hostRef().nativeElement,
      backgroundColor: '#0b1b24',
      pixelArt: true,
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false }
      },
      scene
    });

    this.progressTimer = setInterval(() => {
      this.socketService.reportClimbProgress(this.latestProgress);
    }, PROGRESS_REPORT_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.game?.destroy(true);
    this.game = null;
  }
}
