import { Scene } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CSS_PHOSPHOR_GREEN, CSS_HOT_WHITE } from '../utils/constants';
import { playSFX } from '../audio/SFXGenerator';
import { loadSettings, saveSettings, GameSettings } from '../systems/SettingsManager';

type Panel = 'main' | 'settings' | 'controls';

const FONT_FAMILY = 'monospace';
const DIM_COLOR = '#666666';
const SLIDER_STEP = 10;

export class PauseOverlay extends Scene {
  private menuIndex = 0;
  private panel: Panel = 'main';
  private settings!: GameSettings;

  private mainItems: Phaser.GameObjects.Text[] = [];
  private settingsItems: Phaser.GameObjects.Text[] = [];
  private controlsItems: Phaser.GameObjects.Text[] = [];
  private settingsIndex = 0;

  private overlay!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PauseOverlay' });
  }

  create(): void {
    this.scene.pause('GameScene');
    this.settings = loadSettings();
    this.menuIndex = 0;
    this.settingsIndex = 0;
    this.panel = 'main';

    // Semi-transparent black overlay
    this.overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.75,
    );
    this.overlay.setDepth(0);

    // Title
    this.titleText = this.add.text(GAME_WIDTH / 2, 80, 'PAUSED', {
      fontFamily: FONT_FAMILY,
      fontSize: '36px',
      color: CSS_PHOSPHOR_GREEN,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 20, fill: true },
    }).setOrigin(0.5).setDepth(1);

    this.buildMainMenu();
    this.buildSettingsPanel();
    this.buildControlsPanel();

    this.showPanel('main');
    this.setupInput();
  }

  // ── Main Menu ──────────────────────────────────────────────

  private buildMainMenu(): void {
    const labels = ['RESUME', 'SETTINGS', 'CONTROLS', 'ABANDON RUN'];
    const startY = 200;
    const lineH = 50;

    this.mainItems = labels.map((label, i) => {
      const txt = this.add.text(GAME_WIDTH / 2, startY + i * lineH, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: DIM_COLOR,
      }).setOrigin(0.5).setDepth(1);

      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerover', () => {
        if (this.panel === 'main') {
          this.menuIndex = i;
          this.refreshHighlight();
        }
      });
      txt.on('pointerdown', () => {
        if (this.panel === 'main') {
          this.menuIndex = i;
          this.refreshHighlight();
          this.selectMainItem();
        }
      });

      return txt;
    });
  }

  // ── Settings Panel ─────────────────────────────────────────

  /** Total number of adjustable settings rows (sliders + toggles) */
  private settingsRowCount = 0;

  private buildSettingsPanel(): void {
    const startY = 160;
    const lineH = 36;

    // Row definitions: sliders first, then toggles, then colorblind cycle
    const rows: { label: string; type: 'slider' | 'toggle' | 'cycle'; key: keyof GameSettings }[] = [
      { label: 'SCREEN SHAKE', type: 'slider', key: 'screenShakeIntensity' },
      { label: 'SFX VOLUME', type: 'slider', key: 'sfxVolume' },
      { label: 'MUSIC VOLUME', type: 'slider', key: 'musicVolume' },
      { label: 'HIGH CONTRAST', type: 'toggle', key: 'highContrast' },
      { label: 'REDUCE MOTION', type: 'toggle', key: 'reduceMotion' },
      { label: 'COLORBLIND', type: 'cycle', key: 'colorblindMode' },
      { label: 'GAMEPAD', type: 'toggle', key: 'gamepadEnabled' },
      { label: 'AUTO-FIRE', type: 'toggle', key: 'autoFire' },
      { label: 'PRACTICE MODE', type: 'toggle', key: 'practiceMode' },
    ];

    this.settingsRowCount = rows.length;

    this.settingsItems = rows.map((row, i) => {
      const display = this.formatSettingRow(row);
      const txt = this.add.text(GAME_WIDTH / 2, startY + i * lineH, display, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: DIM_COLOR,
      }).setOrigin(0.5).setDepth(1).setVisible(false);

      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerover', () => {
        if (this.panel === 'settings') {
          this.settingsIndex = i;
          this.refreshHighlight();
        }
      });
      txt.on('pointerdown', () => {
        if (this.panel === 'settings') {
          this.settingsIndex = i;
          if (row.type === 'toggle') {
            (this.settings[row.key] as boolean) = !(this.settings[row.key] as boolean);
            saveSettings(this.settings);
            this.refreshSettingsValues();
          } else if (row.type === 'cycle') {
            this.cycleColorblind();
          }
          this.refreshHighlight();
        }
      });

      return txt;
    });

    // Back item
    const backTxt = this.add.text(GAME_WIDTH / 2, startY + rows.length * lineH + 10, '< BACK', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: DIM_COLOR,
    }).setOrigin(0.5).setDepth(1).setVisible(false);

    backTxt.setInteractive({ useHandCursor: true });
    backTxt.on('pointerover', () => {
      if (this.panel === 'settings') {
        this.settingsIndex = rows.length;
        this.refreshHighlight();
      }
    });
    backTxt.on('pointerdown', () => {
      if (this.panel === 'settings') {
        this.settingsIndex = rows.length;
        this.refreshHighlight();
        this.showPanel('main');
      }
    });

    this.settingsItems.push(backTxt);

    // Hint text
    const hint = this.add.text(GAME_WIDTH / 2, startY + (rows.length + 1) * lineH + 20, 'LEFT / RIGHT to adjust, ENTER to toggle', {
      fontFamily: FONT_FAMILY,
      fontSize: '11px',
      color: '#444444',
    }).setOrigin(0.5).setDepth(1).setVisible(false);

    this.settingsItems.push(hint);
  }

  private formatSettingRow(row: { label: string; type: string; key: keyof GameSettings }): string {
    if (row.type === 'slider') {
      const val = Math.round((this.settings[row.key] as number) * 100);
      return this.formatSlider(row.label, val);
    } else if (row.type === 'toggle') {
      const on = this.settings[row.key] as boolean;
      return `${row.label}:  ${on ? '[ON]' : '[OFF]'}`;
    } else {
      // cycle (colorblind)
      const mode = this.settings.colorblindMode;
      const label = mode === 'none' ? 'NONE' : mode.toUpperCase();
      return `${row.label}:  < ${label} >`;
    }
  }

  private cycleColorblind(): void {
    const modes: GameSettings['colorblindMode'][] = ['none', 'deuteranopia', 'protanopia', 'tritanopia'];
    const idx = modes.indexOf(this.settings.colorblindMode);
    this.settings.colorblindMode = modes[(idx + 1) % modes.length];
    saveSettings(this.settings);
    playSFX('menu_select');
    this.refreshSettingsValues();
  }

  // ── Controls Panel ─────────────────────────────────────────

  private buildControlsPanel(): void {
    const controls = [
      'WASD .............. Move',
      'Mouse ............. Aim',
      'Left Click ........ Shoot',
      'SPACE / R-Click ... Channel Surf',
      'Q ................. Bomb',
      'ESC ............... Pause',
    ];
    const startY = 190;
    const lineH = 34;

    this.controlsItems = controls.map((line, i) => {
      return this.add.text(GAME_WIDTH / 2, startY + i * lineH, line, {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: CSS_PHOSPHOR_GREEN,
      }).setOrigin(0.5).setDepth(1).setVisible(false);
    });

    // Back item
    const backTxt = this.add.text(GAME_WIDTH / 2, startY + controls.length * lineH + 20, '< BACK', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: DIM_COLOR,
    }).setOrigin(0.5).setDepth(1).setVisible(false);

    backTxt.setInteractive({ useHandCursor: true });
    backTxt.on('pointerover', () => {
      if (this.panel === 'controls') this.refreshHighlight();
    });
    backTxt.on('pointerdown', () => {
      if (this.panel === 'controls') {
        playSFX('menu_select');
        this.showPanel('main');
      }
    });

    this.controlsItems.push(backTxt);
  }

  // ── Panel Switching ────────────────────────────────────────

  private showPanel(panel: Panel): void {
    this.panel = panel;

    const mainVisible = panel === 'main';
    const settingsVisible = panel === 'settings';
    const controlsVisible = panel === 'controls';

    this.mainItems.forEach(t => t.setVisible(mainVisible));
    this.settingsItems.forEach(t => t.setVisible(settingsVisible));
    this.controlsItems.forEach(t => t.setVisible(controlsVisible));

    if (panel === 'main') {
      this.titleText.setText('PAUSED');
    } else if (panel === 'settings') {
      this.titleText.setText('SETTINGS');
      this.settingsIndex = 0;
      this.refreshSettingsValues();
    } else {
      this.titleText.setText('CONTROLS');
    }

    this.refreshHighlight();
  }

  // ── Input ──────────────────────────────────────────────────

  private setupInput(): void {
    const kb = this.input.keyboard!;

    kb.on('keydown-UP', () => {
      this.navigateUp();
    });

    kb.on('keydown-DOWN', () => {
      this.navigateDown();
    });

    kb.on('keydown-LEFT', () => {
      if (this.panel === 'settings') {
        this.adjustSetting(-SLIDER_STEP);
      }
    });

    kb.on('keydown-RIGHT', () => {
      if (this.panel === 'settings') {
        this.adjustSetting(SLIDER_STEP);
      }
    });

    kb.on('keydown-ENTER', () => {
      this.selectCurrent();
    });

    kb.on('keydown-ESC', () => {
      if (this.panel === 'main') {
        this.resumeGame();
      } else {
        playSFX('menu_select');
        this.showPanel('main');
      }
    });
  }

  private navigateUp(): void {
    playSFX('menu_select');
    if (this.panel === 'main') {
      this.menuIndex = (this.menuIndex - 1 + this.mainItems.length) % this.mainItems.length;
    } else if (this.panel === 'settings') {
      const count = this.settingsItems.length - 1; // exclude hint
      this.settingsIndex = (this.settingsIndex - 1 + count) % count;
    }
    this.refreshHighlight();
  }

  private navigateDown(): void {
    playSFX('menu_select');
    if (this.panel === 'main') {
      this.menuIndex = (this.menuIndex + 1) % this.mainItems.length;
    } else if (this.panel === 'settings') {
      const count = this.settingsItems.length - 1; // exclude hint
      this.settingsIndex = (this.settingsIndex + 1) % count;
    }
    this.refreshHighlight();
  }

  private selectCurrent(): void {
    playSFX('menu_select');
    if (this.panel === 'main') {
      this.selectMainItem();
    } else if (this.panel === 'settings') {
      // Back item is the second-to-last (before hint)
      if (this.settingsIndex === this.settingsRowCount) {
        this.showPanel('main');
      } else if (this.settingsIndex < this.settingsRowCount) {
        // Toggle or cycle on ENTER
        this.adjustSetting(0);
      }
    } else if (this.panel === 'controls') {
      this.showPanel('main');
    }
  }

  private selectMainItem(): void {
    switch (this.menuIndex) {
      case 0: // Resume
        this.resumeGame();
        break;
      case 1: // Settings
        playSFX('menu_select');
        this.showPanel('settings');
        break;
      case 2: // Controls
        playSFX('menu_select');
        this.showPanel('controls');
        break;
      case 3: // Abandon Run
        this.abandonRun();
        break;
    }
  }

  // ── Settings Adjustment ────────────────────────────────────

  private adjustSetting(delta: number): void {
    const rows: { label: string; type: 'slider' | 'toggle' | 'cycle'; key: keyof GameSettings }[] = [
      { label: 'SCREEN SHAKE', type: 'slider', key: 'screenShakeIntensity' },
      { label: 'SFX VOLUME', type: 'slider', key: 'sfxVolume' },
      { label: 'MUSIC VOLUME', type: 'slider', key: 'musicVolume' },
      { label: 'HIGH CONTRAST', type: 'toggle', key: 'highContrast' },
      { label: 'REDUCE MOTION', type: 'toggle', key: 'reduceMotion' },
      { label: 'COLORBLIND', type: 'cycle', key: 'colorblindMode' },
      { label: 'GAMEPAD', type: 'toggle', key: 'gamepadEnabled' },
      { label: 'AUTO-FIRE', type: 'toggle', key: 'autoFire' },
      { label: 'PRACTICE MODE', type: 'toggle', key: 'practiceMode' },
    ];

    if (this.settingsIndex >= rows.length) return;

    const row = rows[this.settingsIndex];
    if (row.type === 'slider') {
      const current = Math.round((this.settings[row.key] as number) * 100);
      const clamped = Phaser.Math.Clamp(current + delta, 0, 100);
      (this.settings[row.key] as number) = clamped / 100;
    } else if (row.type === 'toggle') {
      (this.settings[row.key] as boolean) = !(this.settings[row.key] as boolean);
    } else if (row.type === 'cycle') {
      this.cycleColorblind();
      return; // cycleColorblind already saves and refreshes
    }

    saveSettings(this.settings);
    playSFX('menu_select');
    this.refreshSettingsValues();
  }

  private refreshSettingsValues(): void {
    const rows: { label: string; type: 'slider' | 'toggle' | 'cycle'; key: keyof GameSettings }[] = [
      { label: 'SCREEN SHAKE', type: 'slider', key: 'screenShakeIntensity' },
      { label: 'SFX VOLUME', type: 'slider', key: 'sfxVolume' },
      { label: 'MUSIC VOLUME', type: 'slider', key: 'musicVolume' },
      { label: 'HIGH CONTRAST', type: 'toggle', key: 'highContrast' },
      { label: 'REDUCE MOTION', type: 'toggle', key: 'reduceMotion' },
      { label: 'COLORBLIND', type: 'cycle', key: 'colorblindMode' },
      { label: 'GAMEPAD', type: 'toggle', key: 'gamepadEnabled' },
      { label: 'AUTO-FIRE', type: 'toggle', key: 'autoFire' },
      { label: 'PRACTICE MODE', type: 'toggle', key: 'practiceMode' },
    ];

    for (let i = 0; i < rows.length; i++) {
      if (i < this.settingsItems.length) {
        this.settingsItems[i].setText(this.formatSettingRow(rows[i]));
      }
    }
  }

  private formatSlider(label: string, value: number): string {
    const filled = Math.round(value / 10);
    const empty = 10 - filled;
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
    return `<  ${label}  ${bar}  ${value}%  >`;
  }

  // ── Highlight ──────────────────────────────────────────────

  private refreshHighlight(): void {
    if (this.panel === 'main') {
      this.mainItems.forEach((t, i) => {
        const raw = t.text.replace(/^>\s+/, '').replace(/\s+<$/, '').trim();
        const selected = i === this.menuIndex;
        t.setText(selected ? `> ${raw} <` : raw);
        t.setColor(selected ? CSS_HOT_WHITE : DIM_COLOR);
        if (selected) {
          t.setShadow(0, 0, CSS_PHOSPHOR_GREEN, 8, true, true);
        } else {
          t.setShadow(0, 0, 'transparent', 0);
        }
      });
    } else if (this.panel === 'settings') {
      const count = this.settingsItems.length - 1; // exclude hint
      for (let i = 0; i < count; i++) {
        const selected = i === this.settingsIndex;
        this.settingsItems[i].setColor(selected ? CSS_HOT_WHITE : DIM_COLOR);
        if (selected) {
          this.settingsItems[i].setShadow(0, 0, CSS_PHOSPHOR_GREEN, 8, true, true);
        } else {
          this.settingsItems[i].setShadow(0, 0, 'transparent', 0);
        }
      }
    }
  }

  // ── Actions ────────────────────────────────────────────────

  private resumeGame(): void {
    playSFX('menu_select');
    this.scene.resume('GameScene');
    this.scene.stop();
  }

  private abandonRun(): void {
    playSFX('menu_select');
    this.scene.stop('GameScene');
    this.scene.start('RepairShopScene');
  }
}
