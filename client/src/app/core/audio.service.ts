import { Injectable } from '@angular/core';

export type SoundKey = 'lobby-song' | 'game-song' | 'jump-sound' | 'success-sound' | 'error-sound';

const SOUND_FILES: Record<SoundKey, string> = {
  'lobby-song': 'sound/lobby-song.mp3',
  'game-song': 'sound/game-song.mp3',
  'jump-sound': 'sound/jump-sound.mp3',
  'success-sound': 'sound/success-sound.mp3',
  'error-sound': 'sound/error-sound.mp3'
};

const MUSIC_VOLUME = 0.35;
const SFX_VOLUME = 0.7;

/**
 * Thin wrapper over native `HTMLAudioElement`s — one per sound key, created
 * lazily and reused (so a looping track isn't restarted by getting a new
 * element). Play calls made before any user gesture are silently rejected by
 * the browser's autoplay policy; rather than losing that sound, it's retried
 * once on the next pointerdown anywhere on the page.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly elements = new Map<SoundKey, HTMLAudioElement>();

  private element(key: SoundKey): HTMLAudioElement {
    let el = this.elements.get(key);
    if (!el) {
      el = new Audio(SOUND_FILES[key]);
      this.elements.set(key, el);
    }
    return el;
  }

  /** One-shot sound effect — restarts from the beginning even if still playing, so rapid triggers (e.g. quick jumps) retrigger rather than queue. */
  play(key: SoundKey): void {
    const el = this.element(key);
    el.loop = false;
    el.volume = SFX_VOLUME;
    el.currentTime = 0;
    this.attemptPlay(el);
  }

  /** Starts looping background music. No-op if this key is already looping and playing. */
  loop(key: SoundKey): void {
    const el = this.element(key);
    if (el.loop && !el.paused) return;
    el.loop = true;
    el.volume = MUSIC_VOLUME;
    this.attemptPlay(el);
  }

  stopLoop(key: SoundKey): void {
    const el = this.elements.get(key);
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }

  private attemptPlay(el: HTMLAudioElement): void {
    el.play().catch(() => {
      const retry = () => void el.play().catch(() => {});
      document.addEventListener('pointerdown', retry, { once: true });
    });
  }
}
