import { Scene, GameObjects } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CSS_PHOSPHOR_GREEN, CSS_HOT_WHITE } from '../utils/constants';
import { playSFX } from '../audio/SFXGenerator';
import { loadSave, saveToCurrent, SaveData } from '../systems/SaveManager';
import { MAX_ASCENSION, getAscensionTubeBonus } from '../systems/AscensionSystem';
import { getWeeklyChallenge, getCurrentWeekSeed, hasCompletedWeekly } from '../systems/ChallengeSystem';

// -------------------------------------------------------------------
// Layout constants
// -------------------------------------------------------------------
const PANEL_RADIUS = 4;
const PANEL_BORDER = 0x33ff33;
const PANEL_BG = 0x0d1a0d;
const PANEL_ALPHA = 0.92;

const TEXT_STYLE_LABEL: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: CSS_PHOSPHOR_GREEN,
};
const TEXT_STYLE_TITLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: CSS_HOT_WHITE,
};
const TEXT_STYLE_BODY: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#aaaaaa',
};
const TEXT_STYLE_COST: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#ffcc33',
};
const TEXT_STYLE_DISABLED: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#555555',
};

// -------------------------------------------------------------------
// Data definitions
// -------------------------------------------------------------------
interface ChannelDef {
  id: string;
  label: string;
  cost: number;
  color: number;
}

const CHANNELS: ChannelDef[] = [
  { id: 'static',        label: 'CH 2 — STATIC',        cost: 0,   color: 0x888888 },
  { id: 'sports',        label: 'CH 3 — SPORTS',        cost: 120, color: 0x33cc33 },
  { id: 'test_pattern',  label: 'CH 4 — TEST PATTERN',  cost: 100, color: 0xffcc33 },
  { id: 'news',          label: 'CH 5 — NEWS',          cost: 180, color: 0x3366ff },
  { id: 'emergency',     label: 'CH 11 — EMERGENCY',    cost: 200, color: 0xff3333 },
  { id: 'music_video',   label: 'CH 6 — MUSIC VIDEO',   cost: 250, color: 0xff33ff },
  { id: 'late_night',    label: 'CH 7 — LATE NIGHT',    cost: 300, color: 0xffcc33 },
  { id: 'channel_9',     label: 'CH 9 — CARTOON',       cost: 400, color: 0xff66aa },
  { id: 'channel_13',    label: 'CH 13 — NATURE DOC',   cost: 500, color: 0x33cc33 },
];

interface WeaponUnlockDef {
  id: string;
  name: string;
  description: string;
  cost: number;
}

const WEAPON_UNLOCKS: WeaponUnlockDef[] = [
  { id: 'phosphor_beam',       name: 'Phosphor Beam',       description: 'Default signal — always available.',    cost: 0   },
  { id: 'scan_line',           name: 'Scan Line',           description: 'Wide sweep. Pierces everything.',        cost: 150 },
  { id: 'color_burst',         name: 'Color Burst',         description: 'RGB spread. Rapid fire, short range.',   cost: 250 },
  { id: 'interference_pattern',name: 'Interference Pattern',description: 'Wavy homing signal. Slow but relentless.',cost: 400 },
];

interface UpgradeDef {
  id: string;
  label: string;
  description: string;
  costPer: number;
  maxLevel: number;
}

const UPGRADES: UpgradeDef[] = [
  { id: 'start_hp',      label: 'Starting HP +1',       description: 'Begin each run with more max HP.',         costPer: 50,  maxLevel: 3 },
  { id: 'start_damage',  label: 'Starting Damage +0.1', description: 'Passive damage bonus from the start.',     costPer: 75,  maxLevel: 5 },
  { id: 'pickup_range',  label: 'Pickup Range +20',     description: 'Pickups magnetize from farther away.',     costPer: 40,  maxLevel: 4 },
  { id: 'start_speed',   label: 'Move Speed +10',       description: 'Slightly faster default movement.',        costPer: 60,  maxLevel: 3 },
  { id: 'surf_cooldown', label: 'Surf Cooldown -100ms', description: 'Channel Surf recharges faster.',           costPer: 80,  maxLevel: 5 },
];

// -------------------------------------------------------------------
// Incoming data shape from GameOverScene
// -------------------------------------------------------------------
interface RunStats {
  score?: number;
  wave?: number;
  enemiesKilled?: number;
  itemsCollected?: number;
  time?: number;
  victory?: boolean;
  tubesEarned?: number;
}

// -------------------------------------------------------------------
// Station descriptors
// -------------------------------------------------------------------
type StationId = 'antenna' | 'shelf' | 'tuner' | 'solder' | 'tv' | 'ascension' | 'daily' | 'endless' | 'weekly';

interface StationDef {
  id: StationId;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Station layout for 960×640
const STATIONS: StationDef[] = [
  { id: 'antenna', title: 'ANTENNA ARRAY',   x: 30,  y: 140, w: 200, h: 200 },
  { id: 'shelf',   title: 'COMPONENT SHELF', x: 730, y: 140, w: 200, h: 200 },
  { id: 'tuner',   title: 'SIGNAL TUNER',    x: 260, y: 350, w: 180, h: 180 },
  { id: 'solder',  title: 'SOLDERING STATION', x: 520, y: 350, w: 180, h: 180 },
  { id: 'tv',      title: 'THE TV',          x: 380, y: 140, w: 200, h: 160 },
  { id: 'ascension', title: 'ASCENSION',     x: 30,  y: 548, w: 160, h: 72 },
  { id: 'daily',   title: 'DAILY SIGNAL',    x: 770, y: 548, w: 160, h: 72 },
  { id: 'endless', title: 'ENDLESS SIGNAL',  x: 210, y: 548, w: 160, h: 72 },
  { id: 'weekly',  title: 'WEEKLY CHALLENGE',x: 590, y: 548, w: 160, h: 72 },
];

// -------------------------------------------------------------------
// Scene
// -------------------------------------------------------------------
export class RepairShopScene extends Scene {
  private _save!: SaveData;
  private _tubesText!: GameObjects.Text;

  // Overlay layer (cleared and redrawn on each station click)
  private _overlayGroup: GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'RepairShopScene' });
  }

  // Phaser passes data from the previous scene's scene.start() call
  create(data: RunStats = {}): void {
    // ---------------------------------------------------------------
    // Load / update save data with tubes earned this run
    // ---------------------------------------------------------------
    this._save = loadSave();
    if (data.tubesEarned && data.tubesEarned > 0) {
      this._save.tubes += data.tubesEarned;
      if (data.wave !== undefined && data.wave > this._save.bestFloor) {
        this._save.bestFloor = data.wave;
      }
      if (data.enemiesKilled !== undefined) {
        this._save.totalKills += data.enemiesKilled;
      }
      this._save.totalRuns += 1;
      saveToCurrent(this._save);
    }

    // ---------------------------------------------------------------
    // Background + CRT
    // ---------------------------------------------------------------
    this.cameras.main.setBackgroundColor(0x070f07);
    this.cameras.main.setPostPipeline('CRTPipeline');

    // Subtle noise background
    const noiseBg = this.add.graphics();
    this.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        noiseBg.clear();
        for (let i = 0; i < 60; i++) {
          const nx = Phaser.Math.Between(0, GAME_WIDTH);
          const ny = Phaser.Math.Between(0, GAME_HEIGHT);
          noiseBg.fillStyle(0x33ff33, Math.random() * 0.04);
          noiseBg.fillRect(nx, ny, Phaser.Math.Between(1, 3), 1);
        }
      },
    });

    // Horizontal scanlines
    const scanlines = this.add.graphics();
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      scanlines.fillStyle(0x000000, 0.12);
      scanlines.fillRect(0, y, GAME_WIDTH, 1);
    }

    // ---------------------------------------------------------------
    // Title
    // ---------------------------------------------------------------
    this.add.text(GAME_WIDTH / 2, 30, 'REPAIR SHOP', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: CSS_PHOSPHOR_GREEN,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 20, fill: true },
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 72, 'Spend your Tubes. Prepare for the next transmission.', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#557755',
    }).setOrigin(0.5);

    // ---------------------------------------------------------------
    // Tubes display (top-right)
    // ---------------------------------------------------------------
    this._tubesText = this.add.text(GAME_WIDTH - 20, 20, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffcc33',
    }).setOrigin(1, 0);
    this._refreshTubesDisplay();

    // ---------------------------------------------------------------
    // Station panels
    // ---------------------------------------------------------------
    for (const station of STATIONS) {
      this._drawStationPanel(station);
    }

    // ---------------------------------------------------------------
    // Back / ESC → MenuScene
    // ---------------------------------------------------------------
    const backBtn = this.add.text(20, GAME_HEIGHT - 30, '[ ESC — BACK TO MENU ]', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#444444',
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#888888'));
    backBtn.on('pointerout',  () => backBtn.setColor('#444444'));
    backBtn.on('pointerdown', () => this._goBack());

    this.input.keyboard!.on('keydown-ESC', () => this._goBack());

    // Click outside overlay to dismiss it
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, gameObjects: GameObjects.GameObject[]) => {
      if (gameObjects.length === 0 && this._overlayGroup.length > 0) {
        this._closeOverlay();
      }
    });

    this.cameras.main.fadeIn(400);
  }

  // -------------------------------------------------------------------
  // Panel drawing
  // -------------------------------------------------------------------
  private _drawStationPanel(station: StationDef): void {
    const { x, y, w, h, title, id } = station;

    const bg = this.add.graphics();
    bg.fillStyle(PANEL_BG, PANEL_ALPHA);
    bg.fillRoundedRect(x, y, w, h, PANEL_RADIUS);
    bg.lineStyle(1, PANEL_BORDER, 0.6);
    bg.strokeRoundedRect(x, y, w, h, PANEL_RADIUS);

    // Title label
    this.add.text(x + w / 2, y + 14, title, {
      ...TEXT_STYLE_LABEL,
      fontSize: '11px',
    }).setOrigin(0.5, 0);

    // Divider
    const divider = this.add.graphics();
    divider.lineStyle(1, PANEL_BORDER, 0.3);
    divider.lineBetween(x + 8, y + 26, x + w - 8, y + 26);

    // Station-specific preview content
    this._drawStationPreview(station);

    // Make panel interactive
    const hitZone = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x0f2a0f, 0.95);
      bg.fillRoundedRect(x, y, w, h, PANEL_RADIUS);
      bg.lineStyle(1, PANEL_BORDER, 1.0);
      bg.strokeRoundedRect(x, y, w, h, PANEL_RADIUS);
    });

    hitZone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(PANEL_BG, PANEL_ALPHA);
      bg.fillRoundedRect(x, y, w, h, PANEL_RADIUS);
      bg.lineStyle(1, PANEL_BORDER, 0.6);
      bg.strokeRoundedRect(x, y, w, h, PANEL_RADIUS);
    });

    hitZone.on('pointerdown', () => {
      playSFX('menu_select');
      this._openStationOverlay(id);
    });
  }

  private _drawStationPreview(station: StationDef): void {
    const { x, y, w, h, id } = station;
    const cx = x + w / 2;
    const cy = y + h / 2 + 10;

    switch (id) {
      case 'antenna': {
        // Show first 3 channel unlock statuses as mini colored dots
        const preview = this.add.graphics();
        const dotSpacing = 36;
        const startX = cx - dotSpacing;
        for (let i = 0; i < Math.min(3, CHANNELS.length); i++) {
          const ch = CHANNELS[i];
          const locked = ch.cost > 0 && !this._save.unlockedChannels.includes(ch.id);
          const color = locked ? 0x333333 : ch.color;
          preview.fillStyle(color, 1);
          preview.fillCircle(startX + i * dotSpacing, cy, 8);
          preview.lineStyle(1, locked ? 0x444444 : ch.color, locked ? 0.5 : 0.8);
          preview.strokeCircle(startX + i * dotSpacing, cy, 8);
        }
        this.add.text(cx, cy + 28, 'Unlock new channels', TEXT_STYLE_BODY).setOrigin(0.5);
        break;
      }
      case 'shelf': {
        // Show locked item count
        const totalItems = 25; // from game design
        const unlockedCount = this._save.unlockedItems.length;
        const lockedCount = Math.max(0, totalItems - unlockedCount);
        this.add.text(cx, cy - 8, `${unlockedCount} / ${totalItems}`, {
          fontFamily: 'monospace', fontSize: '22px', color: CSS_PHOSPHOR_GREEN,
        }).setOrigin(0.5);
        this.add.text(cx, cy + 22, `${lockedCount} items locked`, TEXT_STYLE_BODY).setOrigin(0.5);
        break;
      }
      case 'tuner': {
        const unlockedCount = this._save.unlockedWeapons.length;
        this.add.text(cx, cy - 8, `${unlockedCount} / ${WEAPON_UNLOCKS.length}`, {
          fontFamily: 'monospace', fontSize: '22px', color: CSS_PHOSPHOR_GREEN,
        }).setOrigin(0.5);
        this.add.text(cx, cy + 22, 'weapons unlocked', TEXT_STYLE_BODY).setOrigin(0.5);
        break;
      }
      case 'solder': {
        const upgCount = Object.keys(this._save.purchasedUpgrades).length;
        this.add.text(cx, cy - 8, `${upgCount}`, {
          fontFamily: 'monospace', fontSize: '22px', color: CSS_PHOSPHOR_GREEN,
        }).setOrigin(0.5);
        this.add.text(cx, cy + 22, 'upgrades purchased', TEXT_STYLE_BODY).setOrigin(0.5);
        break;
      }
      case 'tv': {
        // Pulsing "START" indicator
        const startTxt = this.add.text(cx, cy, '► START RUN', {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: CSS_PHOSPHOR_GREEN,
          shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 14, fill: true },
        }).setOrigin(0.5);
        this.tweens.add({
          targets: startTxt,
          alpha: { from: 1, to: 0.3 },
          duration: 700,
          yoyo: true,
          repeat: -1,
        });
        break;
      }
      case 'ascension': {
        const level = this._save.ascensionLevel ?? 0;
        this.add.text(cx, cy, level > 0 ? `ASC ${level}` : 'ASC 0', {
          fontFamily: 'monospace', fontSize: '14px',
          color: level > 0 ? '#ff6633' : '#555555',
        }).setOrigin(0.5);
        break;
      }
      case 'daily': {
        this.add.text(cx, cy, '☉ DAILY', {
          fontFamily: 'monospace', fontSize: '14px', color: '#ffcc33',
        }).setOrigin(0.5);
        break;
      }
      case 'endless': {
        const bestFloor = this._save.bestEndlessFloor ?? 0;
        this.add.text(cx, cy, bestFloor > 0 ? `∞ ${bestFloor}` : '∞', {
          fontFamily: 'monospace', fontSize: '14px', color: '#ff8833',
        }).setOrigin(0.5);
        break;
      }
      case 'weekly': {
        const weekDone = hasCompletedWeekly(
          this._save.weeklyChallenge?.weekSeed,
          this._save.weeklyChallenge?.completed,
        );
        this.add.text(cx, cy, weekDone ? '✓ DONE' : '⚡ WEEKLY', {
          fontFamily: 'monospace', fontSize: '12px', color: weekDone ? '#555555' : '#ff33ff',
        }).setOrigin(0.5);
        break;
      }
    }
  }

  // -------------------------------------------------------------------
  // Overlay management
  // -------------------------------------------------------------------
  private _closeOverlay(): void {
    for (const obj of this._overlayGroup) {
      if (obj && (obj as GameObjects.GameObject).active) {
        (obj as GameObjects.GameObject).destroy();
      }
    }
    this._overlayGroup = [];
  }

  private _openStationOverlay(id: StationId): void {
    this._closeOverlay();

    switch (id) {
      case 'antenna':   this._overlayAntenna();   break;
      case 'shelf':     this._overlayShelf();     break;
      case 'tuner':     this._overlayTuner();     break;
      case 'solder':    this._overlaySolder();    break;
      case 'tv':        this._overlayTV();        break;
      case 'ascension': this._overlayAscension(); break;
      case 'daily':     this._overlayDaily();     break;
      case 'endless':   this._overlayEndless();   break;
      case 'weekly':    this._overlayWeekly();    break;
    }
  }

  // Draw a full overlay panel centered on screen
  private _makeOverlayBase(title: string): { panelX: number; panelY: number; panelW: number; panelH: number } {
    const panelW = 560;
    const panelH = 380;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;

    // Dim background
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setInteractive();
    dim.on('pointerdown', () => this._closeOverlay());
    this._overlayGroup.push(dim);

    // Panel
    const panel = this.add.graphics();
    panel.fillStyle(0x050f05, 0.98);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 6);
    panel.lineStyle(1, PANEL_BORDER, 0.8);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 6);
    this._overlayGroup.push(panel);

    // Title
    const titleTxt = this.add.text(panelX + panelW / 2, panelY + 20, title, {
      ...TEXT_STYLE_TITLE,
      fontSize: '16px',
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 10, fill: true },
    }).setOrigin(0.5, 0);
    this._overlayGroup.push(titleTxt);

    // Divider
    const div = this.add.graphics();
    div.lineStyle(1, PANEL_BORDER, 0.4);
    div.lineBetween(panelX + 20, panelY + 46, panelX + panelW - 20, panelY + 46);
    this._overlayGroup.push(div);

    // Close button
    const closeBtn = this.add.text(panelX + panelW - 12, panelY + 12, '✕', {
      fontFamily: 'monospace', fontSize: '14px', color: '#666666',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor(CSS_HOT_WHITE));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#666666'));
    closeBtn.on('pointerdown', () => this._closeOverlay());
    this._overlayGroup.push(closeBtn);

    return { panelX, panelY, panelW, panelH };
  }

  // -------------------------------------------------------------------
  // Antenna Array overlay — channel unlocks
  // -------------------------------------------------------------------
  private _overlayAntenna(): void {
    const { panelX, panelY, panelW } = this._makeOverlayBase('ANTENNA ARRAY — Channel Unlocks');
    let rowY = panelY + 64;

    for (const ch of CHANNELS) {
      const isUnlocked = ch.cost === 0 || this._save.unlockedChannels.includes(ch.id);
      const canAfford = this._save.tubes >= ch.cost;

      // Color swatch
      const swatch = this.add.graphics();
      swatch.fillStyle(isUnlocked ? ch.color : 0x333333, 1);
      swatch.fillCircle(panelX + 40, rowY + 8, 8);
      this._overlayGroup.push(swatch);

      // Channel name
      const nameStyle = isUnlocked ? TEXT_STYLE_TITLE : TEXT_STYLE_DISABLED;
      const nameTxt = this.add.text(panelX + 60, rowY, ch.label, { ...nameStyle, fontSize: '13px' });
      this._overlayGroup.push(nameTxt);

      if (isUnlocked) {
        const unlkTxt = this.add.text(panelX + panelW - 30, rowY, 'UNLOCKED', {
          fontFamily: 'monospace', fontSize: '11px', color: CSS_PHOSPHOR_GREEN,
        }).setOrigin(1, 0);
        this._overlayGroup.push(unlkTxt);
      } else if (ch.cost === 0) {
        // Free default
      } else {
        const costStyle = canAfford ? TEXT_STYLE_COST : TEXT_STYLE_DISABLED;
        const costTxt = this.add.text(panelX + panelW - 30, rowY, `${ch.cost} tubes`, costStyle).setOrigin(1, 0);
        this._overlayGroup.push(costTxt);

        if (canAfford) {
          const buyBtn = this.add.text(panelX + panelW - 30, rowY + 16, '[ BUY ]', {
            fontFamily: 'monospace', fontSize: '11px', color: CSS_PHOSPHOR_GREEN,
          }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
          buyBtn.on('pointerover', () => buyBtn.setColor(CSS_HOT_WHITE));
          buyBtn.on('pointerout',  () => buyBtn.setColor(CSS_PHOSPHOR_GREEN));
          buyBtn.on('pointerdown', () => {
            this._purchase(ch.cost, () => {
              this._save.unlockedChannels.push(ch.id);
            });
          });
          this._overlayGroup.push(buyBtn);
        }
      }

      rowY += 70;
    }
  }

  // -------------------------------------------------------------------
  // Component Shelf overlay — item unlocks
  // -------------------------------------------------------------------
  private _overlayShelf(): void {
    const { panelX, panelY, panelW } = this._makeOverlayBase('COMPONENT SHELF — Item Unlocks');

    // Show a subset of items that can be unlocked
    // For Phase 3 we display a placeholder grid of locked items
    const ITEM_COST = 80;
    const cols = 6;
    const cellSize = 60;
    const gridStartX = panelX + (panelW - cols * cellSize) / 2;
    const gridStartY = panelY + 60;

    // We represent locked items with "?" boxes
    const TOTAL_ITEMS = 25;
    const unlocked = this._save.unlockedItems.length;

    for (let i = 0; i < Math.min(TOTAL_ITEMS, 18); i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = gridStartX + col * cellSize + cellSize / 2;
      const cy = gridStartY + row * cellSize + cellSize / 2;
      const isUnlocked = i < unlocked;

      const cell = this.add.graphics();
      cell.lineStyle(1, isUnlocked ? 0x33ff33 : 0x333333, 0.7);
      cell.strokeRect(cx - 20, cy - 20, 40, 40);
      cell.fillStyle(isUnlocked ? 0x0a1a0a : 0x0a0a0a, 0.8);
      cell.fillRect(cx - 20, cy - 20, 40, 40);
      this._overlayGroup.push(cell);

      const label = this.add.text(cx, cy, isUnlocked ? '■' : '?', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: isUnlocked ? CSS_PHOSPHOR_GREEN : '#444444',
      }).setOrigin(0.5);
      this._overlayGroup.push(label);
    }

    const info = this.add.text(panelX + panelW / 2, panelY + 340, `Locked items unlock as you complete runs. Cost: ${ITEM_COST} tubes each.`, {
      ...TEXT_STYLE_BODY,
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5, 1);
    this._overlayGroup.push(info);
  }

  // -------------------------------------------------------------------
  // Signal Tuner overlay — weapon unlocks
  // -------------------------------------------------------------------
  private _overlayTuner(): void {
    const { panelX, panelY, panelW } = this._makeOverlayBase('SIGNAL TUNER — Weapon Unlocks');
    let rowY = panelY + 60;

    for (const wpn of WEAPON_UNLOCKS) {
      const isUnlocked = this._save.unlockedWeapons.includes(wpn.id);
      const canAfford = !isUnlocked && this._save.tubes >= wpn.cost;

      const nameStyle = isUnlocked ? TEXT_STYLE_LABEL : (wpn.cost === 0 ? TEXT_STYLE_LABEL : TEXT_STYLE_DISABLED);
      const nameTxt = this.add.text(panelX + 30, rowY, wpn.name, { ...nameStyle, fontSize: '13px' });
      this._overlayGroup.push(nameTxt);

      const descTxt = this.add.text(panelX + 30, rowY + 16, wpn.description, {
        ...TEXT_STYLE_BODY,
        wordWrap: { width: panelW - 180 },
      });
      this._overlayGroup.push(descTxt);

      if (isUnlocked || wpn.cost === 0) {
        const unlkTxt = this.add.text(panelX + panelW - 30, rowY, 'UNLOCKED', {
          fontFamily: 'monospace', fontSize: '11px', color: CSS_PHOSPHOR_GREEN,
        }).setOrigin(1, 0);
        this._overlayGroup.push(unlkTxt);
      } else {
        const costTxt = this.add.text(panelX + panelW - 30, rowY, `${wpn.cost} tubes`, {
          ...TEXT_STYLE_COST,
          color: canAfford ? '#ffcc33' : '#555555',
        }).setOrigin(1, 0);
        this._overlayGroup.push(costTxt);

        if (canAfford) {
          const buyBtn = this.add.text(panelX + panelW - 30, rowY + 18, '[ BUY ]', {
            fontFamily: 'monospace', fontSize: '11px', color: CSS_PHOSPHOR_GREEN,
          }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
          buyBtn.on('pointerover', () => buyBtn.setColor(CSS_HOT_WHITE));
          buyBtn.on('pointerout',  () => buyBtn.setColor(CSS_PHOSPHOR_GREEN));
          buyBtn.on('pointerdown', () => {
            this._purchase(wpn.cost, () => {
              this._save.unlockedWeapons.push(wpn.id);
            });
          });
          this._overlayGroup.push(buyBtn);
        }
      }

      rowY += 78;
    }
  }

  // -------------------------------------------------------------------
  // Soldering Station overlay — permanent upgrades
  // -------------------------------------------------------------------
  private _overlaySolder(): void {
    const { panelX, panelY, panelW } = this._makeOverlayBase('SOLDERING STATION — Permanent Upgrades');
    let rowY = panelY + 58;

    for (const upg of UPGRADES) {
      const currentLevel = this._save.purchasedUpgrades[upg.id] ?? 0;
      const maxed = currentLevel >= upg.maxLevel;
      const cost = upg.costPer * (currentLevel + 1);
      const canAfford = !maxed && this._save.tubes >= cost;

      const nameStyle = maxed ? TEXT_STYLE_DISABLED : TEXT_STYLE_LABEL;
      const nameTxt = this.add.text(panelX + 30, rowY, upg.label, { ...nameStyle, fontSize: '12px' });
      this._overlayGroup.push(nameTxt);

      // Level pips
      const pipG = this.add.graphics();
      for (let p = 0; p < upg.maxLevel; p++) {
        pipG.fillStyle(p < currentLevel ? 0x33ff33 : 0x333333, 1);
        pipG.fillRect(panelX + 30 + p * 12, rowY + 16, 8, 4);
      }
      this._overlayGroup.push(pipG);

      const descTxt = this.add.text(panelX + 30, rowY + 26, upg.description, TEXT_STYLE_BODY);
      this._overlayGroup.push(descTxt);

      if (maxed) {
        const maxTxt = this.add.text(panelX + panelW - 30, rowY, 'MAXED', {
          fontFamily: 'monospace', fontSize: '11px', color: '#555555',
        }).setOrigin(1, 0);
        this._overlayGroup.push(maxTxt);
      } else {
        const costTxt = this.add.text(panelX + panelW - 30, rowY, `${cost} tubes (Lv${currentLevel + 1})`, {
          fontFamily: 'monospace', fontSize: '11px',
          color: canAfford ? '#ffcc33' : '#555555',
        }).setOrigin(1, 0);
        this._overlayGroup.push(costTxt);

        if (canAfford) {
          const buyBtn = this.add.text(panelX + panelW - 30, rowY + 18, '[ UPGRADE ]', {
            fontFamily: 'monospace', fontSize: '11px', color: CSS_PHOSPHOR_GREEN,
          }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
          buyBtn.on('pointerover', () => buyBtn.setColor(CSS_HOT_WHITE));
          buyBtn.on('pointerout',  () => buyBtn.setColor(CSS_PHOSPHOR_GREEN));
          buyBtn.on('pointerdown', () => {
            this._purchase(cost, () => {
              this._save.purchasedUpgrades[upg.id] = currentLevel + 1;
            });
          });
          this._overlayGroup.push(buyBtn);
        }
      }

      rowY += 62;
    }
  }

  // -------------------------------------------------------------------
  // The TV overlay — start run confirmation
  // -------------------------------------------------------------------
  private _overlayTV(): void {
    const { panelX, panelY, panelW, panelH } = this._makeOverlayBase('THE TV — Begin Transmission');
    const cx = panelX + panelW / 2;
    const cy = panelY + panelH / 2 + 20;

    const prompt = this.add.text(cx, cy - 40, 'Select your weapon and begin the run.', {
      fontFamily: 'monospace', fontSize: '13px', color: '#aaaaaa',
      wordWrap: { width: panelW - 60 },
      align: 'center',
    }).setOrigin(0.5);
    this._overlayGroup.push(prompt);

    const startBtn = this.add.text(cx, cy + 20, '[ START RUN ]', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: CSS_PHOSPHOR_GREEN,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 16, fill: true },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.tweens.add({
      targets: startBtn,
      alpha: { from: 1, to: 0.5 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    startBtn.on('pointerover', () => { startBtn.setScale(1.05); });
    startBtn.on('pointerout',  () => { startBtn.setScale(1); });
    startBtn.on('pointerdown', () => {
      playSFX('room_transition');
      this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress >= 1) {
          this.scene.start('CharacterSelectScene');
        }
      });
    });
    this._overlayGroup.push(startBtn);

    const hint = this.add.text(cx, cy + 60, 'Choose your character and weapon on the next screens.', {
      fontFamily: 'monospace', fontSize: '11px', color: '#445544',
    }).setOrigin(0.5);
    this._overlayGroup.push(hint);
  }

  // -------------------------------------------------------------------
  // Ascension overlay
  // -------------------------------------------------------------------
  private _overlayAscension(): void {
    const { panelX, panelY, panelW } = this._makeOverlayBase('ASCENSION — Increase Difficulty');
    const level = this._save.ascensionLevel ?? 0;
    const maxReached = this._save.maxAscensionReached ?? 0;

    const cx = panelX + panelW / 2;
    let yy = panelY + 60;

    this._overlayGroup.push(this.add.text(cx, yy, `Current Ascension: ${level}`, {
      fontFamily: 'monospace', fontSize: '20px', color: level > 0 ? '#ff6633' : CSS_PHOSPHOR_GREEN,
    }).setOrigin(0.5));
    yy += 30;

    this._overlayGroup.push(this.add.text(cx, yy, `Highest Reached: ${maxReached}`, {
      ...TEXT_STYLE_BODY,
    }).setOrigin(0.5));
    yy += 30;

    // Description
    const descriptions = [
      'Enemy HP +15%, Proj speed +10%, Shop cost +25%',
      'Enemy count +20%',
      'Player takes +50% damage',
      'Surf cooldown +25%, fewer item rooms',
      'Enemy speed +10%, enemy HP +30%',
      'Shop cost +50%, player takes +100% damage',
      'Enemy count +40%, surf cooldown +50%',
      'Enemy HP +50%, item rooms -40%',
      'Boss extra phase',
      'All modifiers max + mandatory Signal Zero',
    ];

    if (level < MAX_ASCENSION) {
      this._overlayGroup.push(this.add.text(cx, yy, `Level ${level + 1}: ${descriptions[level] ?? 'Unknown'}`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa',
        wordWrap: { width: panelW - 60 },
        align: 'center',
      }).setOrigin(0.5));
      yy += 30;

      const tubeBonus = Math.round((getAscensionTubeBonus(level + 1) - 1) * 100);
      this._overlayGroup.push(this.add.text(cx, yy, `Tube bonus: +${tubeBonus}%`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffcc33',
      }).setOrigin(0.5));
      yy += 40;
    }

    // Increase button
    if (level < MAX_ASCENSION) {
      const incBtn = this.add.text(cx, yy, `[ INCREASE TO ASC ${level + 1} ]`, {
        fontFamily: 'monospace', fontSize: '14px', color: CSS_PHOSPHOR_GREEN,
        shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 10, fill: true },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      incBtn.on('pointerover', () => incBtn.setColor(CSS_HOT_WHITE));
      incBtn.on('pointerout',  () => incBtn.setColor(CSS_PHOSPHOR_GREEN));
      incBtn.on('pointerdown', () => {
        playSFX('item_pickup');
        this._save.ascensionLevel = level + 1;
        saveToCurrent(this._save);
        this._closeOverlay();
        this._overlayAscension();
      });
      this._overlayGroup.push(incBtn);
      yy += 30;
    }

    // Decrease button
    if (level > 0) {
      const decBtn = this.add.text(cx, yy, `[ DECREASE TO ASC ${level - 1} ]`, {
        fontFamily: 'monospace', fontSize: '12px', color: '#666666',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      decBtn.on('pointerover', () => decBtn.setColor('#aaaaaa'));
      decBtn.on('pointerout',  () => decBtn.setColor('#666666'));
      decBtn.on('pointerdown', () => {
        playSFX('menu_select');
        this._save.ascensionLevel = level - 1;
        saveToCurrent(this._save);
        this._closeOverlay();
        this._overlayAscension();
      });
      this._overlayGroup.push(decBtn);
    }
  }

  // -------------------------------------------------------------------
  // Daily Signal overlay
  // -------------------------------------------------------------------
  private _overlayDaily(): void {
    const { panelX, panelY, panelW, panelH } = this._makeOverlayBase('DAILY SIGNAL — Seeded Run');
    const cx = panelX + panelW / 2;
    let yy = panelY + 60;

    const today = new Date().toISOString().slice(0, 10);
    const dailyData = this._save.dailyRun;
    const alreadyPlayed = dailyData?.date === today && dailyData?.completed;

    this._overlayGroup.push(this.add.text(cx, yy, `Today's Seed: ${today}`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffcc33',
    }).setOrigin(0.5));
    yy += 30;

    this._overlayGroup.push(this.add.text(cx, yy,
      'Same seed, same dungeon layout.\nOne attempt per day. Compare your results!', {
        fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa',
        align: 'center', wordWrap: { width: panelW - 60 },
      }).setOrigin(0.5));
    yy += 50;

    if (alreadyPlayed) {
      this._overlayGroup.push(this.add.text(cx, yy, 'COMPLETED', {
        fontFamily: 'monospace', fontSize: '20px', color: CSS_PHOSPHOR_GREEN,
      }).setOrigin(0.5));
      yy += 30;

      if (dailyData?.score !== undefined) {
        this._overlayGroup.push(this.add.text(cx, yy, `Score: ${dailyData.score}`, {
          fontFamily: 'monospace', fontSize: '14px', color: '#aaaaaa',
        }).setOrigin(0.5));
        yy += 24;
      }

      this._overlayGroup.push(this.add.text(cx, yy, 'Come back tomorrow for a new seed.', {
        fontFamily: 'monospace', fontSize: '11px', color: '#555555',
      }).setOrigin(0.5));
    } else {
      const startBtn = this.add.text(cx, yy, '[ START DAILY RUN ]', {
        fontFamily: 'monospace', fontSize: '18px', color: CSS_PHOSPHOR_GREEN,
        shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 14, fill: true },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      this.tweens.add({
        targets: startBtn,
        alpha: { from: 1, to: 0.4 },
        duration: 700,
        yoyo: true,
        repeat: -1,
      });

      startBtn.on('pointerover', () => startBtn.setScale(1.05));
      startBtn.on('pointerout',  () => startBtn.setScale(1));
      startBtn.on('pointerdown', () => {
        // Mark daily as attempted
        this._save.dailyRun = { date: today, completed: false, score: 0, seed: today };
        saveToCurrent(this._save);

        playSFX('room_transition');
        this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
          if (progress >= 1) {
            this.scene.start('CharacterSelectScene', { dailySeed: today });
          }
        });
      });
      this._overlayGroup.push(startBtn);
    }
  }

  // -------------------------------------------------------------------
  // Endless Signal overlay
  // -------------------------------------------------------------------
  private _overlayEndless(): void {
    const { panelX, panelY, panelW, panelH } = this._makeOverlayBase('ENDLESS SIGNAL — Survive Forever');
    const cx = panelX + panelW / 2;
    let yy = panelY + 60;

    const bestFloor = this._save.bestEndlessFloor ?? 0;

    this._overlayGroup.push(this.add.text(cx, yy, bestFloor > 0 ? `Best: Floor ${bestFloor}` : 'No endless runs yet', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ff8833',
    }).setOrigin(0.5));
    yy += 30;

    this._overlayGroup.push(this.add.text(cx, yy,
      'Channels cycle endlessly with increasing difficulty.\nSurvive as long as you can.', {
        fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa',
        align: 'center', wordWrap: { width: panelW - 60 },
      }).setOrigin(0.5));
    yy += 60;

    const startBtn = this.add.text(cx, yy, '[ START ENDLESS RUN ]', {
      fontFamily: 'monospace', fontSize: '18px', color: CSS_PHOSPHOR_GREEN,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 14, fill: true },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.tweens.add({
      targets: startBtn,
      alpha: { from: 1, to: 0.4 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    startBtn.on('pointerover', () => startBtn.setScale(1.05));
    startBtn.on('pointerout',  () => startBtn.setScale(1));
    startBtn.on('pointerdown', () => {
      playSFX('room_transition');
      this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress >= 1) {
          this.scene.start('CharacterSelectScene', { endless: true });
        }
      });
    });
    this._overlayGroup.push(startBtn);
  }

  // -------------------------------------------------------------------
  // Weekly Challenge overlay
  // -------------------------------------------------------------------
  private _overlayWeekly(): void {
    const { panelX, panelY, panelW } = this._makeOverlayBase('WEEKLY CHALLENGE');
    const cx = panelX + panelW / 2;
    let yy = panelY + 60;

    const challenge = getWeeklyChallenge();
    const alreadyDone = hasCompletedWeekly(
      this._save.weeklyChallenge?.weekSeed,
      this._save.weeklyChallenge?.completed,
    );

    this._overlayGroup.push(this.add.text(cx, yy, challenge.name, {
      fontFamily: 'monospace', fontSize: '20px', color: '#ff33ff',
      shadow: { offsetX: 0, offsetY: 0, color: '#ff33ff', blur: 10, fill: true },
    }).setOrigin(0.5));
    yy += 30;

    this._overlayGroup.push(this.add.text(cx, yy, challenge.description, {
      fontFamily: 'monospace', fontSize: '12px', color: '#aaaaaa',
      align: 'center', wordWrap: { width: panelW - 60 },
    }).setOrigin(0.5));
    yy += 50;

    if (alreadyDone) {
      this._overlayGroup.push(this.add.text(cx, yy, 'COMPLETED', {
        fontFamily: 'monospace', fontSize: '20px', color: CSS_PHOSPHOR_GREEN,
      }).setOrigin(0.5));
      yy += 30;

      if (this._save.weeklyChallenge?.score) {
        this._overlayGroup.push(this.add.text(cx, yy, `Score: ${this._save.weeklyChallenge.score}`, {
          fontFamily: 'monospace', fontSize: '14px', color: '#aaaaaa',
        }).setOrigin(0.5));
      }
      yy += 30;

      this._overlayGroup.push(this.add.text(cx, yy, 'Come back next week for a new challenge.', {
        fontFamily: 'monospace', fontSize: '11px', color: '#555555',
      }).setOrigin(0.5));
    } else {
      const startBtn = this.add.text(cx, yy, '[ START WEEKLY CHALLENGE ]', {
        fontFamily: 'monospace', fontSize: '16px', color: '#ff33ff',
        shadow: { offsetX: 0, offsetY: 0, color: '#ff33ff', blur: 14, fill: true },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      this.tweens.add({
        targets: startBtn,
        alpha: { from: 1, to: 0.4 },
        duration: 700,
        yoyo: true,
        repeat: -1,
      });

      startBtn.on('pointerover', () => startBtn.setScale(1.05));
      startBtn.on('pointerout',  () => startBtn.setScale(1));
      startBtn.on('pointerdown', () => {
        playSFX('challenge_start');
        this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
          if (progress >= 1) {
            this.scene.start('CharacterSelectScene', {
              weeklyChallenge: true,
              weeklySeed: getCurrentWeekSeed(),
            });
          }
        });
      });
      this._overlayGroup.push(startBtn);
    }
  }

  // -------------------------------------------------------------------
  // Purchase helper
  // -------------------------------------------------------------------
  private _purchase(cost: number, applyFn: () => void): void {
    if (this._save.tubes < cost) return;
    playSFX('item_pickup');
    this._save.tubes -= cost;
    applyFn();
    saveToCurrent(this._save);
    this._refreshTubesDisplay();
    // Close and re-open overlay so content refreshes
    this._closeOverlay();
  }

  private _refreshTubesDisplay(): void {
    this._tubesText.setText(`TUBES: ${this._save.tubes}`);
  }

  // -------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------
  private _goBack(): void {
    playSFX('menu_select');
    this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) this.scene.start('MenuScene');
    });
  }
}
