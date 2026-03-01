import { Scene, GameObjects } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CSS_PHOSPHOR_GREEN, CSS_HOT_WHITE } from '../utils/constants';
import { playSFX } from '../audio/SFXGenerator';
import { loadSave } from '../systems/SaveManager';
import { WEAPON_DEFS, WeaponDef } from '../data/weapons';
import { RunConfig } from './GameScene';

// -------------------------------------------------------------------
// Weapon icon drawing helpers (pure Graphics)
// -------------------------------------------------------------------

function drawWeaponIcon(
  gfx: GameObjects.Graphics,
  def: WeaponDef,
  cx: number,
  cy: number,
  size: number,
  selected: boolean,
  hovered: boolean,
): void {
  const color = def.color;
  const alpha = hovered ? 1.0 : (selected ? 0.95 : 0.65);
  gfx.clear();

  // Selection / hover border
  if (selected || hovered) {
    gfx.lineStyle(2, selected ? 0x33ff33 : 0x88ff88, 0.9);
    gfx.strokeRect(cx - size / 2 - 4, cy - size / 2 - 4, size + 8, size + 8);
  }

  // Background box
  gfx.fillStyle(0x0a140a, hovered ? 0.95 : 0.8);
  gfx.fillRect(cx - size / 2, cy - size / 2, size, size);
  gfx.lineStyle(1, color, 0.3);
  gfx.strokeRect(cx - size / 2, cy - size / 2, size, size);

  gfx.fillStyle(color, alpha);
  gfx.lineStyle(2, color, alpha);

  switch (def.shape) {
    case 'circle': {
      // Phosphor beam: glowing circle dot
      gfx.fillCircle(cx, cy, size * 0.22);
      gfx.lineStyle(1, color, alpha * 0.4);
      gfx.strokeCircle(cx, cy, size * 0.38);
      break;
    }
    case 'line': {
      // Scan line: wide horizontal bar
      const barH = Math.max(4, size * 0.12);
      gfx.fillRect(cx - size * 0.4, cy - barH / 2, size * 0.8, barH);
      // Thin lines above and below to suggest scanlines
      gfx.fillStyle(color, alpha * 0.3);
      gfx.fillRect(cx - size * 0.4, cy - barH / 2 - barH * 1.8, size * 0.8, barH * 0.5);
      gfx.fillRect(cx - size * 0.4, cy + barH / 2 + barH * 0.8, size * 0.8, barH * 0.5);
      break;
    }
    case 'triple': {
      // Color burst: 3 colored dots (R, G, B)
      const offsets: number[] = [-size * 0.22, 0, size * 0.22];
      const dotColors: number[] = [0xff3333, 0x33ff33, 0x3333ff];
      for (let i = 0; i < 3; i++) {
        gfx.fillStyle(dotColors[i], alpha);
        gfx.fillCircle(cx + offsets[i], cy, size * 0.12);
      }
      break;
    }
    case 'wave': {
      // Interference pattern: wavy path drawn as line segments
      const wavePoints = 12;
      const amplitude = size * 0.2;
      const waveW = size * 0.75;
      const stepX = waveW / wavePoints;
      const startX = cx - waveW / 2;
      gfx.lineStyle(2, color, alpha);
      gfx.beginPath();
      for (let i = 0; i <= wavePoints; i++) {
        const wx = startX + i * stepX;
        const wy = cy + Math.sin((i / wavePoints) * Math.PI * 3) * amplitude;
        if (i === 0) gfx.moveTo(wx, wy);
        else gfx.lineTo(wx, wy);
      }
      gfx.strokePath();
      // Small dot at the end (the "projectile")
      gfx.fillStyle(color, alpha);
      gfx.fillCircle(startX + waveW, cy, size * 0.1);
      break;
    }
  }
}

// -------------------------------------------------------------------
// Scene
// -------------------------------------------------------------------
export class WeaponSelectScene extends Scene {
  private _weapons: WeaponDef[] = [];
  private _selectedIndex = 0;
  private _hoveredIndex = -1;
  private _characterId = 'standard';
  private _dailySeed?: string;
  private _endless?: boolean;
  private _weeklyChallenge?: boolean;
  private _weeklySeed?: number;

  // Graphics object per weapon card (redrawn on hover/select changes)
  private _cardGraphics: GameObjects.Graphics[] = [];

  // Info panel texts (updated when selection changes)
  private _infoName!: GameObjects.Text;
  private _infoDesc!: GameObjects.Text;
  private _infoStats!: GameObjects.Text;

  constructor() {
    super({ key: 'WeaponSelectScene' });
  }

  create(data: { characterId?: string; dailySeed?: string; endless?: boolean; weeklyChallenge?: boolean; weeklySeed?: number } = {}): void {
    this._characterId = data.characterId ?? 'standard';
    this._dailySeed = data.dailySeed;
    this._endless = data.endless;
    this._weeklyChallenge = data.weeklyChallenge;
    this._weeklySeed = data.weeklySeed;
    // ---------------------------------------------------------------
    // Load save → filter to unlocked weapons
    // ---------------------------------------------------------------
    const save = loadSave();
    const unlockedIds = save.unlockedWeapons;

    // Preserve WEAPON_DEFS display order
    const allOrder = ['phosphor_beam', 'scan_line', 'color_burst', 'interference_pattern'];
    this._weapons = allOrder
      .filter((id) => unlockedIds.includes(id) && WEAPON_DEFS[id])
      .map((id) => WEAPON_DEFS[id]);

    // Fallback: always include phosphor_beam
    if (this._weapons.length === 0) {
      this._weapons = [WEAPON_DEFS['phosphor_beam']];
    }

    this._selectedIndex = 0;

    // ---------------------------------------------------------------
    // Background + CRT
    // ---------------------------------------------------------------
    this.cameras.main.setBackgroundColor(0x070f07);
    this.cameras.main.setPostPipeline('CRTPipeline');

    // Scanlines
    const scanlines = this.add.graphics();
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      scanlines.fillStyle(0x000000, 0.12);
      scanlines.fillRect(0, y, GAME_WIDTH, 1);
    }

    // Noise
    const noiseBg = this.add.graphics();
    this.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        noiseBg.clear();
        for (let i = 0; i < 40; i++) {
          noiseBg.fillStyle(0x33ff33, Math.random() * 0.03);
          noiseBg.fillRect(
            Phaser.Math.Between(0, GAME_WIDTH),
            Phaser.Math.Between(0, GAME_HEIGHT),
            Phaser.Math.Between(1, 3), 1,
          );
        }
      },
    });

    // ---------------------------------------------------------------
    // Title
    // ---------------------------------------------------------------
    this.add.text(GAME_WIDTH / 2, 28, 'SELECT WEAPON', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: CSS_PHOSPHOR_GREEN,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 16, fill: true },
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 68, 'Choose your signal type for this run.', {
      fontFamily: 'monospace', fontSize: '12px', color: '#557755',
    }).setOrigin(0.5);

    // ---------------------------------------------------------------
    // Weapon cards layout
    // ---------------------------------------------------------------
    const cardW = 140;
    const cardH = 140;
    const cardGap = 20;
    const totalW = this._weapons.length * cardW + (this._weapons.length - 1) * cardGap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const cardY = 120;

    this._cardGraphics = [];

    for (let i = 0; i < this._weapons.length; i++) {
      const def = this._weapons[i];
      const cx = startX + i * (cardW + cardGap) + cardW / 2;
      const cy = cardY + cardH / 2;

      // Graphics layer for this card
      const gfx = this.add.graphics();
      this._cardGraphics.push(gfx);

      // Hit zone (invisible rectangle — Phaser pointer events)
      const zone = this.add.rectangle(cx, cy, cardW, cardH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      const idx = i; // capture for closures
      zone.on('pointerover', () => {
        this._hoveredIndex = idx;
        playSFX('menu_select');
        this._redrawAllCards();
      });
      zone.on('pointerout', () => {
        this._hoveredIndex = -1;
        this._redrawAllCards();
      });
      zone.on('pointerdown', () => {
        this._selectedIndex = idx;
        this._hoveredIndex = -1;
        playSFX('item_pickup');
        this._redrawAllCards();
        this._updateInfoPanel();
      });

      // Weapon name label below card
      this.add.text(cx, cardY + cardH + 8, def.name, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#88aa88',
        align: 'center',
        wordWrap: { width: cardW },
      }).setOrigin(0.5, 0);
    }

    // Initial draw
    this._redrawAllCards();

    // ---------------------------------------------------------------
    // Info panel (below cards)
    // ---------------------------------------------------------------
    const infoPanelY = cardY + cardH + 50;
    const infoCx = GAME_WIDTH / 2;

    // Divider
    const divG = this.add.graphics();
    divG.lineStyle(1, 0x33ff33, 0.25);
    divG.lineBetween(80, infoPanelY - 4, GAME_WIDTH - 80, infoPanelY - 4);

    this._infoName = this.add.text(infoCx, infoPanelY + 4, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: CSS_HOT_WHITE,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 10, fill: true },
    }).setOrigin(0.5, 0);

    this._infoDesc = this.add.text(infoCx, infoPanelY + 34, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#aaaaaa',
      align: 'center',
      wordWrap: { width: 600 },
    }).setOrigin(0.5, 0);

    this._infoStats = this.add.text(infoCx, infoPanelY + 68, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#557755',
      align: 'center',
      wordWrap: { width: 600 },
    }).setOrigin(0.5, 0);

    this._updateInfoPanel();

    // ---------------------------------------------------------------
    // SELECT button
    // ---------------------------------------------------------------
    const selectBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, '[ SELECT — BEGIN RUN ]', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: CSS_PHOSPHOR_GREEN,
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
    selectBtn.on('pointerout',  () => selectBtn.setScale(1));
    selectBtn.on('pointerdown', () => this._startRun());

    // ENTER key selects
    this.input.keyboard!.on('keydown-ENTER', () => this._startRun());

    // Arrow key navigation
    this.input.keyboard!.on('keydown-LEFT', () => {
      this._selectedIndex = Math.max(0, this._selectedIndex - 1);
      playSFX('menu_select');
      this._redrawAllCards();
      this._updateInfoPanel();
    });
    this.input.keyboard!.on('keydown-RIGHT', () => {
      this._selectedIndex = Math.min(this._weapons.length - 1, this._selectedIndex + 1);
      playSFX('menu_select');
      this._redrawAllCards();
      this._updateInfoPanel();
    });

    // ESC goes back to RepairShopScene
    this.input.keyboard!.on('keydown-ESC', () => {
      playSFX('menu_select');
      this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress >= 1) this.scene.start('RepairShopScene');
      });
    });

    // Back label
    this.add.text(20, GAME_HEIGHT - 20, '[ ESC — BACK ]', {
      fontFamily: 'monospace', fontSize: '11px', color: '#334433',
    }).setOrigin(0, 1);

    // Arrow hints
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 26, '← → to navigate', {
      fontFamily: 'monospace', fontSize: '11px', color: '#334433',
    }).setOrigin(0.5, 1);

    this.cameras.main.fadeIn(400);
  }

  // -------------------------------------------------------------------
  // Card rendering
  // -------------------------------------------------------------------
  private _redrawAllCards(): void {
    const cardW = 140;
    const cardH = 140;
    const cardGap = 20;
    const totalW = this._weapons.length * cardW + (this._weapons.length - 1) * cardGap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const cardY = 120;

    for (let i = 0; i < this._weapons.length; i++) {
      const def = this._weapons[i];
      const cx = startX + i * (cardW + cardGap) + cardW / 2;
      const cy = cardY + cardH / 2;
      const selected = i === this._selectedIndex;
      const hovered = i === this._hoveredIndex;
      drawWeaponIcon(this._cardGraphics[i], def, cx, cy, cardW, selected, hovered);
    }
  }

  // -------------------------------------------------------------------
  // Info panel update
  // -------------------------------------------------------------------
  private _updateInfoPanel(): void {
    const def = this._weapons[this._selectedIndex];
    if (!def) return;

    this._infoName.setText(def.name);
    this._infoDesc.setText(def.description);

    const statsLine = [
      `Damage ×${def.damageMultiplier.toFixed(1)}`,
      `Fire Rate ×${def.fireRateMultiplier.toFixed(1)}`,
      `Projectiles: ${def.projectileCount}`,
      def.piercing > 0 ? `Piercing: ${def.piercing === 99 ? '∞' : def.piercing}` : null,
      def.homing > 0 ? `Homing: ${(def.homing * 100).toFixed(0)}%` : null,
      `Range: ${def.range}px`,
    ].filter(Boolean).join('   ');

    this._infoStats.setText(statsLine);
  }

  // -------------------------------------------------------------------
  // Start run
  // -------------------------------------------------------------------
  private _startRun(): void {
    const def = this._weapons[this._selectedIndex];
    if (!def) return;

    // Build run channel sequence from unlocked channels
    const save = loadSave();
    const channelOrder = ['static', 'sports', 'test_pattern', 'news', 'emergency', 'music_video', 'late_night', 'channel_9', 'channel_13'];
    const unlockedChannels = channelOrder.filter(id => save.unlockedChannels.includes(id));

    // If only 1 channel unlocked, single-channel run; otherwise multi-channel
    const channels = unlockedChannels.length > 0 ? unlockedChannels : ['static'];

    // Ascension level 10 forces Signal Zero at the end
    const ascLevel = save.ascensionLevel ?? 0;
    if (ascLevel >= 10 || this._allBossesBeaten(save)) {
      // Add off_air channel as the final gauntlet
      if (!channels.includes('off_air')) {
        channels.push('off_air');
      }
    }

    const runConfig: RunConfig = {
      channels,
      currentChannelIndex: 0,
      weaponType: def.id,
      difficultyScale: 1.0,
      characterId: this._characterId,
      ascensionLevel: ascLevel,
      dailySeed: this._dailySeed,
      endless: this._endless,
      weeklyChallenge: this._weeklyChallenge,
      weeklySeed: this._weeklySeed,
    };

    playSFX('room_transition');
    this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        this.scene.start('GameScene', runConfig as any);
      }
    });
  }

  /** Check if all regular channel bosses have been beaten at least once */
  private _allBossesBeaten(save: { bossesBeaten?: string[] }): boolean {
    const required = ['dead_channel', 'halftime', 'smpte', 'the_anchor', 'the_tone', 'the_remix', 'the_offer', 'laugh_track', 'the_narrator'];
    const beaten = save.bossesBeaten ?? [];
    return required.every(id => beaten.includes(id));
  }
}
