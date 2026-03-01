import { Scene, GameObjects } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CSS_PHOSPHOR_GREEN, CSS_HOT_WHITE } from '../utils/constants';
import { playSFX } from '../audio/SFXGenerator';
import { loadSave } from '../systems/SaveManager';
import { ALL_CHARACTERS, CharacterDef } from '../data/characters';

export class CharacterSelectScene extends Scene {
  private _characters: CharacterDef[] = [];
  private _selectedIndex = 0;
  private _hoveredIndex = -1;
  private _cardGraphics: GameObjects.Graphics[] = [];
  private _infoName!: GameObjects.Text;
  private _infoDesc!: GameObjects.Text;
  private _infoStats!: GameObjects.Text;
  private _infoPassive!: GameObjects.Text;
  private _dailySeed?: string;
  private _endless?: boolean;
  private _weeklyChallenge?: boolean;
  private _weeklySeed?: number;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(data: { dailySeed?: string; endless?: boolean; weeklyChallenge?: boolean; weeklySeed?: number } = {}): void {
    this._dailySeed = data.dailySeed;
    this._endless = data.endless;
    this._weeklyChallenge = data.weeklyChallenge;
    this._weeklySeed = data.weeklySeed;
    const save = loadSave();
    const unlockedChars = save.unlockedCharacters ?? ['standard'];

    this._characters = ALL_CHARACTERS.filter(
      c => c.unlocked || unlockedChars.includes(c.id),
    );
    if (this._characters.length === 0) {
      this._characters = [ALL_CHARACTERS[0]]; // fallback to Standard
    }
    this._selectedIndex = 0;

    // Background + CRT
    this.cameras.main.setBackgroundColor(0x070f07);
    this.cameras.main.setPostPipeline('CRTPipeline');

    // Scanlines
    const scanlines = this.add.graphics();
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      scanlines.fillStyle(0x000000, 0.12);
      scanlines.fillRect(0, y, GAME_WIDTH, 1);
    }

    // Title
    this.add.text(GAME_WIDTH / 2, 28, 'SELECT CHARACTER', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: CSS_PHOSPHOR_GREEN,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 16, fill: true },
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 68, 'Choose your signal carrier.', {
      fontFamily: 'monospace', fontSize: '12px', color: '#557755',
    }).setOrigin(0.5);

    // Character cards
    const cardW = 120;
    const cardH = 120;
    const cardGap = 16;
    const totalW = this._characters.length * cardW + (this._characters.length - 1) * cardGap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const cardY = 100;

    this._cardGraphics = [];

    for (let i = 0; i < this._characters.length; i++) {
      const def = this._characters[i];
      const cx = startX + i * (cardW + cardGap) + cardW / 2;
      const cy = cardY + cardH / 2;

      const gfx = this.add.graphics();
      this._cardGraphics.push(gfx);

      const zone = this.add.rectangle(cx, cy, cardW, cardH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      const idx = i;
      zone.on('pointerover', () => {
        this._hoveredIndex = idx;
        playSFX('menu_select');
        this._redrawCards();
      });
      zone.on('pointerout', () => {
        this._hoveredIndex = -1;
        this._redrawCards();
      });
      zone.on('pointerdown', () => {
        this._selectedIndex = idx;
        this._hoveredIndex = -1;
        playSFX('item_pickup');
        this._redrawCards();
        this._updateInfoPanel();
      });

      // Name below card
      this.add.text(cx, cardY + cardH + 8, def.name, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#88aa88',
        align: 'center',
        wordWrap: { width: cardW },
      }).setOrigin(0.5, 0);
    }

    this._redrawCards();

    // Info panel
    const infoPanelY = cardY + cardH + 40;
    const infoCx = GAME_WIDTH / 2;

    const divG = this.add.graphics();
    divG.lineStyle(1, 0x33ff33, 0.25);
    divG.lineBetween(80, infoPanelY - 4, GAME_WIDTH - 80, infoPanelY - 4);

    this._infoName = this.add.text(infoCx, infoPanelY + 4, '', {
      fontFamily: 'monospace', fontSize: '20px', color: CSS_HOT_WHITE,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 10, fill: true },
    }).setOrigin(0.5, 0);

    this._infoDesc = this.add.text(infoCx, infoPanelY + 34, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#aaaaaa',
      align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5, 0);

    this._infoPassive = this.add.text(infoCx, infoPanelY + 58, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#33ccff',
      align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5, 0);

    this._infoStats = this.add.text(infoCx, infoPanelY + 82, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#557755',
      align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5, 0);

    this._updateInfoPanel();

    // Select button
    const selectBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, '[ SELECT — CHOOSE WEAPON ]', {
      fontFamily: 'monospace', fontSize: '18px', color: CSS_PHOSPHOR_GREEN,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 14, fill: true },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.tweens.add({
      targets: selectBtn,
      alpha: { from: 1, to: 0.4 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    selectBtn.on('pointerover', () => selectBtn.setScale(1.04));
    selectBtn.on('pointerout', () => selectBtn.setScale(1));
    selectBtn.on('pointerdown', () => this._proceed());

    this.input.keyboard!.on('keydown-ENTER', () => this._proceed());
    this.input.keyboard!.on('keydown-LEFT', () => {
      this._selectedIndex = Math.max(0, this._selectedIndex - 1);
      playSFX('menu_select');
      this._redrawCards();
      this._updateInfoPanel();
    });
    this.input.keyboard!.on('keydown-RIGHT', () => {
      this._selectedIndex = Math.min(this._characters.length - 1, this._selectedIndex + 1);
      playSFX('menu_select');
      this._redrawCards();
      this._updateInfoPanel();
    });

    this.input.keyboard!.on('keydown-ESC', () => {
      playSFX('menu_select');
      this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress >= 1) this.scene.start('RepairShopScene');
      });
    });

    this.add.text(20, GAME_HEIGHT - 20, '[ ESC — BACK ]', {
      fontFamily: 'monospace', fontSize: '11px', color: '#334433',
    }).setOrigin(0, 1);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 26, '← → to navigate', {
      fontFamily: 'monospace', fontSize: '11px', color: '#334433',
    }).setOrigin(0.5, 1);

    this.cameras.main.fadeIn(400);
  }

  private _redrawCards(): void {
    const cardW = 120;
    const cardH = 120;
    const cardGap = 16;
    const totalW = this._characters.length * cardW + (this._characters.length - 1) * cardGap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const cardY = 100;

    for (let i = 0; i < this._characters.length; i++) {
      const def = this._characters[i];
      const cx = startX + i * (cardW + cardGap) + cardW / 2;
      const cy = cardY + cardH / 2;
      const selected = i === this._selectedIndex;
      const hovered = i === this._hoveredIndex;
      const gfx = this._cardGraphics[i];

      gfx.clear();

      if (selected || hovered) {
        gfx.lineStyle(2, selected ? 0x33ff33 : 0x88ff88, 0.9);
        gfx.strokeRect(cx - cardW / 2 - 4, cy - cardH / 2 - 4, cardW + 8, cardH + 8);
      }

      gfx.fillStyle(0x0a140a, hovered ? 0.95 : 0.8);
      gfx.fillRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH);
      gfx.lineStyle(1, def.color, 0.3);
      gfx.strokeRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH);

      // Character icon (glowing circle)
      const alpha = hovered ? 1.0 : (selected ? 0.95 : 0.65);
      gfx.fillStyle(def.color, alpha);
      gfx.fillCircle(cx, cy, cardW * 0.2);
      gfx.lineStyle(1, def.color, alpha * 0.4);
      gfx.strokeCircle(cx, cy, cardW * 0.32);
    }
  }

  private _updateInfoPanel(): void {
    const def = this._characters[this._selectedIndex];
    if (!def) return;

    this._infoName.setText(def.name);
    this._infoDesc.setText(def.description);

    const passiveDescs: Record<string, string> = {
      none: 'No passive ability.',
      warm_start: 'WARM START: Begin with a random common item.',
      overdrive: 'OVERDRIVE: Deal 2x damage when HP is 1 or below.',
      phase_shift: 'PHASE SHIFT: 50% chance to ignore incoming damage.',
      static_cling: 'STATIC CLING: Contact with enemies deals 2 damage to them.',
    };
    this._infoPassive.setText(passiveDescs[def.passiveId] ?? '');

    const mods: string[] = [];
    for (const [key, val] of Object.entries(def.statMods)) {
      if (typeof val === 'number' && val !== 0) {
        const sign = val > 0 ? '+' : '';
        mods.push(`${key}: ${sign}${val}`);
      }
    }
    this._infoStats.setText(mods.length > 0 ? mods.join('   ') : 'No stat modifiers.');
  }

  private _proceed(): void {
    const def = this._characters[this._selectedIndex];
    if (!def) return;

    playSFX('room_transition');
    this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        this.scene.start('WeaponSelectScene', {
          characterId: def.id,
          dailySeed: this._dailySeed,
          endless: this._endless,
          weeklyChallenge: this._weeklyChallenge,
          weeklySeed: this._weeklySeed,
        });
      }
    });
  }
}
