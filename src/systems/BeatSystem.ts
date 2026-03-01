import { Scene } from 'phaser';

const BPM = 120;
const BEAT_INTERVAL = 60000 / BPM; // 500ms per beat
const ON_BEAT_WINDOW = 80; // ±80ms for on-beat bonus

export class BeatSystem {
  private _scene: Scene;
  private _elapsed = 0;
  private _lastBeatTime = 0;
  private _beatCount = 0;
  private _borderFlash: Phaser.GameObjects.Graphics;

  constructor(scene: Scene) {
    this._scene = scene;
    this._borderFlash = scene.add.graphics().setDepth(50);
  }

  get beatCount(): number {
    return this._beatCount;
  }

  update(delta: number): void {
    this._elapsed += delta;

    if (this._elapsed - this._lastBeatTime >= BEAT_INTERVAL) {
      this._lastBeatTime = this._elapsed;
      this._beatCount++;
      this._scene.events.emit('beat', this._beatCount);
      this._flashBorder();
    }
  }

  /** Check if a timestamp (relative to elapsed) is within ±80ms of a beat */
  isOnBeat(): boolean {
    const timeSinceBeat = this._elapsed - this._lastBeatTime;
    const timeToNextBeat = BEAT_INTERVAL - timeSinceBeat;
    return timeSinceBeat <= ON_BEAT_WINDOW || timeToNextBeat <= ON_BEAT_WINDOW;
  }

  /** Returns true every Nth beat */
  isNthBeat(n: number): boolean {
    return this._beatCount % n === 0;
  }

  private _flashBorder(): void {
    const gfx = this._borderFlash;
    gfx.clear();
    gfx.lineStyle(3, 0xff33ff, 0.6);
    gfx.strokeRect(2, 2, 956, 636);

    this._scene.tweens.add({
      targets: { alpha: 0.6 },
      alpha: 0,
      duration: 200,
      onUpdate: (_tween: Phaser.Tweens.Tween, target: { alpha: number }) => {
        gfx.clear();
        gfx.lineStyle(3, 0xff33ff, target.alpha);
        gfx.strokeRect(2, 2, 956, 636);
      },
      onComplete: () => gfx.clear(),
    });
  }

  cleanup(): void {
    this._borderFlash?.destroy();
  }
}
