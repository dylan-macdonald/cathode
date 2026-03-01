import { Scene } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CSS_PHOSPHOR_GREEN } from '../utils/constants';
import { playSFX } from '../audio/SFXGenerator';

export class CreditsScene extends Scene {
  private _scrollY = 0;
  private _textGroup: Phaser.GameObjects.Text[] = [];
  private _done = false;

  constructor() {
    super({ key: 'CreditsScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x050a05);
    this.cameras.main.setPostPipeline('CRTPipeline');

    // Scanlines
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH, 1, 0x000000, 0.12);
    }

    // Noise background
    const noiseGfx = this.add.graphics();
    this.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        noiseGfx.clear();
        for (let i = 0; i < 30; i++) {
          noiseGfx.fillStyle(0x33ff33, Math.random() * 0.03);
          noiseGfx.fillRect(
            Phaser.Math.Between(0, GAME_WIDTH),
            Phaser.Math.Between(0, GAME_HEIGHT),
            Phaser.Math.Between(1, 3), 1,
          );
        }
      },
    });

    // Credit lines
    const lines = [
      { text: 'CATHODE', size: '48px', color: CSS_PHOSPHOR_GREEN, gap: 30 },
      { text: 'LAST SIGNAL', size: '18px', color: '#557755', gap: 60 },
      { text: 'A CRT ROGUELIKE EXPERIENCE', size: '14px', color: '#888888', gap: 50 },
      { text: '— — —', size: '14px', color: '#333333', gap: 40 },
      { text: 'DESIGN & PROGRAMMING', size: '12px', color: '#557755', gap: 20 },
      { text: 'Built with Phaser 3', size: '14px', color: '#aaaaaa', gap: 40 },
      { text: 'AUDIO', size: '12px', color: '#557755', gap: 20 },
      { text: 'Sound effects: jsfxr', size: '14px', color: '#aaaaaa', gap: 20 },
      { text: 'Music: Web Audio API', size: '14px', color: '#aaaaaa', gap: 40 },
      { text: 'RENDERING', size: '12px', color: '#557755', gap: 20 },
      { text: 'All sprites procedurally generated', size: '14px', color: '#aaaaaa', gap: 20 },
      { text: 'CRT shader pipeline', size: '14px', color: '#aaaaaa', gap: 40 },
      { text: 'TOOLS', size: '12px', color: '#557755', gap: 20 },
      { text: 'TypeScript • Vite • Phaser 3', size: '14px', color: '#aaaaaa', gap: 40 },
      { text: '— — —', size: '14px', color: '#333333', gap: 40 },
      { text: 'THANKS FOR PLAYING', size: '20px', color: CSS_PHOSPHOR_GREEN, gap: 30 },
      { text: 'Stay tuned.', size: '14px', color: '#557755', gap: 80 },
    ];

    let yPos = GAME_HEIGHT + 40; // start below screen
    for (const line of lines) {
      const txt = this.add.text(GAME_WIDTH / 2, yPos, line.text, {
        fontFamily: 'monospace',
        fontSize: line.size,
        color: line.color,
      }).setOrigin(0.5);
      this._textGroup.push(txt);
      yPos += line.gap;
    }

    this._scrollY = 0;
    this._done = false;

    // Any key / click returns to title
    this.time.delayedCall(1000, () => {
      this.input.keyboard!.on('keydown', () => this._exit());
      this.input.on('pointerdown', () => this._exit());
    });

    this.cameras.main.fadeIn(500);
  }

  update(_time: number, delta: number): void {
    if (this._done) return;

    const speed = 0.04; // pixels per ms
    this._scrollY += speed * delta;

    for (const txt of this._textGroup) {
      txt.y -= speed * delta;
    }

    // Auto-exit when last text scrolls off the top
    const lastText = this._textGroup[this._textGroup.length - 1];
    if (lastText && lastText.y < -40) {
      this._exit();
    }
  }

  private _exit(): void {
    if (this._done) return;
    this._done = true;
    playSFX('menu_select');
    this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) this.scene.start('MenuScene');
    });
  }
}
