import { Scene } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CSS_PHOSPHOR_GREEN, CSS_HOT_WHITE } from '../utils/constants';
import { playSFX } from '../audio/SFXGenerator';

export class MenuScene extends Scene {
  private _attractTimer: Phaser.Time.TimerEvent | null = null;
  private _navigating = false;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this._navigating = false;
    this.cameras.main.setBackgroundColor(0x0a0a0a);

    // Apply CRT shader if available
    const pipeline = this.cameras.main.getPostPipeline('CRTPipeline');
    if (!pipeline) {
      this.cameras.main.setPostPipeline('CRTPipeline');
    }

    // Title
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, 'CATHODE', {
      fontFamily: 'monospace',
      fontSize: '72px',
      color: CSS_PHOSPHOR_GREEN,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: CSS_PHOSPHOR_GREEN,
        blur: 20,
        fill: true,
      },
    });
    title.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.42, 'LAST SIGNAL', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#666666',
    });
    subtitle.setOrigin(0.5);

    // Scanline decoration
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH, 1, 0x000000, 0.15);
    }

    // Start prompt
    const startText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.62, '[ PRESS ENTER OR CLICK TO START ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: CSS_HOT_WHITE,
    });
    startText.setOrigin(0.5);

    // Blink
    this.tweens.add({
      targets: startText,
      alpha: { from: 1, to: 0.2 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Repair Shop prompt
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.70, '[ R — REPAIR SHOP ]', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#557755',
    }).setOrigin(0.5);

    // Credits prompt
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.76, '[ C — CREDITS ]', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#557755',
    }).setOrigin(0.5);

    // Channel info
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.83, 'CH 2 — STATIC', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#444444',
    }).setOrigin(0.5);

    // Controls info
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.90, 'WASD move  |  Mouse aim  |  Click shoot  |  SPACE dodge', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#333333',
    }).setOrigin(0.5);

    // Version number
    this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'v0.5.0', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#222222',
    }).setOrigin(1, 1);

    // Input handlers
    const navigate = (target: string) => {
      if (this._navigating) return;
      this._navigating = true;
      if (this._attractTimer) this._attractTimer.remove();
      playSFX('menu_select');
      this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress >= 1) {
          this.scene.start(target);
        }
      });
    };

    this.input.keyboard!.on('keydown-ENTER', () => navigate('RepairShopScene'));
    this.input.on('pointerdown', () => navigate('RepairShopScene'));
    this.input.keyboard!.on('keydown-R', () => navigate('RepairShopScene'));
    this.input.keyboard!.on('keydown-C', () => navigate('CreditsScene'));

    // Attract mode: launch demo after 30s idle
    const resetAttractTimer = () => {
      if (this._attractTimer) this._attractTimer.remove();
      this._attractTimer = this.time.delayedCall(30000, () => {
        if (!this._navigating) {
          this._navigating = true;
          this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
            if (progress >= 1) this.scene.start('AttractScene');
          });
        }
      });
    };
    resetAttractTimer();
    this.input.keyboard!.on('keydown', resetAttractTimer);
    this.input.on('pointermove', resetAttractTimer);

    // Fade in
    this.cameras.main.fadeIn(500);
  }
}
