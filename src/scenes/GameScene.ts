import { Scene, Physics, GameObjects } from 'phaser';
import { Player } from '../entities/Player';
import { Enemy, EnemyProjectile } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Pickup, PickupType } from '../entities/Pickup';
import { Boss } from '../entities/Boss';
import { BossSMPTE } from '../entities/BossSMPTE';
import { BossTone } from '../entities/BossTone';
import { BossOffer } from '../entities/BossOffer';
import { BossLaughTrack } from '../entities/BossLaughTrack';
import { BossNarrator } from '../entities/BossNarrator';
import { BossSignalZero } from '../entities/BossSignalZero';
import { BossHalftime } from '../entities/BossHalftime';
import { BossAnchor } from '../entities/BossAnchor';
import { BossRemix } from '../entities/BossRemix';
import { BeatSystem } from '../systems/BeatSystem';
import { checkSynergies, SynergyDef } from '../systems/SynergySystem';
import { getWeeklyChallenge } from '../systems/ChallengeSystem';
import { ItemSystem } from '../systems/ItemSystem';
import { generateFloor, FloorMap, coordKey, parseKey, DIR_OFFSET, OPPOSITE, getAdjacentRoom } from '../systems/DungeonGenerator';
import { Cell, CellGrid, RoomData, Direction, CELL_SIZE } from '../data/rooms';
import { ENEMY_CONFIGS } from '../data/enemies';
import { ItemDef, getRandomItem, RARITY_COLORS, RARITY_COST, ALL_ITEMS, ItemEventContext, PlayerStats } from '../data/items';
import { CHANNEL_REGISTRY, ChannelDef } from '../data/channels';
import { BOSS_DEFS } from '../data/bosses';
import { playSFX, SFXKey } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { CRTPipeline } from '../rendering/CRTShader';
import { loadSave, saveToCurrent } from '../systems/SaveManager';
import { checkAchievements, RunStats as AchievementRunStats } from '../systems/AchievementSystem';
import { getCharacterDef } from '../data/characters';
import { loadSettings } from '../systems/SettingsManager';
import { getAscensionModifiers, getAscensionTubeBonus, AscensionModifiers } from '../systems/AscensionSystem';
import { logEvent } from '../debug/EventLog';

// Union type for all boss implementations
type AnyBoss = Boss | BossSMPTE | BossTone | BossOffer | BossLaughTrack | BossNarrator | BossSignalZero | BossHalftime | BossAnchor | BossRemix;

/** Configuration for a multi-channel run. */
export interface RunConfig {
  channels: string[];           // channel IDs in order, e.g. ['static', 'test_pattern', 'emergency']
  currentChannelIndex: number;  // which channel we're on (0, 1, 2)
  weaponType: string;
  difficultyScale: number;      // multiplier for enemy HP/count (1.0, 1.3, 1.6 per channel)
  characterId?: string;         // Phase 4: selected character
  ascensionLevel?: number;      // Phase 4: ascension difficulty level
  dailySeed?: string;           // Phase 4: daily run seed (if daily run)
  endless?: boolean;            // Phase 5: endless mode — cycle channels after last boss
  endlessCycle?: number;        // which cycle we're on (0, 1, 2, ...)
  weeklyChallenge?: boolean;    // Phase 5: weekly challenge run
  weeklySeed?: number;          // week seed for challenge generation
  // Carried between channels:
  carryOverHP?: number;
  carryOverTubes?: number;
  carryOverItems?: string[];    // item IDs collected so far
  carryOverScore?: number;
  carryOverEnemiesKilled?: number;
  carryOverRoomsCleared?: number;
  carryOverStartTime?: number;  // original run start time (ms since epoch)
}
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
  HUD_MARGIN,
  HP_DOT_SPACING,
  HP_DOT_SIZE,
  CSS_PHOSPHOR_GREEN,
  MINIMAP_ROOM_SIZE,
  MINIMAP_PADDING,
  MINIMAP_X,
  MINIMAP_Y,
  ROOM_TRANSITION_DURATION,
} from '../utils/constants';

export class GameScene extends Scene {
  // Core
  private _player!: Player;
  private _items!: ItemSystem;
  private _floor!: FloorMap;
  private _currentRoomX = 0;
  private _currentRoomY = 0;

  // Entities
  private _enemies: Enemy[] = [];
  private _boss: AnyBoss | null = null;
  private _pickups: Pickup[] = [];
  private _enemyProjectiles!: Physics.Arcade.Group;

  // Channel / run config
  private _channelId = 'static';
  private _channelDef: ChannelDef = CHANNEL_REGISTRY['static'];
  private _runConfig: RunConfig | null = null;

  // Room geometry
  private _wallBodies: Physics.Arcade.StaticGroup | null = null;
  private _doorSprites: Map<Direction, GameObjects.Rectangle> = new Map();
  private _doorBodies: Map<Direction, Physics.Arcade.StaticBody> = new Map();
  private _roomDecorations: GameObjects.GameObject[] = [];
  private _pitZones: { x: number; y: number; w: number; h: number }[] = [];

  // Item room / shop
  private _itemPedestals: { sprite: GameObjects.Image; item: ItemDef; cost: number; label: GameObjects.Text }[] = [];

  // HUD
  private _hpDots: GameObjects.Image[] = [];
  private _channelText!: GameObjects.Text;
  private _scoreText!: GameObjects.Text;
  private _tubeText!: GameObjects.Text;
  private _bombText!: GameObjects.Text;
  private _cooldownBar!: GameObjects.Graphics;
  private _minimapGraphics!: GameObjects.Graphics;
  private _roomClearedText: GameObjects.Text | null = null;

  // State
  private _score = 0;
  private _enemiesKilled = 0;
  private _roomsCleared = 0;
  private _transitioning = false;
  private _roomCleared = false;
  private _startTime = 0;
  private _noiseGraphics!: GameObjects.Graphics;
  private _bossNameText: GameObjects.Text | null = null;

  // Hit stop (global freeze for 2 frames when player takes damage)
  private _hitStopTimer = 0;
  private _bossHitsTaken = 0;
  private _ascension: AscensionModifiers | null = null;
  private _beatSystem: BeatSystem | null = null;
  private _activeSynergies: Set<string> = new Set();
  private _practiceMode = false;
  private _reduceMotion = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data: RunConfig | { weaponType?: string; channelId?: string } = {}): void {
    // Detect whether we received a full RunConfig or a simple legacy object
    if ('channels' in data && Array.isArray((data as RunConfig).channels)) {
      this._runConfig = data as RunConfig;
      this._channelId = this._runConfig.channels[this._runConfig.currentChannelIndex] ?? 'static';
    } else {
      const legacy = data as { weaponType?: string; channelId?: string };
      // Build a single-channel RunConfig for backward compatibility
      this._runConfig = {
        channels: [legacy.channelId ?? 'static'],
        currentChannelIndex: 0,
        weaponType: legacy.weaponType ?? 'phosphor_beam',
        difficultyScale: 1.0,
      };
      this._channelId = legacy.channelId ?? 'static';
    }
    this._channelDef = CHANNEL_REGISTRY[this._channelId] ?? CHANNEL_REGISTRY['static'];

    this.cameras.main.setBackgroundColor(this._channelDef.palette.bg);
    this.cameras.main.setPostPipeline('CRTPipeline');

    // Apply channel-specific CRT visual params
    const crtPipelines = this.cameras.main.getPostPipeline('CRTPipeline');
    if (crtPipelines) {
      const pipelines = Array.isArray(crtPipelines) ? crtPipelines : [crtPipelines];
      for (const p of pipelines) {
        if (p instanceof CRTPipeline) {
          p.setChannelParams(this._channelId);
        }
      }
    }

    // Use carried-over start time or begin a new timer
    this._startTime = this._runConfig.carryOverStartTime ?? Date.now();

    // Enemy projectile group
    this._enemyProjectiles = this.physics.add.group({ runChildUpdate: true });

    // Item system
    this._items = new ItemSystem();

    // Apply character stat modifiers
    const charId = this._runConfig.characterId ?? 'standard';
    const charDef = getCharacterDef(charId);
    if (charDef && charDef.statMods) {
      for (const [key, value] of Object.entries(charDef.statMods)) {
        const statKey = key as keyof typeof this._items.stats;
        if (statKey in this._items.stats && typeof value === 'number') {
          (this._items.stats[statKey] as number) += value;
        }
      }
    }

    // Apply ascension modifiers
    const ascLevel = this._runConfig.ascensionLevel ?? 0;
    this._ascension = getAscensionModifiers(ascLevel);

    // Ascension: increase surf cooldown
    if (this._ascension.surfCooldownMultiplier !== 1) {
      this._items.stats.surfCooldown *= this._ascension.surfCooldownMultiplier;
    }

    // Apply weekly challenge modifiers
    if (this._runConfig.weeklyChallenge && this._runConfig.weeklySeed != null) {
      const challenge = getWeeklyChallenge(this._runConfig.weeklySeed);
      for (const [key, value] of Object.entries(challenge.statMods)) {
        const statKey = key as keyof typeof this._items.stats;
        if (statKey in this._items.stats && typeof value === 'number') {
          (this._items.stats[statKey] as number) += value;
        }
      }
    }

    // BeatSystem for music_video channel
    if (this._channelId === 'music_video') {
      this._beatSystem = new BeatSystem(this);
    } else {
      this._beatSystem = null;
    }

    // Load accessibility settings
    const gameSettings = loadSettings();
    this._practiceMode = gameSettings.practiceMode;
    this._reduceMotion = gameSettings.reduceMotion;

    // Practice mode: show watermark
    if (this._practiceMode) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'PRACTICE', {
        fontFamily: 'monospace', fontSize: '48px', color: '#33ff33',
      }).setOrigin(0.5).setAlpha(0.15).setDepth(0).setScrollFactor(0);
    }

    // Reduce motion: disable screen shake
    if (this._reduceMotion) {
      this._items.stats.screenShake = 0;
    }

    // Rally buff event handler
    this.events.on('rally-buff', (data: { x: number; y: number; radius: number; multiplier: number; duration: number }) => {
      for (const enemy of this._enemies) {
        if (!enemy.active) continue;
        const dist = Phaser.Math.Distance.Between(data.x, data.y, enemy.x, enemy.y);
        if (dist < data.radius) {
          enemy.applySpeedBuff(data.multiplier, data.duration);
        }
      }
    });

    // Restore carried-over items from previous channels
    if (this._runConfig.carryOverItems && this._runConfig.carryOverItems.length > 0) {
      for (const itemId of this._runConfig.carryOverItems) {
        const itemDef = ALL_ITEMS.find((it) => it.id === itemId);
        if (itemDef) {
          this._items.applyItem(itemDef);
        }
      }
    }

    // Restore carried-over tubes
    if (this._runConfig.carryOverTubes != null) {
      this._items.tubes = this._runConfig.carryOverTubes;
    }

    // Restore carried-over score and stats
    this._score = this._runConfig.carryOverScore ?? 0;
    this._enemiesKilled = this._runConfig.carryOverEnemiesKilled ?? 0;
    this._roomsCleared = this._runConfig.carryOverRoomsCleared ?? 0;

    // Generate floor with channel-specific room count and difficulty scaling
    // Ascension multiplies enemy count; adjust difficulty scale
    const baseDiffScale = this._runConfig.difficultyScale;
    const diffScale = baseDiffScale * (this._ascension?.enemyHPMultiplier ?? 1);
    const { min, max } = this._channelDef.roomCount;
    const roomCount = min + Math.floor(Math.random() * (max - min + 1));
    // Pass daily seed for deterministic generation
    this._floor = generateFloor(roomCount > 0 ? roomCount : 10, this._channelDef.enemyPool, diffScale, this._runConfig.dailySeed);

    // Background noise
    this._noiseGraphics = this.add.graphics();
    this._noiseGraphics.setDepth(-1);

    // Build initial room (spawn)
    this._currentRoomX = 0;
    this._currentRoomY = 0;
    this._buildRoom();

    // Player — pass through weapon type from RunConfig
    const weaponType = this._runConfig.weaponType ?? 'phosphor_beam';
    this._player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, this._items, weaponType);

    // Restore carried-over HP
    if (this._runConfig.carryOverHP != null) {
      this._player.hp = this._runConfig.carryOverHP;
      this._player.maxHp = Math.ceil(this._items.stats.maxHP);
    }

    // Practice mode: permanent invulnerability
    if (this._practiceMode) {
      this._player.isInvulnerable = true;
    }

    // World bounds
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Set up collisions
    this._setupCollisions();

    // Create HUD
    this._createHUD();

    // Events
    this.events.on('player-death', this._onPlayerDeath, this);
    this.events.on('player-bomb', this._onBomb, this);
    this.events.on('boss-defeated', this._onBossDefeated, this);
    this.events.on('boss-spawn-add', this._onBossSpawnAdd, this);
    this.events.on('enemy-split', this._onEnemySplit, this);
    this.events.on('enemy-spawn-clone', this._onEnemySpawnClone, this);
    this.events.on('boss-phase-transition', this._onBossPhaseTransition, this);

    this._drawNoise();

    // ESC key → launch PauseOverlay
    this.input.keyboard!.on('keydown-ESC', () => {
      if (!this._transitioning) {
        this.scene.launch('PauseOverlay');
        this.scene.pause();
      }
    });

    // Play TV power-on cinematic
    this._playPowerOnEffect();
  }

  // ── TV Power On/Off Effects ────────────────────────────────

  /** Play a CRT "TV powers on" cinematic at the start of the run (~2 seconds). */
  private _playPowerOnEffect(): void {
    this._transitioning = true;
    logEvent('power_on_start');

    // Full-screen black overlay at highest depth
    const overlay = this.add.graphics();
    overlay.setDepth(500);
    overlay.fillStyle(0x000000, 1);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Step 1: Thin white horizontal line at center grows from 0 to GAME_WIDTH (400ms)
    const line = this.add.graphics();
    line.setDepth(501);
    const lineY = GAME_HEIGHT / 2;

    const lineGrow = { width: 0 };
    this.tweens.add({
      targets: lineGrow,
      width: GAME_WIDTH,
      duration: 400,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        line.clear();
        line.fillStyle(0xffffff, 1);
        const lx = (GAME_WIDTH - lineGrow.width) / 2;
        line.fillRect(lx, lineY - 1, lineGrow.width, 2);
      },
    });

    // Step 2 (400ms): Line expands vertically from 2px to GAME_HEIGHT (300ms)
    this.time.delayedCall(400, () => {
      const expand = { height: 2 };
      this.tweens.add({
        targets: expand,
        height: GAME_HEIGHT,
        duration: 300,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          line.clear();
          line.fillStyle(0xffffff, 1);
          const ly = (GAME_HEIGHT - expand.height) / 2;
          line.fillRect(0, ly, GAME_WIDTH, expand.height);
        },
      });
    });

    // Step 3 (700ms): Brief white flicker (3 rapid flashes at 50ms intervals)
    this.time.delayedCall(700, () => {
      let flickerCount = 0;
      const flickerEvent = this.time.addEvent({
        delay: 50,
        repeat: 5,
        callback: () => {
          flickerCount++;
          line.setAlpha(flickerCount % 2 === 0 ? 1 : 0.4);
        },
      });
    });

    // Step 4 (1000ms): Static noise fills the screen for 300ms
    this.time.delayedCall(1000, () => {
      line.destroy();
      overlay.clear();

      // Draw heavy static noise
      const staticGfx = this.add.graphics();
      staticGfx.setDepth(500);

      const drawStatic = () => {
        staticGfx.clear();
        for (let i = 0; i < 300; i++) {
          const sx = Math.random() * GAME_WIDTH;
          const sy = Math.random() * GAME_HEIGHT;
          const brightness = Math.random();
          staticGfx.fillStyle(
            Phaser.Display.Color.GetColor(brightness * 255, brightness * 255, brightness * 255),
            0.5 + Math.random() * 0.5,
          );
          staticGfx.fillRect(sx, sy, 4 + Math.random() * 8, 2 + Math.random() * 6);
        }
      };

      drawStatic();
      const staticTimer = this.time.addEvent({
        delay: 50,
        repeat: 5,
        callback: drawStatic,
      });

      // Step 5 (1300ms): Static fades, game world resolves underneath
      this.time.delayedCall(300, () => {
        staticTimer.destroy();
        this.tweens.add({
          targets: staticGfx,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            staticGfx.destroy();
            overlay.destroy();
          },
        });
      });
    });

    // Step 6: Unfreeze gameplay after ~1.6 seconds (total power-on ~2s with fade)
    this.time.delayedCall(1600, () => {
      this._transitioning = false;
      logEvent('power_on_end');
    });
  }

  /** Play a CRT "TV powers off" cinematic on death (~1.5 seconds). */
  private _playPowerOffEffect(onComplete: () => void): void {
    this._transitioning = true;

    // Step 1: Black overlays closing in from top and bottom (600ms)
    const topBar = this.add.graphics();
    topBar.setDepth(500);
    const bottomBar = this.add.graphics();
    bottomBar.setDepth(500);

    const collapse = { height: 0 };
    this.tweens.add({
      targets: collapse,
      height: GAME_HEIGHT / 2,
      duration: 600,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        topBar.clear();
        topBar.fillStyle(0x000000, 1);
        topBar.fillRect(0, 0, GAME_WIDTH, collapse.height);

        bottomBar.clear();
        bottomBar.fillStyle(0x000000, 1);
        bottomBar.fillRect(0, GAME_HEIGHT - collapse.height, GAME_WIDTH, collapse.height);
      },
    });

    // Step 2 (600ms): Horizontal line shrinks to a dot at center (300ms)
    this.time.delayedCall(600, () => {
      topBar.clear();
      bottomBar.clear();

      // Full black background
      const blackBg = this.add.graphics();
      blackBg.setDepth(499);
      blackBg.fillStyle(0x000000, 1);
      blackBg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // White horizontal line that shrinks to dot
      const dot = this.add.graphics();
      dot.setDepth(501);

      const shrink = { width: GAME_WIDTH, height: 2 };
      this.tweens.add({
        targets: shrink,
        width: 4,
        height: 4,
        duration: 300,
        ease: 'Quad.easeIn',
        onUpdate: () => {
          dot.clear();
          dot.fillStyle(0xffffff, 1);
          const dx = (GAME_WIDTH - shrink.width) / 2;
          const dy = (GAME_HEIGHT - shrink.height) / 2;
          dot.fillRect(dx, dy, shrink.width, shrink.height);
        },
      });

      // Step 3 (900ms): Dot fades to black (200ms)
      this.time.delayedCall(300, () => {
        this.tweens.add({
          targets: dot,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            dot.destroy();
          },
        });
      });

      // Step 4 (1100ms): Brief pause then transition (200ms)
      this.time.delayedCall(700, () => {
        topBar.destroy();
        bottomBar.destroy();
        blackBg.destroy();
        onComplete();
      });
    });
  }

  // ── CRT Effects ──────────────────────────────────────────────

  /** Get the CRT pipeline instance from the camera */
  private _getCRTPipeline(): CRTPipeline | null {
    const crtPipelines = this.cameras.main.getPostPipeline('CRTPipeline');
    if (!crtPipelines) return null;
    const arr = Array.isArray(crtPipelines) ? crtPipelines : [crtPipelines];
    for (const p of arr) {
      if (p instanceof CRTPipeline) return p;
    }
    return null;
  }

  /** Trigger a global hit stop (freeze all entities for 2 frames / ~33ms) */
  private _triggerHitStop(): void {
    this._hitStopTimer = 33;
    logEvent('hitstop_start', { duration: 33 });
  }

  /** Boss phase transition: pulse CRT aberration high for 200ms then ease back */
  private _onBossPhaseTransition(): void {
    const crt = this._getCRTPipeline();
    if (!crt) return;

    crt.setAberrationOverride(0.01);
    crt.setDistortionOverride(0.2);

    this.time.delayedCall(200, () => {
      // Ease back via a short tween on a proxy object
      const easeBack = { aberration: 0.01, distortion: 0.2 };
      this.tweens.add({
        targets: easeBack,
        aberration: 0,
        distortion: 0,
        duration: 400,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          crt.setAberrationOverride(easeBack.aberration);
          crt.setDistortionOverride(easeBack.distortion);
        },
        onComplete: () => {
          crt.resetOverrides();
        },
      });
    });
  }

  // ── Room Building ──────────────────────────────────────────

  private _buildRoom(): void {
    this._clearRoom();

    const room = this._floor.get(coordKey(this._currentRoomX, this._currentRoomY));
    if (!room) return;

    room.visited = true;
    this._wallBodies = this.physics.add.staticGroup();
    this._doorSprites.clear();
    this._doorBodies.clear();
    this._pitZones = [];
    this._roomDecorations = [];

    const grid = room.template;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = grid[r]?.[c] ?? Cell.EMPTY;
        const x = c * CELL_SIZE + CELL_SIZE / 2;
        const y = r * CELL_SIZE + CELL_SIZE / 2;

        switch (cell) {
          case Cell.WALL:
            this._placeWall(x, y);
            break;
          case Cell.COVER:
            this._placeCover(x, y);
            break;
          case Cell.PIT:
            this._placePit(x, y);
            break;
          case Cell.DOOR_N:
          case Cell.DOOR_S:
          case Cell.DOOR_E:
          case Cell.DOOR_W:
            this._placeDoor(x, y, cell);
            break;
        }
      }
    }

    // Room border walls (thin edges)
    this._placeBorderWalls();

    // Spawn enemies for combat rooms (only if not yet visited/cleared)
    if (room.type === 'combat' && !room.cleared) {
      this._spawnRoomEnemies(room);
      this._roomCleared = false;
    } else if (room.type === 'boss' && !room.cleared) {
      this._spawnBoss();
      this._roomCleared = false;
    } else if (room.type === 'item' && !room.cleared) {
      this._spawnItemPedestal(room);
      this._roomCleared = true; // Item rooms don't need clearing
    } else if (room.type === 'shop' && !room.cleared) {
      this._spawnShop(room);
      this._roomCleared = true;
    } else {
      this._roomCleared = true;
    }

    // Update door visuals
    this._updateDoorVisuals();

    // Update minimap
    this._drawMinimap();
  }

  private _placeWall(x: number, y: number): void {
    const wall = this.add.rectangle(x, y, CELL_SIZE - 2, CELL_SIZE - 2, 0x1a1a2a);
    wall.setStrokeStyle(1, 0x2a2a4a);
    this.physics.add.existing(wall, true);
    this._wallBodies!.add(wall);
    this._roomDecorations.push(wall);
  }

  private _placeCover(x: number, y: number): void {
    const cover = this.add.rectangle(x, y, CELL_SIZE - 2, CELL_SIZE - 2, 0x1a1a30);
    cover.setStrokeStyle(1, 0x2a2a50);
    this.physics.add.existing(cover, true);
    this._wallBodies!.add(cover);
    this._roomDecorations.push(cover);
  }

  private _placePit(x: number, y: number): void {
    const pit = this.add.image(x, y, 'pit');
    this._roomDecorations.push(pit);
    this._pitZones.push({
      x: x - CELL_SIZE / 2,
      y: y - CELL_SIZE / 2,
      w: CELL_SIZE,
      h: CELL_SIZE,
    });
  }

  private _placeDoor(x: number, y: number, cell: Cell): void {
    const dirMap: Record<number, Direction> = {
      [Cell.DOOR_N]: 'north',
      [Cell.DOOR_S]: 'south',
      [Cell.DOOR_E]: 'east',
      [Cell.DOOR_W]: 'west',
    };
    const dir = dirMap[cell];
    if (!dir) return;

    // Already have a door sprite for this direction? Skip (doors are 2 cells wide)
    if (this._doorSprites.has(dir)) return;

    const doorRect = this.add.rectangle(x, y, CELL_SIZE, CELL_SIZE, 0x001a00);
    doorRect.setStrokeStyle(2, 0x33ff33);
    this._roomDecorations.push(doorRect);
    this._doorSprites.set(dir, doorRect);

    // Door trigger zone — slightly inset
    const trigger = this.add.rectangle(x, y, CELL_SIZE * 0.6, CELL_SIZE * 0.6, 0x000000, 0);
    this.physics.add.existing(trigger, true);
    this._doorBodies.set(dir, (trigger.body as Physics.Arcade.StaticBody));
    this._roomDecorations.push(trigger);
  }

  private _placeBorderWalls(): void {
    const t = 8; // thin border thickness
    // Top
    const top = this.add.rectangle(GAME_WIDTH / 2, t / 2, GAME_WIDTH, t, 0x111122);
    this.physics.add.existing(top, true);
    this._wallBodies!.add(top);
    this._roomDecorations.push(top);
    // Bottom
    const bottom = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - t / 2, GAME_WIDTH, t, 0x111122);
    this.physics.add.existing(bottom, true);
    this._wallBodies!.add(bottom);
    this._roomDecorations.push(bottom);
    // Left
    const left = this.add.rectangle(t / 2, GAME_HEIGHT / 2, t, GAME_HEIGHT, 0x111122);
    this.physics.add.existing(left, true);
    this._wallBodies!.add(left);
    this._roomDecorations.push(left);
    // Right
    const right = this.add.rectangle(GAME_WIDTH - t / 2, GAME_HEIGHT / 2, t, GAME_HEIGHT, 0x111122);
    this.physics.add.existing(right, true);
    this._wallBodies!.add(right);
    this._roomDecorations.push(right);
  }

  private _updateDoorVisuals(): void {
    for (const [dir, sprite] of this._doorSprites) {
      if (this._roomCleared) {
        sprite.setFillStyle(0x001a00);
        sprite.setStrokeStyle(2, 0x33ff33);
        // Pulse
        this.tweens.add({
          targets: sprite,
          alpha: { from: 0.7, to: 1 },
          duration: 600,
          yoyo: true,
          repeat: -1,
        });
      } else {
        sprite.setFillStyle(0x1a0000);
        sprite.setStrokeStyle(2, 0xff3333);
        sprite.setAlpha(0.8);
      }
    }
  }

  private _clearRoom(): void {
    // Destroy existing room objects (silently, no SFX/particles)
    this._enemies.forEach(e => { if (e.active) e.destroy(); });
    this._enemies = [];

    this._pickups.forEach(p => { if (p.active) p.destroy(); });
    this._pickups = [];

    this._roomDecorations.forEach(obj => obj.destroy());
    this._roomDecorations = [];

    this._itemPedestals.forEach(p => {
      p.sprite.destroy();
      p.label.destroy();
    });
    this._itemPedestals = [];

    if (this._boss) {
      this._boss.cleanup();
      // Only call .active/.destroy() on Physics.Arcade.Sprite-based bosses (Boss)
      if (this._boss instanceof Boss) {
        if (this._boss.active) this._boss.destroy();
      }
      this._boss = null;
    }

    if (this._bossNameText) {
      this._bossNameText.destroy();
      this._bossNameText = null;
    }

    this._wallBodies?.clear(true, true);
    this._wallBodies = null;

    // Clear enemy projectiles
    this._enemyProjectiles.clear(true, true);

    // Clear player projectiles
    if (this._player) {
      this._player.projectiles.clear(true, true);
    }

    this._doorSprites.clear();
    this._doorBodies.clear();
    this._pitZones = [];
  }

  // ── Enemy Spawning ──────────────────────────────────────────

  private _spawnRoomEnemies(room: RoomData): void {
    for (const spawn of room.enemies) {
      this._spawnEnemy(spawn.type, spawn.x, spawn.y);
    }
  }

  private _spawnEnemy(type: string, x: number, y: number): void {
    // Performance cap: max 30 active enemies per room (check active count, not array length)
    if (this._enemies.filter(e => e.active).length >= 30) return;

    const enemy = new Enemy(this, x, y, type, this._enemyProjectiles);

    // Apply difficulty scaling to enemy HP and damage
    const diffScale = this._runConfig?.difficultyScale ?? 1.0;
    if (diffScale !== 1.0) {
      const scaledHP = Math.ceil(enemy.maxHp * diffScale);
      enemy.hp = scaledHP;
      enemy.maxHp = scaledHP;
      // Scale contact damage
      enemy.contactDamage = Math.round(enemy.contactDamage * diffScale * 10) / 10;
    }

    this._enemies.push(enemy);

    // Collisions with walls
    if (this._wallBodies) {
      this.physics.add.collider(enemy, this._wallBodies);
    }
  }

  private _spawnBoss(): void {
    const bossId = this._channelDef.bossId;
    const bossDef = BOSS_DEFS[bossId];
    const bossX = GAME_WIDTH / 2;
    const bossY = GAME_HEIGHT * 0.35;
    const diffScale = this._runConfig?.difficultyScale ?? 1.0;

    switch (bossId) {
      case 'smpte':
        this._boss = new BossSMPTE(this, bossX, bossY, this._enemyProjectiles);
        break;
      case 'the_tone':
        this._boss = new BossTone(this, bossX, bossY, this._enemyProjectiles);
        break;
      case 'the_offer':
        this._boss = new BossOffer(this, bossX, bossY, this._enemyProjectiles);
        break;
      case 'laugh_track':
        this._boss = new BossLaughTrack(this, bossX, bossY, this._enemyProjectiles);
        break;
      case 'the_narrator':
        this._boss = new BossNarrator(this, bossX, bossY, this._enemyProjectiles);
        break;
      case 'signal_zero':
        this._boss = new BossSignalZero(this, bossX, bossY, this._enemyProjectiles);
        break;
      case 'halftime':
        this._boss = new BossHalftime(this, bossX, bossY, this._enemyProjectiles);
        break;
      case 'the_anchor':
        this._boss = new BossAnchor(this, bossX, bossY, this._enemyProjectiles);
        break;
      case 'the_remix':
        this._boss = new BossRemix(this, bossX, bossY, this._enemyProjectiles);
        break;
      case 'dead_channel':
      default:
        this._boss = new Boss(this, bossX, bossY, this._enemyProjectiles);
        break;
    }

    // Apply difficulty scaling to boss HP
    if (diffScale !== 1.0 && this._boss) {
      const scaledHP = Math.floor(this._boss.hp * diffScale);
      this._boss.hp = scaledHP;
      this._boss.maxHp = scaledHP;
    }

    const bossName = bossDef?.name ?? 'THE DEAD CHANNEL';
    this._bossNameText = this.add.text(GAME_WIDTH / 2, 28, bossName, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ff3333',
    }).setOrigin(0.5).setDepth(100);

    // Only add physics collider for sprite-based bosses
    if (this._boss instanceof Boss && this._wallBodies) {
      this.physics.add.collider(this._boss, this._wallBodies);
    }
  }

  /** Get the boss's current X position regardless of boss type */
  private _getBossX(): number {
    if (!this._boss) return GAME_WIDTH / 2;
    if (this._boss instanceof Boss) return this._boss.x;
    // Non-sprite bosses store position internally; approximate with screen center
    // since they manage their own rendering
    return GAME_WIDTH / 2;
  }

  /** Get the boss's current Y position regardless of boss type */
  private _getBossY(): number {
    if (!this._boss) return GAME_HEIGHT / 2;
    if (this._boss instanceof Boss) return this._boss.y;
    return GAME_HEIGHT * 0.35;
  }

  // ── Item / Shop Rooms ──────────────────────────────────────

  private _spawnItemPedestal(room: RoomData): void {
    const item = getRandomItem(this._items.collectedItems.map(i => i.id));
    const x = GAME_WIDTH / 2;
    const y = GAME_HEIGHT / 2;

    // Pedestal glow
    const pedestal = this.add.image(x, y + 10, 'pedestal');
    this.tweens.add({
      targets: pedestal,
      alpha: { from: 0.6, to: 1 },
      scaleX: { from: 0.95, to: 1.05 },
      scaleY: { from: 0.95, to: 1.05 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    this._roomDecorations.push(pedestal);

    // Item orb (tinted by rarity)
    const orb = this.add.image(x, y - 10, 'item_orb');
    orb.setTint(RARITY_COLORS[item.rarity]);
    this.tweens.add({
      targets: orb,
      y: y - 18,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Label
    const label = this.add.text(x, y + 35, item.name, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#' + RARITY_COLORS[item.rarity].toString(16).padStart(6, '0'),
    }).setOrigin(0.5);

    this._itemPedestals.push({ sprite: orb, item, cost: 0, label });
  }

  private _spawnShop(room: RoomData): void {
    const collected = this._items.collectedItems.map(i => i.id);
    const positions = [
      { x: GAME_WIDTH * 0.25, y: GAME_HEIGHT / 2 },
      { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT / 2 },
      { x: GAME_WIDTH * 0.75, y: GAME_HEIGHT / 2 },
    ];

    for (const pos of positions) {
      const item = getRandomItem(collected);
      collected.push(item.id);
      const cost = RARITY_COST[item.rarity];

      const pedestal = this.add.image(pos.x, pos.y + 10, 'pedestal');
      this._roomDecorations.push(pedestal);

      const orb = this.add.image(pos.x, pos.y - 10, 'item_orb');
      orb.setTint(RARITY_COLORS[item.rarity]);
      this.tweens.add({
        targets: orb,
        y: pos.y - 18,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const canAfford = this._items.tubes >= cost;
      const label = this.add.text(pos.x, pos.y + 35,
        `${item.name}\n${cost} TUBES`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: canAfford ? '#' + RARITY_COLORS[item.rarity].toString(16).padStart(6, '0') : '#444444',
        align: 'center',
      }).setOrigin(0.5);

      if (!canAfford) orb.setAlpha(0.3);

      this._itemPedestals.push({ sprite: orb, item, cost, label });
    }
  }

  private _checkItemPickup(): void {
    for (let i = this._itemPedestals.length - 1; i >= 0; i--) {
      const pedestal = this._itemPedestals[i];
      if (!pedestal.sprite.active) continue;

      const dist = Phaser.Math.Distance.Between(
        this._player.x, this._player.y,
        pedestal.sprite.x, pedestal.sprite.y + 10,
      );

      if (dist < 40) {
        // Shop items cost tubes
        if (pedestal.cost > 0) {
          if (!this._items.spend(pedestal.cost)) continue;
        }

        this._collectItem(pedestal.item);
        pedestal.sprite.destroy();
        pedestal.label.destroy();
        this._itemPedestals.splice(i, 1);

        // Mark room cleared
        const room = this._floor.get(coordKey(this._currentRoomX, this._currentRoomY));
        if (room) room.cleared = true;
      }
    }
  }

  private _collectItem(item: ItemDef): void {
    this._items.applyItem(item);

    // HP sacrifice for CRT Meltdown
    if (item.special === 'hp_sacrifice' && item.specialValue) {
      this._player.takeDamage(item.specialValue);
    }

    // Heal if maxHP increased
    if (item.statMods.maxHP && item.statMods.maxHP > 0) {
      this._player.healHP(item.statMods.maxHP);
    }

    // Sync player stats
    this._player.syncStats();

    // Reveal map
    if (item.special === 'reveal_map') {
      // Mark all rooms as having doors visible on minimap
      this._drawMinimap();
    }

    // Check synergies
    const heldIds = this._items.collectedItems.map(i => i.id);
    const newSynergies = checkSynergies(heldIds, this._activeSynergies);
    for (const syn of newSynergies) {
      this._activeSynergies.add(syn.id);
      this._applySynergy(syn);
    }

    // Show item text (brief display — don't pause scene)
    playSFX('item_pickup');
    this.cameras.main.flash(150, 255, 255, 255, false);
    this._transitioning = true; // Freeze gameplay briefly

    const rarityColor = '#' + RARITY_COLORS[item.rarity].toString(16).padStart(6, '0');

    const nameText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, item.name, {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: rarityColor,
    }).setOrigin(0.5).setDepth(200);

    const descText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.5, item.description, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(200);

    this.time.delayedCall(800, () => {
      this._transitioning = false;
      this.tweens.add({
        targets: [nameText, descText],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          nameText.destroy();
          descText.destroy();
        },
      });
    });

    // Rebuild HUD for HP changes
    this._rebuildHPDots();
  }

  private _applySynergy(syn: SynergyDef): void {
    // Apply stat mods
    for (const [key, value] of Object.entries(syn.statMods)) {
      const statKey = key as keyof PlayerStats;
      if (statKey in this._items.stats && typeof value === 'number') {
        (this._items.stats[statKey] as number) += value;
      }
    }
    this._player.syncStats();

    // Freeze-frame (hit stop) for synergy activation
    this._hitStopTimer = 100;
    logEvent('hitstop_start', { duration: 100, source: 'synergy' });
    playSFX('synergy');
    this.cameras.main.flash(200, 51, 255, 51, false);

    // Show synergy announcement
    const synergyText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, syn.name, {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffff33',
      shadow: { offsetX: 0, offsetY: 0, color: '#ffff33', blur: 16, fill: true },
    }).setOrigin(0.5).setDepth(200);

    const effectText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3 + 36, syn.effect, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: [synergyText, effectText],
      alpha: 0,
      y: '-=30',
      duration: 2000,
      delay: 800,
      onComplete: () => {
        synergyText.destroy();
        effectText.destroy();
      },
    });
  }

  // ── Pickups ────────────────────────────────────────────────

  private _spawnPickup(x: number, y: number): void {
    const roll = Math.random();
    let type: PickupType | null = null;

    if (roll < 0.05) {
      type = 'fragment';
    } else if (roll < 0.25) {
      type = 'tube';
    } else if (roll < 0.45) {
      type = 'hp';
    }

    if (!type) return;

    const pickup = new Pickup(this, x, y, type);
    this._pickups.push(pickup);
  }

  private _updatePickups(delta: number): void {
    const magnetRange = this._items.stats.pickupRange;

    for (let i = this._pickups.length - 1; i >= 0; i--) {
      const pickup = this._pickups[i];
      if (!pickup.active) {
        this._pickups.splice(i, 1);
        continue;
      }

      pickup.magnetToward(this._player.x, this._player.y, magnetRange, delta);

      // Check collection
      const dist = Phaser.Math.Distance.Between(
        this._player.x, this._player.y,
        pickup.x, pickup.y,
      );

      if (dist < 20) {
        this._onPickupCollected(pickup);
        pickup.destroy();
        this._pickups.splice(i, 1);
      }
    }
  }

  private _onPickupCollected(pickup: Pickup): void {
    playSFX('pickup');

    switch (pickup.pickupType) {
      case 'hp':
        this._player.healHP(0.5);
        break;
      case 'tube':
        this._items.tubes += 5;
        break;
      case 'fragment':
        this._items.applyTemporaryDamageBoost(0.3, 10000);
        break;
    }
  }

  // ── Room Transitions ───────────────────────────────────────

  private _checkDoorTransitions(): void {
    if (this._transitioning || !this._roomCleared) return;

    for (const [dir, body] of this._doorBodies) {
      if (!body.enable) continue;

      const pb = this._player.body as Physics.Arcade.Body;
      const dx = Math.abs(pb.center.x - body.center.x);
      const dy = Math.abs(pb.center.y - body.center.y);
      const overlapX = (pb.halfWidth + body.halfWidth) - dx;
      const overlapY = (pb.halfHeight + body.halfHeight) - dy;
      if (overlapX > 0 && overlapY > 0) {
        const adjacent = getAdjacentRoom(
          this._floor,
          this._currentRoomX,
          this._currentRoomY,
          dir,
        );
        if (adjacent) {
          this._transitionToRoom(dir, adjacent);
        }
      }
    }
  }

  private _transitionToRoom(dir: Direction, targetRoom: RoomData): void {
    this._transitioning = true;
    logEvent('room_transition_start');
    playSFX('room_transition');

    // Static dissolve effect
    this.cameras.main.fade(ROOM_TRANSITION_DURATION, 10, 10, 10, false, (_cam: unknown, progress: number) => {
      if (progress < 1) return;

      // Move to new room
      const { dx, dy } = DIR_OFFSET[dir];
      this._currentRoomX += dx;
      this._currentRoomY += dy;

      this._buildRoom();

      // Position player at opposite door
      const oppDir = OPPOSITE[dir];
      const entryPos = this._getDoorEntryPosition(oppDir);
      this._player.setPosition(entryPos.x, entryPos.y);
      (this._player.body as Physics.Arcade.Body).setVelocity(0, 0);

      // Set up collisions for new room
      this._setupCollisions();

      // Fade back in
      this.cameras.main.fadeIn(ROOM_TRANSITION_DURATION);
      this._transitioning = false;
      logEvent('room_transition_end');
    });
  }

  private _getDoorEntryPosition(fromDir: Direction): { x: number; y: number } {
    const margin = 60;
    switch (fromDir) {
      case 'north': return { x: GAME_WIDTH / 2, y: margin };
      case 'south': return { x: GAME_WIDTH / 2, y: GAME_HEIGHT - margin };
      case 'east': return { x: GAME_WIDTH - margin, y: GAME_HEIGHT / 2 };
      case 'west': return { x: margin, y: GAME_HEIGHT / 2 };
    }
  }

  // ── Collisions Setup ────────────────────────────────────────

  private _setupCollisions(): void {
    if (!this._wallBodies) return;

    this.physics.add.collider(this._player, this._wallBodies);

    this.physics.add.collider(this._player.projectiles, this._wallBodies, (proj) => {
      (proj as Projectile).kill();
    });

    this.physics.add.collider(this._enemyProjectiles, this._wallBodies, (proj) => {
      (proj as EnemyProjectile).kill();
    });
  }

  // ── Combat Logic ────────────────────────────────────────────

  private _checkCombat(): void {
    // Player projectile vs enemies
    for (const enemy of this._enemies) {
      if (!enemy.active) continue;

      this._player.projectiles.children.each((obj) => {
        const proj = obj as Projectile;
        if (!proj.active) return true;

        if (this.physics.overlap(proj, enemy)) {
          // Fire onHit hooks
          this._items.fireOnHit({
            scene: this, playerX: this._player.x, playerY: this._player.y,
            playerHP: this._player.hp, playerMaxHP: this._player.maxHp,
            damage: proj.damage, enemyX: enemy.x, enemyY: enemy.y, enemyKey: enemy.config.key,
          });
          // Cross-Talk: splash 30% damage to nearby enemies
          if (this._items.hasItem('cross_talk')) {
            const splashDmg = proj.damage * 0.3;
            for (const other of this._enemies) {
              if (other === enemy || !other.active) continue;
              const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
              if (d < 100) other.takeDamage(splashDmg);
            }
          }
          // On-beat bonus: 1.5x damage when firing on the beat (music_video channel)
          let finalDmg = proj.damage;
          if (this._beatSystem && this._beatSystem.isOnBeat()) {
            finalDmg *= 1.5;
          }
          const killed = enemy.takeDamage(finalDmg);
          if (killed) {
            this._score += enemy.scoreValue;
            this._enemiesKilled++;
            this._spawnPickup(enemy.x, enemy.y);
            this._onEnemyKilled(enemy);
          }
          if (proj.onEnemyHit()) {
            proj.kill();
          }
        }
        return true;
      });

      // Sentinel beam vs player
      if (enemy.config.key === 'bar_sentinel') {
        if (enemy.isSentinelBeamHitting(this._player.x, this._player.y)) {
          if (!this._player.isInvulnerable && !this._player.isSurfing) {
            this._triggerHitStop();
            if (this._boss && this._boss.isAlive) this._bossHitsTaken++;
          }
          this._player.takeDamage(1);
        }
      }
    }

    // Player projectile vs boss
    if (this._boss && this._boss.isAlive) {
      if (this._boss instanceof Boss) {
        // Physics.Arcade.Sprite-based boss: use physics overlap
        this._player.projectiles.children.each((obj) => {
          const proj = obj as Projectile;
          if (!proj.active) return true;

          if (this.physics.overlap(proj, this._boss as Boss)) {
            let dmg = proj.damage;
            if (this._beatSystem && this._beatSystem.isOnBeat()) dmg *= 1.5;
            this._boss!.takeDamage(dmg);
            if (proj.onEnemyHit()) {
              proj.kill();
            }
          }
          return true;
        });
      } else {
        // Non-sprite boss: manual distance-based hit detection
        const bossDef = this._channelDef.bossId ? BOSS_DEFS[this._channelDef.bossId] : null;
        const hitRadius = bossDef ? Math.max(bossDef.displaySize.width, bossDef.displaySize.height) / 2 : 80;

        this._player.projectiles.children.each((obj) => {
          const proj = obj as Projectile;
          if (!proj.active) return true;

          const dist = Phaser.Math.Distance.Between(proj.x, proj.y, this._getBossX(), this._getBossY());
          if (dist < hitRadius) {
            let dmg = proj.damage;
            if (this._beatSystem && this._beatSystem.isOnBeat()) dmg *= 1.5;
            this._boss!.takeDamage(dmg);
            if (proj.onEnemyHit()) {
              proj.kill();
            }
          }
          return true;
        });
      }

      // Boss beam vs player
      if (this._boss.isBeamHitting(this._player.x, this._player.y)) {
        if (!this._player.isInvulnerable && !this._player.isSurfing) {
          logEvent('player_hurt', { source: 'boss' });
          this._triggerHitStop();
          this._bossHitsTaken++;
        }
        this._player.takeDamage(1);
      }
    }

    // Enemy vs player contact
    for (const enemy of this._enemies) {
      if (!enemy.active) continue;
      if (this.physics.overlap(this._player, enemy)) {
        if (!this._player.isInvulnerable && !this._player.isSurfing) {
          logEvent('player_hurt', { source: 'contact' });
          this._triggerHitStop();
          if (this._boss && this._boss.isAlive) this._bossHitsTaken++;
          this._firePlayerHurtHooks(enemy.contactDamage);
        }
        this._player.takeDamage(enemy.contactDamage);
        this._checkRevive();
        if (this._player.isSurfing) {
          // Static Charge: extra surf damage
          const surfDmg = this._items.hasItem('static_charge') ? 2 : 1;
          const killed = enemy.takeDamage(surfDmg);
          if (killed) {
            this._score += enemy.scoreValue;
            this._enemiesKilled++;
            this._spawnPickup(enemy.x, enemy.y);
            this._onEnemyKilled(enemy);
          }
          // Fire onSurf hooks
          this._items.fireOnSurf({
            scene: this, playerX: this._player.x, playerY: this._player.y,
            playerHP: this._player.hp, playerMaxHP: this._player.maxHp,
            damage: surfDmg, enemyX: enemy.x, enemyY: enemy.y,
          });
          // Refresh Rate: fire rate boost after surf
          if (this._items.hasItem('refresh_rate')) {
            this._items.applyTemporaryFireRateBoost(2, 3000);
          }
        }
      }
    }

    // Boss contact damage
    if (this._boss && this._boss.isAlive) {
      if (this._boss instanceof Boss) {
        if (this._boss.active && this.physics.overlap(this._player, this._boss)) {
          if (!this._player.isInvulnerable && !this._player.isSurfing) {
            logEvent('player_hurt', { source: 'boss' });
            this._triggerHitStop();
            this._bossHitsTaken++;
          }
          this._player.takeDamage(1);
        }
      }
      // Non-sprite bosses don't have contact damage hitboxes (they use projectile attacks)
    }

    // Enemy projectile vs player
    this._enemyProjectiles.children.each((obj) => {
      const proj = obj as EnemyProjectile;
      if (!proj.active) return true;

      if (this.physics.overlap(this._player, proj)) {
        // Whistle stun projectile: apply slow instead of damage
        if ((proj as any).isStunProjectile) {
          this._player.slowTimer = 1500; // 1.5s half-speed
          proj.kill();
          return true;
        }
        if (!this._player.isInvulnerable && !this._player.isSurfing) {
          logEvent('player_hurt', { source: 'projectile' });
          this._triggerHitStop();
          if (this._boss && this._boss.isAlive) this._bossHitsTaken++;
          this._firePlayerHurtHooks(proj.damage);
        }
        this._player.takeDamage(proj.damage);
        this._checkRevive();
        proj.kill();
      }
      return true;
    });
  }

  private _checkRoomCleared(): void {
    if (this._roomCleared) return;

    // Remove dead enemies from list
    this._enemies = this._enemies.filter(e => e.active);

    const room = this._floor.get(coordKey(this._currentRoomX, this._currentRoomY));
    if (!room) return;

    if (room.type === 'combat' && this._enemies.length === 0) {
      this._onRoomCleared(room);
    }
  }

  private _onRoomCleared(room: RoomData): void {
    logEvent('room_cleared');
    room.cleared = true;
    this._roomCleared = true;
    this._roomsCleared++;

    // Fire onRoomClear hooks
    const ctx: ItemEventContext = {
      scene: this, playerX: this._player.x, playerY: this._player.y,
      playerHP: this._player.hp, playerMaxHP: this._player.maxHp, damage: 0,
    };
    this._items.fireOnRoomClear(ctx);

    // Power Conditioner: heal on room clear
    if (this._items.hasItem('power_conditioner')) {
      this._player.healHP(1);
    }

    playSFX('wave_clear');
    this._updateDoorVisuals();
    playSFX('door_unlock');

    // Flash "CLEARED" text
    if (this._roomClearedText) this._roomClearedText.destroy();
    this._roomClearedText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, 'SIGNAL CLEAR', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: CSS_PHOSPHOR_GREEN,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: this._roomClearedText,
      alpha: 0,
      y: GAME_HEIGHT * 0.35,
      duration: 1500,
      onComplete: () => {
        this._roomClearedText?.destroy();
        this._roomClearedText = null;
      },
    });

    // Magnetize all pickups toward player briefly
    for (const pickup of this._pickups) {
      this.tweens.add({
        targets: pickup,
        x: this._player.x,
        y: this._player.y,
        duration: 500,
        ease: 'Quad.easeIn',
      });
    }
  }

  // ── Pit Damage ──────────────────────────────────────────────

  private _checkPitDamage(delta: number): void {
    for (const pit of this._pitZones) {
      if (
        this._player.x > pit.x &&
        this._player.x < pit.x + pit.w &&
        this._player.y > pit.y &&
        this._player.y < pit.y + pit.h
      ) {
        // DOT: damage every 500ms
        if (Math.random() < delta / 500) {
          this._player.takeDamage(0.5);
        }
      }
    }
  }

  // ── Bomb ────────────────────────────────────────────────────

  private _onBomb(): void {
    // Clear all enemy projectiles
    this._enemyProjectiles.children.each((obj) => {
      (obj as EnemyProjectile).kill();
      return true;
    });

    // Damage all enemies
    for (const enemy of this._enemies) {
      if (!enemy.active) continue;
      const killed = enemy.takeDamage(3);
      if (killed) {
        this._score += enemy.scoreValue;
        this._enemiesKilled++;
      }
    }

    // Damage boss
    if (this._boss && this._boss.isAlive) {
      this._boss.takeDamage(5);
    }
  }

  // ── Item Event Hook Helpers ─────────────────────────────────

  private _firePlayerHurtHooks(damage: number): void {
    const ctx: ItemEventContext = {
      scene: this, playerX: this._player.x, playerY: this._player.y,
      playerHP: this._player.hp, playerMaxHP: this._player.maxHp, damage,
    };
    this._items.fireOnPlayerHurt(ctx);

    // Static Guard: retaliatory ring on damage
    if (this._items.hasItem('static_guard')) {
      const count = 8;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const proj = new Projectile(
          this, this._player.x, this._player.y, angle,
          { ...this._items.stats, damage: this._items.getEffectiveDamage() * 0.5 },
          false, this._player.weaponType,
        );
        this._player.projectiles.add(proj);
      }
    }

    // Time Base Corrector: slow enemies when HP < 30%
    if (this._items.hasItem('time_base_corrector') && this._player.hp / this._player.maxHp < 0.3) {
      for (const enemy of this._enemies) {
        if (!enemy.active) continue;
        enemy.speed *= 0.5;
        this.time.delayedCall(3000, () => {
          if (enemy.active) enemy.speed = enemy.config.speed;
        });
      }
    }
  }

  private _checkRevive(): void {
    if (this._player.hp <= 0 && this._items.hasRevive) {
      this._items.hasRevive = false;
      this._player.hp = 2;
      this._player.isInvulnerable = true;
      this.cameras.main.flash(500, 255, 255, 255, false);
      playSFX('item_pickup');
      this.time.delayedCall(1500, () => {
        if (this._player.active) this._player.isInvulnerable = false;
      });
    }
  }

  private _onEnemyKilled(enemy: Enemy): void {
    const ctx: ItemEventContext = {
      scene: this, playerX: this._player.x, playerY: this._player.y,
      playerHP: this._player.hp, playerMaxHP: this._player.maxHp,
      damage: 0, enemyX: enemy.x, enemyY: enemy.y, enemyKey: enemy.config.key,
    };
    this._items.fireOnKill(ctx);

    // Signal Cascade: chain damage to nearby enemies
    if (this._items.hasItem('signal_cascade')) {
      for (const other of this._enemies) {
        if (other === enemy || !other.active) continue;
        const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
        if (d < 80) {
          const chainKilled = other.takeDamage(1);
          if (chainKilled) {
            this._score += other.scoreValue;
            this._enemiesKilled++;
            this._spawnPickup(other.x, other.y);
          }
        }
      }
    }

    // Ghost Frame: brief invulnerability on kill
    if (this._items.hasItem('ghost_frame')) {
      this._player.isInvulnerable = true;
      this.time.delayedCall(200, () => {
        if (this._player.active) this._player.isInvulnerable = false;
      });
    }

    // Tube Magnet: extra tube from kills
    if (this._items.hasItem('tube_magnet') && Math.random() < 0.3) {
      this._items.tubes += 5;
    }
  }

  // ── Boss Events ─────────────────────────────────────────────

  private _onBossDefeated(): void {
    const room = this._floor.get(coordKey(this._currentRoomX, this._currentRoomY));
    if (room) room.cleared = true;
    this._roomCleared = true;
    this._boss = null;

    // Record boss defeat in save data
    const bossId = this._channelDef.bossId;
    if (bossId) {
      const save = loadSave();
      if (!save.bossesBeaten) save.bossesBeaten = [];
      if (!save.bossesBeaten.includes(bossId)) {
        save.bossesBeaten.push(bossId);
        saveToCurrent(save);
      }
    }

    // Check if there is a next channel in this run
    if (this._runConfig && this._runConfig.currentChannelIndex < this._runConfig.channels.length - 1) {
      // Transition to next channel
      this.time.delayedCall(2000, () => {
        this._transitionToNextChannel();
      });
    } else if (this._runConfig?.endless) {
      // Endless mode: cycle back to first channel with increased difficulty
      this.time.delayedCall(2000, () => {
        this._cycleEndless();
      });
    } else {
      // Final channel — victory
      this.time.delayedCall(2000, () => {
        this._onVictory();
      });
    }
  }

  private _transitionToNextChannel(): void {
    if (!this._runConfig) return;

    const nextIndex = this._runConfig.currentChannelIndex + 1;
    const nextChannelId = this._runConfig.channels[nextIndex];
    const nextChannelDef = CHANNEL_REGISTRY[nextChannelId] ?? CHANNEL_REGISTRY['static'];

    // Difficulty scales per channel: 1.0, 1.3, 1.6, ...
    const nextDifficulty = [1.0, 1.5, 2.2, 2.8][nextIndex] ?? (1.0 + nextIndex * 0.5);

    // Build the next RunConfig carrying over player state
    const nextRunConfig: RunConfig = {
      channels: this._runConfig.channels,
      currentChannelIndex: nextIndex,
      weaponType: this._runConfig.weaponType,
      difficultyScale: nextDifficulty,
      carryOverHP: Math.min(this._player.hp + 1, this._player.maxHp),
      carryOverTubes: this._items.tubes,
      carryOverItems: this._items.collectedItems.map(i => i.id),
      carryOverScore: this._score,
      carryOverEnemiesKilled: this._enemiesKilled,
      carryOverRoomsCleared: this._roomsCleared,
      carryOverStartTime: this._startTime,
      characterId: this._runConfig.characterId,
      ascensionLevel: this._runConfig.ascensionLevel,
      dailySeed: this._runConfig.dailySeed,
    };

    // Show "CHANNEL CLEAR" text, then transition
    const clearText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'CHANNEL CLEAR', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: CSS_PHOSPHOR_GREEN,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 20, fill: true },
    }).setOrigin(0.5).setDepth(200);

    this.cameras.main.flash(500, 51, 255, 51, false);

    this.time.delayedCall(1500, () => {
      clearText.destroy();
      this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress >= 1) {
          this.scene.start('ChannelTransitionScene', {
            nextChannelName: nextChannelDef.name,
            nextChannelNumber: nextChannelDef.number,
            channelIndex: nextIndex + 1, // 1-based display
            totalChannels: this._runConfig!.channels.length,
            runConfig: nextRunConfig,
          });
        }
      });
    });
  }

  /** Endless mode: cycle back to first channel with increased difficulty */
  private _cycleEndless(): void {
    if (!this._runConfig) return;

    const cycle = (this._runConfig.endlessCycle ?? 0) + 1;
    const nextDifficulty = this._runConfig.difficultyScale + 0.25;

    playSFX('endless_cycle');

    const cycleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `CYCLE ${cycle + 1}`, {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: CSS_PHOSPHOR_GREEN,
      shadow: { offsetX: 0, offsetY: 0, color: CSS_PHOSPHOR_GREEN, blur: 20, fill: true },
    }).setOrigin(0.5).setDepth(200);

    this.cameras.main.flash(500, 51, 255, 51, false);

    this.time.delayedCall(1500, () => {
      cycleText.destroy();

      const nextRunConfig: RunConfig = {
        channels: this._runConfig!.channels,
        currentChannelIndex: 0, // reset to first channel
        weaponType: this._runConfig!.weaponType,
        difficultyScale: nextDifficulty,
        endless: true,
        endlessCycle: cycle,
        carryOverHP: Math.min(this._player.hp + 2, this._player.maxHp), // heal a bit between cycles
        carryOverTubes: this._items.tubes,
        carryOverItems: this._items.collectedItems.map(i => i.id),
        carryOverScore: this._score,
        carryOverEnemiesKilled: this._enemiesKilled,
        carryOverRoomsCleared: this._roomsCleared,
        carryOverStartTime: this._startTime,
        characterId: this._runConfig!.characterId,
        ascensionLevel: this._runConfig!.ascensionLevel,
      };

      this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress >= 1) {
          const channelDef = CHANNEL_REGISTRY[nextRunConfig.channels[0]] ?? CHANNEL_REGISTRY['static'];
          this.scene.start('ChannelTransitionScene', {
            nextChannelName: channelDef.name,
            nextChannelNumber: channelDef.number,
            channelIndex: 1,
            totalChannels: nextRunConfig.channels.length,
            runConfig: nextRunConfig,
          });
        }
      });
    });
  }

  private _onBossSpawnAdd(data: { type: string; x: number; y: number }): void {
    this._spawnEnemy(data.type, data.x, data.y);
    if (this._wallBodies) {
      const enemy = this._enemies[this._enemies.length - 1];
      this.physics.add.collider(enemy, this._wallBodies);
    }
  }

  private _onEnemySplit(data: { x: number; y: number; parentKey: string }): void {
    // Spawn 2-3 smaller enemies near the death location
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 60;
      const offsetY = (Math.random() - 0.5) * 60;
      const ex = Phaser.Math.Clamp(data.x + offsetX, 80, GAME_WIDTH - 80);
      const ey = Phaser.Math.Clamp(data.y + offsetY, 80, GAME_HEIGHT - 80);
      this._spawnEnemy(data.parentKey, ex, ey);
      if (this._wallBodies) {
        const enemy = this._enemies[this._enemies.length - 1];
        this.physics.add.collider(enemy, this._wallBodies);
      }
    }
  }

  private _onEnemySpawnClone(data: { x: number; y: number; key: string }): void {
    const offsetX = (Math.random() - 0.5) * 80;
    const offsetY = (Math.random() - 0.5) * 80;
    const ex = Phaser.Math.Clamp(data.x + offsetX, 80, GAME_WIDTH - 80);
    const ey = Phaser.Math.Clamp(data.y + offsetY, 80, GAME_HEIGHT - 80);
    this._spawnEnemy(data.key, ex, ey);
    if (this._wallBodies) {
      const enemy = this._enemies[this._enemies.length - 1];
      this.physics.add.collider(enemy, this._wallBodies);
    }
  }

  // ── End States ──────────────────────────────────────────────

  /** Build run stats, update save data, and return earned tubes + achievements. */
  private _finalizeRun(victory: boolean): {
    tubesEarned: number;
    newAchievements: string[];
    channelsCompleted: number;
  } {
    const timeSeconds = Math.floor((Date.now() - this._startTime) / 1000);
    const channelsCompleted = victory
      ? (this._runConfig?.channels.length ?? 1)
      : (this._runConfig?.currentChannelIndex ?? 0);

    // Calculate tubes earned: floor(score * 0.1) + tubes collected
    const tubesEarned = Math.floor(this._score * 0.1) + this._items.tubes;

    // Practice mode: skip save recording
    if (this._practiceMode) {
      return { tubesEarned: 0, newAchievements: [], channelsCompleted };
    }

    // Update save data
    const save = loadSave();
    save.totalRuns++;
    save.totalKills += this._enemiesKilled;
    save.tubes += tubesEarned;

    const currentFloor = (this._runConfig?.currentChannelIndex ?? 0) + 1;
    if (currentFloor > save.bestFloor) {
      save.bestFloor = currentFloor;
    }

    // Apply ascension tube bonus
    const ascLevel = this._runConfig?.ascensionLevel ?? 0;
    if (ascLevel > 0) {
      const bonus = getAscensionTubeBonus(ascLevel);
      save.tubes += Math.floor(tubesEarned * (bonus - 1)); // extra tubes from bonus
    }

    // Track ascension progress
    if (victory && ascLevel > 0 && ascLevel > (save.maxAscensionReached ?? 0)) {
      save.maxAscensionReached = ascLevel;
    }

    // Run achievement checks
    const achievementStats: AchievementRunStats = {
      score: this._score,
      enemiesKilled: this._enemiesKilled,
      bossHitsTaken: this._bossHitsTaken,
      itemsCollected: this._items.collectedItems.length,
      roomsCleared: this._roomsCleared,
      roomsNoDamage: 0, // TODO: track no-damage rooms
      timeSeconds,
      channelsCompleted,
      victory,
      weaponUsed: this._runConfig?.weaponType ?? 'phosphor_beam',
    };
    const newAchievements = checkAchievements(achievementStats, save);

    // Save run to run history (last 5 runs)
    if (!save.runHistory) save.runHistory = [];
    save.runHistory.unshift({
      date: new Date().toISOString(),
      score: this._score,
      enemiesKilled: this._enemiesKilled,
      channelsCleared: channelsCompleted,
      victory,
      weapon: this._runConfig?.weaponType ?? 'phosphor_beam',
      character: this._runConfig?.characterId ?? 'standard',
      timeSeconds,
      ascension: ascLevel,
    });
    if (save.runHistory.length > 5) save.runHistory.length = 5;

    // Track discovered items
    if (!save.discoveredItems) save.discoveredItems = [];
    for (const item of this._items.collectedItems) {
      if (!save.discoveredItems.includes(item.id)) {
        save.discoveredItems.push(item.id);
      }
    }

    // Update daily run if applicable
    if (this._runConfig?.dailySeed) {
      save.dailyRun = {
        date: this._runConfig.dailySeed,
        completed: true,
        score: this._score,
        seed: this._runConfig.dailySeed,
      };
    }

    // Track endless mode best floor
    if (this._runConfig?.endless) {
      const endlessCycle = this._runConfig.endlessCycle ?? 0;
      const endlessFloor = endlessCycle * this._runConfig.channels.length + currentFloor;
      if (endlessFloor > (save.bestEndlessFloor ?? 0)) {
        save.bestEndlessFloor = endlessFloor;
      }
    }

    // Track weekly challenge completion
    if (this._runConfig?.weeklyChallenge && victory && this._runConfig.weeklySeed != null) {
      save.weeklyChallenge = {
        weekSeed: this._runConfig.weeklySeed,
        completed: true,
        score: this._score,
      };
    }

    saveToCurrent(save);

    return { tubesEarned, newAchievements, channelsCompleted };
  }

  private _onPlayerDeath(): void {
    logEvent('player_death');
    this.input.keyboard!.enabled = false;
    this.input.enabled = false;

    const runResult = this._finalizeRun(false);

    this.cameras.main.shake(500, 0.01);

    // Play TV power-off cinematic before transitioning to GameOverScene
    this._playPowerOffEffect(() => {
      this.scene.start('GameOverScene', {
        score: this._score,
        wave: this._roomsCleared,
        enemiesKilled: this._enemiesKilled,
        itemsCollected: this._items.collectedItems.length,
        time: Math.floor((Date.now() - this._startTime) / 1000),
        victory: false,
        tubesEarned: runResult.tubesEarned,
        newAchievements: runResult.newAchievements,
        channelsCompleted: runResult.channelsCompleted,
        channelName: this._channelDef.name,
        endless: this._runConfig?.endless,
        endlessCycle: this._runConfig?.endlessCycle,
        runConfig: this._runConfig,
      });
    });
  }

  private _onVictory(): void {
    const runResult = this._finalizeRun(true);

    this.cameras.main.flash(500, 51, 255, 51, false);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'SIGNAL RESTORED', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: CSS_PHOSPHOR_GREEN,
    }).setOrigin(0.5).setDepth(200);

    this.time.delayedCall(3000, () => {
      this.scene.start('GameOverScene', {
        score: this._score,
        wave: this._roomsCleared,
        enemiesKilled: this._enemiesKilled,
        itemsCollected: this._items.collectedItems.length,
        time: Math.floor((Date.now() - this._startTime) / 1000),
        victory: true,
        tubesEarned: runResult.tubesEarned,
        newAchievements: runResult.newAchievements,
        channelsCompleted: runResult.channelsCompleted,
        channelName: this._channelDef.name,
        endless: this._runConfig?.endless,
        endlessCycle: this._runConfig?.endlessCycle,
        runConfig: this._runConfig,
      });
    });
  }

  // ── HUD ─────────────────────────────────────────────────────

  private _createHUD(): void {
    // HP dots
    this._rebuildHPDots();

    // Channel name
    this._channelText = this.add.text(GAME_WIDTH - HUD_MARGIN - 90, HUD_MARGIN, this._channelDef.name, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#666666',
    }).setScrollFactor(0).setDepth(100);

    // Score
    this._scoreText = this.add.text(GAME_WIDTH / 2, HUD_MARGIN, '0', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: CSS_PHOSPHOR_GREEN,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Tubes
    this._tubeText = this.add.text(HUD_MARGIN, HUD_MARGIN + 25, 'TUBES: 0', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffcc33',
    }).setScrollFactor(0).setDepth(100);

    // Bombs
    this._bombText = this.add.text(HUD_MARGIN, HUD_MARGIN + 40, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#33ccff',
    }).setScrollFactor(0).setDepth(100);

    // Cooldown bar
    this._cooldownBar = this.add.graphics();
    this._cooldownBar.setScrollFactor(0).setDepth(100);

    // Minimap
    this._minimapGraphics = this.add.graphics();
    this._minimapGraphics.setScrollFactor(0).setDepth(100);
    this._drawMinimap();
  }

  private _rebuildHPDots(): void {
    this._hpDots.forEach(d => d.destroy());
    this._hpDots = [];

    const maxHP = Math.ceil(this._player?.maxHp ?? this._items.stats.maxHP);
    for (let i = 0; i < maxHP; i++) {
      const dot = this.add.image(
        HUD_MARGIN + i * HP_DOT_SPACING + HP_DOT_SIZE,
        HUD_MARGIN + HP_DOT_SIZE,
        'hp_dot',
      ).setScrollFactor(0).setDepth(100);
      this._hpDots.push(dot);
    }
  }

  private _updateHUD(): void {
    // HP dots
    for (let i = 0; i < this._hpDots.length; i++) {
      // Support half-HP display
      if (i < Math.floor(this._player.hp)) {
        this._hpDots[i].setTexture('hp_dot');
        this._hpDots[i].setAlpha(1);
      } else if (i < this._player.hp) {
        this._hpDots[i].setTexture('hp_dot');
        this._hpDots[i].setAlpha(0.5);
      } else {
        this._hpDots[i].setTexture('hp_dot_empty');
        this._hpDots[i].setAlpha(1);
      }
    }

    this._scoreText.setText(String(this._score));
    this._tubeText.setText(`TUBES: ${this._items.tubes}`);

    if (this._items.bombs > 0) {
      this._bombText.setText(`[Q] BOMB x${this._items.bombs}`);
    } else {
      this._bombText.setText('');
    }

    // Cooldown bar
    this._cooldownBar.clear();
    const barWidth = 60;
    const barHeight = 4;
    const barX = GAME_WIDTH / 2 - barWidth / 2;
    const barY = GAME_HEIGHT - HUD_MARGIN - barHeight;

    this._cooldownBar.fillStyle(0x333333, 0.5);
    this._cooldownBar.fillRect(barX, barY, barWidth, barHeight);

    const ratio = 1 - (this._player.surfCooldownRemaining / this._player.surfCooldownMax);
    const fillColor = ratio >= 1 ? 0x33ff33 : 0x666666;
    this._cooldownBar.fillStyle(fillColor, 0.8);
    this._cooldownBar.fillRect(barX, barY, barWidth * ratio, barHeight);
  }

  // ── Minimap ─────────────────────────────────────────────────

  private _drawMinimap(): void {
    if (!this._minimapGraphics) return;
    this._minimapGraphics.clear();

    const rs = MINIMAP_ROOM_SIZE;
    const pad = MINIMAP_PADDING;
    const revealAll = this._items.hasRevealMap;

    // Find bounds of placed rooms
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (const [key] of this._floor) {
      const { x, y } = parseKey(key);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const mapW = (maxX - minX + 1) * (rs + pad);
    const mapH = (maxY - minY + 1) * (rs + pad);
    const startX = MINIMAP_X - mapW;
    const startY = MINIMAP_Y;

    // Background
    this._minimapGraphics.fillStyle(0x000000, 0.5);
    this._minimapGraphics.fillRect(startX - 4, startY - 4, mapW + 8, mapH + 8);

    for (const [key, room] of this._floor) {
      const { x, y } = parseKey(key);
      const px = startX + (x - minX) * (rs + pad);
      const py = startY + (y - minY) * (rs + pad);

      const isCurrent = x === this._currentRoomX && y === this._currentRoomY;
      const isVisible = room.visited || revealAll || this._isAdjacentToVisited(x, y);

      if (!isVisible) continue;

      if (isCurrent) {
        this._minimapGraphics.fillStyle(0xffffff, 1);
      } else if (room.visited) {
        this._minimapGraphics.fillStyle(0x33ff33, 0.5);
      } else {
        this._minimapGraphics.lineStyle(1, 0x33ff33, 0.3);
        this._minimapGraphics.strokeRect(px, py, rs, rs);
        continue;
      }

      this._minimapGraphics.fillRect(px, py, rs, rs);

      // Boss/item indicators
      if (room.type === 'boss' && (room.visited || revealAll)) {
        this._minimapGraphics.fillStyle(0xff3333, 1);
        this._minimapGraphics.fillCircle(px + rs / 2, py + rs / 2, 2);
      } else if (room.type === 'item' && (room.visited || revealAll)) {
        this._minimapGraphics.fillStyle(0xffcc33, 1);
        this._minimapGraphics.fillCircle(px + rs / 2, py + rs / 2, 2);
      } else if (room.type === 'shop' && (room.visited || revealAll)) {
        this._minimapGraphics.fillStyle(0x33ccff, 1);
        this._minimapGraphics.fillCircle(px + rs / 2, py + rs / 2, 2);
      }
    }
  }

  private _isAdjacentToVisited(x: number, y: number): boolean {
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];
    for (const { dx, dy } of dirs) {
      const neighbor = this._floor.get(coordKey(x + dx, y + dy));
      if (neighbor?.visited) return true;
    }
    return false;
  }

  // ── Background Noise ────────────────────────────────────────

  private _drawNoise(): void {
    this._noiseGraphics.clear();
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(10, GAME_WIDTH - 10);
      const y = Phaser.Math.Between(10, GAME_HEIGHT - 10);
      this._noiseGraphics.fillStyle(0xffffff, Math.random() * 0.05);
      this._noiseGraphics.fillRect(x, y, 2, 2);
    }
  }

  // ── Main Update Loop ────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (!this._player?.active || this._transitioning) return;

    // Global hit stop: freeze ALL entities for ~2 frames (33ms)
    if (this._hitStopTimer > 0) {
      this._hitStopTimer -= delta;
      if (this._hitStopTimer <= 0) logEvent('hitstop_end');
      // During hit stop, only update HUD (no gameplay)
      this._updateHUD();
      return;
    }

    // Update beat system (music_video channel)
    if (this._beatSystem) {
      this._beatSystem.update(delta);
    }

    // Update enemies
    for (const enemy of this._enemies) {
      if (enemy.active) {
        enemy.update(this._player.x, this._player.y, delta);
      }
    }

    // Update boss
    if (this._boss && this._boss.isAlive) {
      this._boss.update(this._player.x, this._player.y, delta);
    }

    // Combat checks
    this._checkCombat();
    this._checkRoomCleared();

    // Pit damage
    this._checkPitDamage(delta);

    // Pickups
    this._updatePickups(delta);

    // Item pedestals
    this._checkItemPickup();

    // Door transitions
    this._checkDoorTransitions();

    // Update noise occasionally
    if (Math.random() < 0.03) this._drawNoise();

    // HUD
    this._updateHUD();
  }
}
