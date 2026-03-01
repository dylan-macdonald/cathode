import { Physics, Scene, Input } from 'phaser';
import { Projectile } from './Projectile';
import { ItemSystem } from '../systems/ItemSystem';
import { PlayerStats } from '../data/items';
import { WEAPON_DEFS } from '../data/weapons';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createMuzzleFlashConfig, createSurfTrailConfig } from '../rendering/ParticlePresets';
import { angleBetween } from '../utils/math';
import {
  PLAYER_SIZE,
  PLAYER_ACCELERATION,
  PLAYER_DRAG,
  PLAYER_INVULN_DURATION,
  CHANNEL_SURF_DURATION,
  CHANNEL_SURF_DISTANCE,
  SHAKE_INTENSITY,
  SHAKE_DURATION,
  HIT_SHAKE_INTENSITY,
  HIT_SHAKE_DURATION,
} from '../utils/constants';
import { loadSettings } from '../systems/SettingsManager';
import { logEvent } from '../debug/EventLog';

export class Player extends Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  projectiles: Physics.Arcade.Group;
  items: ItemSystem;
  isInvulnerable = false;
  isSurfing = false;
  weaponType: string;
  slowTimer = 0; // whistle_stun: halves moveSpeed while > 0

  private _keys!: {
    W: Input.Keyboard.Key;
    A: Input.Keyboard.Key;
    S: Input.Keyboard.Key;
    D: Input.Keyboard.Key;
    SPACE: Input.Keyboard.Key;
    Q: Input.Keyboard.Key;
  };
  private _shootCooldown = 0;
  private _surfCooldown = 0;
  private _surfTrailEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private _gamepadEnabled = false;
  private _autoFire = false;

  get surfCooldownRemaining(): number { return Math.max(0, this._surfCooldown); }
  get surfCooldownMax(): number { return this.items.stats.surfCooldown; }

  constructor(scene: Scene, x: number, y: number, items: ItemSystem, weaponType = 'phosphor_beam') {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.items = items;
    this.weaponType = weaponType;
    this.hp = items.stats.maxHP;
    this.maxHp = items.stats.maxHP;

    const body = this.body as Physics.Arcade.Body;
    body.setCircle(PLAYER_SIZE, this.width / 2 - PLAYER_SIZE, this.height / 2 - PLAYER_SIZE);
    body.setMaxVelocity(items.stats.moveSpeed, items.stats.moveSpeed);
    body.setDrag(PLAYER_DRAG, PLAYER_DRAG);
    body.setCollideWorldBounds(true);

    this.projectiles = scene.physics.add.group({
      runChildUpdate: true,
    });

    this._keys = {
      W: scene.input.keyboard!.addKey('W'),
      A: scene.input.keyboard!.addKey('A'),
      S: scene.input.keyboard!.addKey('S'),
      D: scene.input.keyboard!.addKey('D'),
      SPACE: scene.input.keyboard!.addKey('SPACE'),
      Q: scene.input.keyboard!.addKey('Q'),
    };

    scene.input.on('pointerdown', (pointer: Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this._tryShoot();
      } else if (pointer.rightButtonDown()) {
        this._tryChannelSurf();
      }
    });

    scene.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Load accessibility settings
    const settings = loadSettings();
    this._gamepadEnabled = settings.gamepadEnabled;
    this._autoFire = settings.autoFire;

    // Pulsing glow
    scene.tweens.add({
      targets: this,
      alpha: { from: 0.85, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  syncStats(): void {
    const body = this.body as Physics.Arcade.Body;
    body.setMaxVelocity(this.items.stats.moveSpeed, this.items.stats.moveSpeed);
    this.maxHp = Math.ceil(this.items.stats.maxHP);
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this._handleMovement();
    this._handleCooldowns(delta);
    this.items.update(delta);

    // Auto-fire or hold-to-fire
    if (this._autoFire) {
      this._tryShoot();
    } else if (this.scene.input.activePointer.isDown && this.scene.input.activePointer.leftButtonDown()) {
      this._tryShoot();
    }

    if (Phaser.Input.Keyboard.JustDown(this._keys.SPACE)) {
      this._tryChannelSurf();
    }

    // Bomb (Q key)
    if (Phaser.Input.Keyboard.JustDown(this._keys.Q)) {
      this._tryBomb();
    }

    // Gamepad input
    if (this._gamepadEnabled) {
      this._handleGamepad();
    }
  }

  private _handleGamepad(): void {
    const pad = this.scene.input.gamepad?.pad1;
    if (!pad) return;

    const body = this.body as Physics.Arcade.Body;

    // Left stick = movement
    const lx = pad.leftStick.x;
    const ly = pad.leftStick.y;
    const deadzone = 0.2;

    if (Math.abs(lx) > deadzone || Math.abs(ly) > deadzone) {
      body.setAcceleration(lx * PLAYER_ACCELERATION, ly * PLAYER_ACCELERATION);
    }

    // Right trigger = shoot
    if (pad.R2 > 0.3) {
      this._tryShoot();
    }

    // Left trigger = surf
    if (pad.L2 > 0.3) {
      this._tryChannelSurf();
    }

    // A button (index 0) = bomb
    if (pad.A) {
      this._tryBomb();
    }
  }

  private _handleMovement(): void {
    const body = this.body as Physics.Arcade.Body;
    let ax = 0;
    let ay = 0;

    if (this._keys.A.isDown) ax -= PLAYER_ACCELERATION;
    if (this._keys.D.isDown) ax += PLAYER_ACCELERATION;
    if (this._keys.W.isDown) ay -= PLAYER_ACCELERATION;
    if (this._keys.S.isDown) ay += PLAYER_ACCELERATION;

    if (ax !== 0 && ay !== 0) {
      ax *= 0.707;
      ay *= 0.707;
    }

    // Whistle stun: halve max velocity while slowed
    const speedMult = this.slowTimer > 0 ? 0.5 : 1;
    body.setMaxVelocity(this.items.stats.moveSpeed * speedMult, this.items.stats.moveSpeed * speedMult);

    body.setAcceleration(ax, ay);
  }

  private _handleCooldowns(delta: number): void {
    if (this._shootCooldown > 0) this._shootCooldown -= delta;
    if (this._surfCooldown > 0) this._surfCooldown -= delta;
    if (this.slowTimer > 0) this.slowTimer -= delta;
  }

  private _tryShoot(): void {
    if (this._shootCooldown > 0 || this.isSurfing) return;
    // Performance cap: max 200 player projectiles
    if (this.projectiles.getLength() >= 200) return;
    const weaponDef = WEAPON_DEFS[this.weaponType];
    this._shootCooldown = this.items.getFireCooldown() / (weaponDef?.fireRateMultiplier ?? 1.0);

    const pointer = this.scene.input.activePointer;
    const baseAngle = angleBetween(this.x, this.y, pointer.worldX, pointer.worldY);
    const stats = this.items.stats;
    const baseDamage = this.items.getEffectiveDamage();

    // Dispatch to weapon-specific fire methods
    switch (this.weaponType) {
      case 'scan_line':
        this._fireWeaponScanLine(baseAngle, stats, baseDamage);
        break;
      case 'color_burst':
        this._fireWeaponColorBurst(baseAngle, stats, baseDamage);
        break;
      case 'interference_pattern':
        this._fireWeaponInterferencePattern(baseAngle, stats, baseDamage);
        break;
      case 'phosphor_beam':
      default:
        this._fireWeaponPhosphorBeam(baseAngle, stats, baseDamage);
        break;
    }

    // Afterimage (applies to all weapon types)
    if (this.items.hasAfterimage) {
      this.scene.time.delayedCall(100, () => {
        if (!this.active) return;
        switch (this.weaponType) {
          case 'scan_line':
            this._fireWeaponScanLine(baseAngle, stats, baseDamage * 0.5, true);
            break;
          case 'color_burst':
            this._fireWeaponColorBurst(baseAngle, stats, baseDamage * 0.5, true);
            break;
          case 'interference_pattern':
            this._fireWeaponInterferencePattern(baseAngle, stats, baseDamage * 0.5, true);
            break;
          case 'phosphor_beam':
          default:
            this._fireWeaponPhosphorBeam(baseAngle, stats, baseDamage * 0.5, true);
            break;
        }
      });
    }

    // Screen shake (scaled by screenShake stat)
    this.scene.cameras.main.shake(
      SHAKE_DURATION,
      SHAKE_INTENSITY * stats.screenShake,
    );

    // Recoil if screenShake is high
    if (stats.screenShake > 1.5) {
      const recoilAngle = baseAngle + Math.PI;
      this.x += Math.cos(recoilAngle) * 2;
      this.y += Math.sin(recoilAngle) * 2;
    }

    // Muzzle flash
    const flashX = this.x + Math.cos(baseAngle) * (PLAYER_SIZE + 8);
    const flashY = this.y + Math.sin(baseAngle) * (PLAYER_SIZE + 8);
    emitBurst(this.scene, flashX, flashY, createMuzzleFlashConfig());

    playSFX('player_shoot');
    logEvent('player_shoot', { weaponType: this.weaponType });
  }

  private _spawnProjectile(
    angle: number,
    stats: PlayerStats,
    damage: number,
    weaponType: string,
    isAfterimage = false,
  ): void {
    const offsetDist = PLAYER_SIZE + 8;
    const spawnX = this.x + Math.cos(angle) * offsetDist;
    const spawnY = this.y + Math.sin(angle) * offsetDist;
    const proj = new Projectile(
      this.scene,
      spawnX,
      spawnY,
      angle,
      { ...stats, damage },
      isAfterimage,
      weaponType,
    );
    // Apply weapon color tint for non-Phosphor weapons
    const weaponDef = WEAPON_DEFS[weaponType];
    if (weaponDef && weaponType !== 'phosphor_beam') {
      proj.setTint(weaponDef.color);
    }
    this.projectiles.add(proj);
  }

  // phosphor_beam: original behavior — item-driven count, spread, homing, etc.
  private _fireWeaponPhosphorBeam(
    baseAngle: number,
    stats: PlayerStats,
    baseDamage: number,
    isAfterimage = false,
  ): void {
    const count = stats.projectileCount;
    const spreadRad = Phaser.Math.DegToRad(stats.spreadAngle);

    for (let i = 0; i < count; i++) {
      let angle = baseAngle;
      if (count > 1) {
        const t = (i / (count - 1)) - 0.5;
        angle = baseAngle + t * spreadRad;
      }
      this._spawnProjectile(angle, stats, baseDamage, 'phosphor_beam', isAfterimage);
    }
  }

  // scan_line: wide projectile(s), 0.9x damage, piercing=99 (handled in Projectile)
  private _fireWeaponScanLine(
    baseAngle: number,
    stats: PlayerStats,
    baseDamage: number,
    isAfterimage = false,
  ): void {
    const damage = baseDamage * 0.9;
    const count = stats.projectileCount;
    // Perpendicular offset for parallel beams
    const perpAngle = baseAngle + Math.PI / 2;
    const spacing = 12;

    for (let i = 0; i < count; i++) {
      let offsetX = 0;
      let offsetY = 0;
      if (count > 1) {
        const t = (i / (count - 1)) - 0.5;
        offsetX = Math.cos(perpAngle) * t * spacing * count;
        offsetY = Math.sin(perpAngle) * t * spacing * count;
      }
      const offsetDist = PLAYER_SIZE + 8;
      const spawnX = this.x + Math.cos(baseAngle) * offsetDist + offsetX;
      const spawnY = this.y + Math.sin(baseAngle) * offsetDist + offsetY;
      const proj = new Projectile(
        this.scene, spawnX, spawnY, baseAngle,
        { ...stats, damage }, isAfterimage, 'scan_line',
      );
      this.projectiles.add(proj);
    }
  }

  // color_burst: 3*projectileCount projectiles (R/G/B tinted) in spread, 0.8x damage, short range
  private _fireWeaponColorBurst(
    baseAngle: number,
    stats: PlayerStats,
    baseDamage: number,
    isAfterimage = false,
  ): void {
    const damage = baseDamage * 0.8;
    const totalShots = 3 * stats.projectileCount;
    const spreadRad = Phaser.Math.DegToRad(20 + (stats.projectileCount - 1) * 10);
    const colors: number[] = [0xff33ff, 0x33ff33, 0x3333ff]; // magenta, green, blue

    for (let i = 0; i < totalShots; i++) {
      const t = totalShots > 1 ? (i / (totalShots - 1)) - 0.5 : 0;
      const angle = baseAngle + t * spreadRad;
      const offsetDist = PLAYER_SIZE + 8;
      const spawnX = this.x + Math.cos(angle) * offsetDist;
      const spawnY = this.y + Math.sin(angle) * offsetDist;
      const proj = new Projectile(
        this.scene, spawnX, spawnY, angle,
        { ...stats, damage }, isAfterimage, 'color_burst',
      );
      proj.setTint(colors[i % 3]);
      this.projectiles.add(proj);
    }
  }

  // interference_pattern: homing projectile(s) with sinusoidal path
  private _fireWeaponInterferencePattern(
    baseAngle: number,
    stats: PlayerStats,
    baseDamage: number,
    isAfterimage = false,
  ): void {
    const damage = baseDamage * 1.1;
    const count = stats.projectileCount;
    const spreadRad = Phaser.Math.DegToRad(15);

    for (let i = 0; i < count; i++) {
      let angle = baseAngle;
      if (count > 1) {
        const t = (i / (count - 1)) - 0.5;
        angle = baseAngle + t * spreadRad;
      }
      this._spawnProjectile(angle, stats, damage, 'interference_pattern', isAfterimage);
    }
  }

  private _tryChannelSurf(): void {
    if (this._surfCooldown > 0 || this.isSurfing) return;
    logEvent('player_surf');
    this._surfCooldown = this.items.stats.surfCooldown;
    this.isSurfing = true;
    this.isInvulnerable = true;

    playSFX('channel_surf');

    const body = this.body as Physics.Arcade.Body;
    let dirX = body.velocity.x;
    let dirY = body.velocity.y;

    if (Math.abs(dirX) < 10 && Math.abs(dirY) < 10) {
      const pointer = this.scene.input.activePointer;
      const angle = angleBetween(this.x, this.y, pointer.worldX, pointer.worldY);
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    }

    const mag = Math.sqrt(dirX * dirX + dirY * dirY);
    if (mag > 0) { dirX /= mag; dirY /= mag; }

    const targetX = this.x + dirX * CHANNEL_SURF_DISTANCE;
    const targetY = this.y + dirY * CHANNEL_SURF_DISTANCE;

    this._surfTrailEmitter = this.scene.add.particles(this.x, this.y, 'surf_trail', {
      ...createSurfTrailConfig(),
      emitting: true,
      follow: this,
    });

    this.setAlpha(0.3);
    this.setScale(1.3);

    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: CHANNEL_SURF_DURATION,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.isSurfing = false;
        this.setAlpha(1);
        this.setScale(1);

        if (this._surfTrailEmitter) {
          this._surfTrailEmitter.stop();
          this.scene.time.delayedCall(500, () => {
            this._surfTrailEmitter?.destroy();
            this._surfTrailEmitter = null;
          });
        }

        this.scene.time.delayedCall(100, () => {
          this.isInvulnerable = false;
        });
      },
    });

    this.scene.cameras.main.shake(CHANNEL_SURF_DURATION, 0.004);
  }

  private _tryBomb(): void {
    if (!this.items.useBomb()) return;
    logEvent('player_bomb');
    playSFX('bomb');
    this.scene.cameras.main.shake(200, 0.008);
    this.scene.cameras.main.flash(200, 255, 255, 255, false);
    this.scene.events.emit('player-bomb');
  }

  takeDamage(amount: number): void {
    if (this.isInvulnerable || this.isSurfing) return;

    this.hp -= amount;
    logEvent('player_take_damage', { amount, hpAfter: this.hp });
    playSFX('player_hurt');
    this.scene.cameras.main.shake(HIT_SHAKE_DURATION, HIT_SHAKE_INTENSITY);

    this.isInvulnerable = true;
    this.scene.time.delayedCall(PLAYER_INVULN_DURATION, () => {
      this.isInvulnerable = false;
    });

    this.setTintFill(0xff3333);
    this.scene.tweens.add({
      targets: this,
      duration: 80,
      onComplete: () => this.clearTint(),
    });

    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.3, to: 1 },
      duration: 80,
      repeat: Math.floor(PLAYER_INVULN_DURATION / 80),
      yoyo: true,
    });

    if (this.hp <= 0) {
      this.hp = 0;
      this.scene.events.emit('player-death');
    }
  }

  healHP(amount: number): void {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }
}
