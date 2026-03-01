import { Scene } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CSS_SIGNAL_RED, CSS_HOT_WHITE, CSS_PHOSPHOR_GREEN } from '../utils/constants';
import { playSFX } from '../audio/SFXGenerator';

interface RunStats {
  score: number;
  wave: number;
  enemiesKilled: number;
  itemsCollected: number;
  time: number;
  victory: boolean;
  tubesEarned?: number;
  newAchievements?: string[];
  channelsCompleted?: number;
  channelName?: string;
  endless?: boolean;
  endlessCycle?: number;
  runConfig?: unknown; // RunConfig for quick restart
}

export class GameOverScene extends Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data: RunStats): void {
    this.cameras.main.setBackgroundColor(0x0a0a0a);
    this.cameras.main.setPostPipeline('CRTPipeline');

    const {
      score = 0, wave = 0, enemiesKilled = 0, itemsCollected = 0, time = 0, victory = false,
      tubesEarned = 0, newAchievements = [], channelsCompleted = 0, channelName = '',
    } = data;

    // Animated noise background
    const noiseGraphics = this.add.graphics();
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        noiseGraphics.clear();
        const count = victory ? 100 : 300;
        for (let i = 0; i < count; i++) {
          const x = Phaser.Math.Between(0, GAME_WIDTH);
          const y = Phaser.Math.Between(0, GAME_HEIGHT);
          const alpha = Math.random() * (victory ? 0.08 : 0.15);
          noiseGraphics.fillStyle(victory ? 0x33ff33 : 0xffffff, alpha);
          noiseGraphics.fillRect(x, y, Phaser.Math.Between(1, 4), Phaser.Math.Between(1, 4));
        }
      },
    });

    // Title
    const titleColor = victory ? CSS_PHOSPHOR_GREEN : CSS_SIGNAL_RED;
    const titleText = victory ? 'SIGNAL RESTORED' : 'SIGNAL LOST';

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, titleText, {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: titleColor,
      shadow: { offsetX: 0, offsetY: 0, color: titleColor, blur: 30, fill: true },
    }).setOrigin(0.5);

    if (!victory) {
      this.tweens.add({
        targets: title,
        x: { from: GAME_WIDTH / 2 - 3, to: GAME_WIDTH / 2 + 3 },
        duration: 50,
        yoyo: true,
        repeat: -1,
      });
    }

    // Stats
    const statsY = GAME_HEIGHT * 0.38;
    const lineH = 22;
    const statsColor = '#888888';

    this.add.text(GAME_WIDTH / 2, statsY, `SCORE: ${score}`, {
      fontFamily: 'monospace', fontSize: '20px', color: CSS_HOT_WHITE,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, statsY + lineH * 1.5, `ROOMS CLEARED: ${wave}`, {
      fontFamily: 'monospace', fontSize: '14px', color: statsColor,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, statsY + lineH * 2.5, `ENEMIES KILLED: ${enemiesKilled}`, {
      fontFamily: 'monospace', fontSize: '14px', color: statsColor,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, statsY + lineH * 3.5, `ITEMS COLLECTED: ${itemsCollected}`, {
      fontFamily: 'monospace', fontSize: '14px', color: statsColor,
    }).setOrigin(0.5);

    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    this.add.text(GAME_WIDTH / 2, statsY + lineH * 4.5, `TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`, {
      fontFamily: 'monospace', fontSize: '14px', color: statsColor,
    }).setOrigin(0.5);

    // Channels completed / endless floors
    if (data.endless) {
      const cycle = data.endlessCycle ?? 0;
      const totalFloors = cycle * (channelsCompleted || 1) + (channelsCompleted || 0);
      this.add.text(GAME_WIDTH / 2, statsY + lineH * 5.5, `ENDLESS FLOORS: ${totalFloors}`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#ff8833',
      }).setOrigin(0.5);
    } else if (channelsCompleted > 0) {
      this.add.text(GAME_WIDTH / 2, statsY + lineH * 5.5, `CHANNELS CLEARED: ${channelsCompleted}`, {
        fontFamily: 'monospace', fontSize: '14px', color: statsColor,
      }).setOrigin(0.5);
    }

    // Tubes earned
    if (tubesEarned > 0) {
      this.add.text(GAME_WIDTH / 2, statsY + lineH * (channelsCompleted > 0 ? 6.5 : 5.5), `TUBES EARNED: +${tubesEarned}`, {
        fontFamily: 'monospace', fontSize: '16px', color: '#ffcc33',
      }).setOrigin(0.5);
    }

    // New achievements
    if (newAchievements.length > 0) {
      const achY = statsY + lineH * (channelsCompleted > 0 ? 8 : 7);
      this.add.text(GAME_WIDTH / 2, achY, 'NEW ACHIEVEMENTS', {
        fontFamily: 'monospace', fontSize: '14px', color: CSS_PHOSPHOR_GREEN,
      }).setOrigin(0.5);

      for (let i = 0; i < newAchievements.length; i++) {
        this.add.text(GAME_WIDTH / 2, achY + lineH * (i + 1), newAchievements[i].replace(/_/g, ' ').toUpperCase(), {
          fontFamily: 'monospace', fontSize: '12px', color: '#aaffaa',
        }).setOrigin(0.5);
      }
    }

    // Continue prompt — go to Repair Shop
    const continueText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.75, '[ PRESS ENTER OR CLICK — REPAIR SHOP ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: CSS_PHOSPHOR_GREEN,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: continueText,
      alpha: { from: 1, to: 0.2 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.84, '[ R — QUICK RETRY ]', {
      fontFamily: 'monospace', fontSize: '12px', color: '#555555',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.90, '[ ESC — MAIN MENU ]', {
      fontFamily: 'monospace', fontSize: '12px', color: '#444444',
    }).setOrigin(0.5);

    // Input (delayed)
    this.time.delayedCall(500, () => {
      const toRepairShop = () => {
        playSFX('menu_select');
        this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
          if (progress >= 1) this.scene.start('RepairShopScene', {
            tubesEarned,
            score,
            wave,
            enemiesKilled,
            itemsCollected,
            time,
            victory,
          });
        });
      };
      const quickRetry = () => {
        playSFX('menu_select');
        this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
          if (progress >= 1) {
            // Restart with fresh RunConfig based on original settings
            if (data.runConfig) {
              const rc = data.runConfig as any;
              this.scene.start('GameScene', {
                channels: rc.channels,
                currentChannelIndex: 0,
                weaponType: rc.weaponType,
                difficultyScale: 1.0,
                characterId: rc.characterId,
                ascensionLevel: rc.ascensionLevel,
                dailySeed: rc.dailySeed,
                endless: rc.endless,
                weeklyChallenge: rc.weeklyChallenge,
                weeklySeed: rc.weeklySeed,
              });
            } else {
              this.scene.start('GameScene');
            }
          }
        });
      };
      const toMenu = () => {
        playSFX('menu_select');
        this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
          if (progress >= 1) this.scene.start('MenuScene');
        });
      };

      this.input.keyboard!.on('keydown-ENTER', toRepairShop);
      this.input.on('pointerdown', toRepairShop);
      this.input.keyboard!.on('keydown-R', quickRetry);
      this.input.keyboard!.on('keydown-ESC', toMenu);
    });

    this.cameras.main.fadeIn(500);
  }
}
