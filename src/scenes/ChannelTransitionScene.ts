import { Scene } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CSS_PHOSPHOR_GREEN } from '../utils/constants';
import { playSFX } from '../audio/SFXGenerator';

export class ChannelTransitionScene extends Scene {
  constructor() {
    super({ key: 'ChannelTransitionScene' });
  }

  create(data: {
    nextChannelName: string;
    nextChannelNumber: number;
    channelIndex: number;
    totalChannels: number;
    runConfig: any;
  }): void {
    const { nextChannelName, nextChannelNumber, channelIndex, totalChannels, runConfig } = data;

    this.cameras.main.setBackgroundColor(0x000000);
    this.cameras.main.setPostPipeline('CRTPipeline');

    // Play channel change SFX immediately
    playSFX('channel_surf');

    // --- Static noise layer ---
    const staticGraphics = this.add.graphics();
    staticGraphics.setAlpha(1);

    const drawStatic = (alpha: number): void => {
      staticGraphics.clear();
      const rectCount = 300;
      for (let i = 0; i < rectCount; i++) {
        const x = Phaser.Math.Between(0, GAME_WIDTH);
        const y = Phaser.Math.Between(0, GAME_HEIGHT);
        const w = Phaser.Math.Between(2, 20);
        const h = Phaser.Math.Between(1, 8);
        // Random color: white, mid-gray, dark gray, or black
        const shade = Phaser.Math.RND.pick([0xffffff, 0xaaaaaa, 0x555555, 0x222222, 0x000000]);
        const pixelAlpha = (Math.random() * 0.6 + 0.4) * alpha;
        staticGraphics.fillStyle(shade, pixelAlpha);
        staticGraphics.fillRect(x, y, w, h);
      }
      // Add some horizontal scan-line tears for CRT feel
      const tearCount = Phaser.Math.Between(2, 6);
      for (let t = 0; t < tearCount; t++) {
        const y = Phaser.Math.Between(0, GAME_HEIGHT);
        const tearAlpha = Math.random() * 0.8 * alpha;
        staticGraphics.fillStyle(0xffffff, tearAlpha);
        staticGraphics.fillRect(0, y, GAME_WIDTH, Phaser.Math.Between(1, 3));
      }
    };

    // Phase tracking
    let currentStaticAlpha = 1;

    // Redraw static on a tight loop (every 50ms)
    const staticTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        drawStatic(currentStaticAlpha);
      },
    });

    // Initial draw
    drawStatic(1);

    // --- Channel number flicker text (hidden initially) ---
    const channelNumberText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, '', {
      fontFamily: 'monospace',
      fontSize: '72px',
      color: '#ffffff',
      shadow: { offsetX: 0, offsetY: 0, color: '#ffffff', blur: 20, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    // Channel name text (shown after resolution)
    const channelNameText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, nextChannelName, {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: CSS_PHOSPHOR_GREEN,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 14, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    // TUNING... text (shown during resolution phase)
    const tuningText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, 'TUNING...', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: CSS_PHOSPHOR_GREEN,
    }).setOrigin(0.5).setAlpha(0);

    // Progress indicator at bottom: "CHANNEL 2 / 3"
    this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 32,
      `CHANNEL ${channelIndex} / ${totalChannels}`,
      {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#555555',
      }
    ).setOrigin(0.5);

    // --- Phase 1: Pure static (0–1500ms) ---
    // Static is already drawing at full opacity. Nothing else to do yet.

    // --- Phase 2: Static fades to 50%, channel numbers flicker (1500–2500ms) ---
    let flickerTimer: Phaser.Time.TimerEvent | null = null;

    this.time.delayedCall(1500, () => {
      // Fade static to 50% over 400ms
      this.tweens.add({
        targets: staticGraphics,
        alpha: 0.5,
        duration: 400,
        ease: 'Linear',
        onUpdate: (_tween: Phaser.Tweens.Tween, _target: Phaser.GameObjects.Graphics, _key: string, value: number) => {
          currentStaticAlpha = value;
        },
      });

      // Fade in channel number text
      channelNumberText.setAlpha(1);
      channelNumberText.setText('CH --');

      // Flicker random channel numbers every 100ms
      flickerTimer = this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          const randomNum = Phaser.Math.Between(2, 99);
          channelNumberText.setText(`CH ${randomNum}`);
          // Slight jitter on position for glitchy feel
          channelNumberText.setX(GAME_WIDTH / 2 + Phaser.Math.Between(-4, 4));
          channelNumberText.setY(GAME_HEIGHT / 2 - 30 + Phaser.Math.Between(-2, 2));
        },
      });
    });

    // --- Phase 3: Number resolves to target channel (2500–3500ms) ---
    this.time.delayedCall(2500, () => {
      // Stop flickering
      if (flickerTimer) {
        flickerTimer.remove();
        flickerTimer = null;
      }

      // Reset position and set final channel number
      channelNumberText.setX(GAME_WIDTH / 2);
      channelNumberText.setY(GAME_HEIGHT / 2 - 30);
      channelNumberText.setText(`CH ${nextChannelNumber}`);

      // Turn text green with glow
      channelNumberText.setColor(CSS_PHOSPHOR_GREEN);
      channelNumberText.setStyle({
        shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 30, fill: true },
      });

      // Fade static mostly out
      this.tweens.add({
        targets: staticGraphics,
        alpha: 0.08,
        duration: 500,
        ease: 'Linear',
        onUpdate: (_tween: Phaser.Tweens.Tween, _target: Phaser.GameObjects.Graphics, _key: string, value: number) => {
          currentStaticAlpha = value;
        },
      });

      // Fade in channel name below
      this.tweens.add({
        targets: channelNameText,
        alpha: 1,
        duration: 300,
        ease: 'Linear',
      });

      // Fade in and pulse TUNING... text
      this.tweens.add({
        targets: tuningText,
        alpha: 1,
        duration: 200,
        ease: 'Linear',
        onComplete: () => {
          this.tweens.add({
            targets: tuningText,
            alpha: { from: 1, to: 0.2 },
            duration: 400,
            yoyo: true,
            repeat: -1,
          });
        },
      });

      // Brief green flash / bloom pulse on the channel number
      this.tweens.add({
        targets: channelNumberText,
        scaleX: { from: 1.0, to: 1.08 },
        scaleY: { from: 1.0, to: 1.08 },
        duration: 150,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    });

    // --- Phase 4: Fade to black → start GameScene (3500ms) ---
    this.time.delayedCall(3500, () => {
      staticTimer.remove();

      this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress >= 1) {
          this.scene.start('GameScene', runConfig);
        }
      });
    });
  }
}
