import { Physics, Scene, GameObjects } from 'phaser';
import { PlayerStats } from '../data/items';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

export class Projectile extends Physics.Arcade.Sprite {
  damage: number;
  piercing: number;
  homingStrength: number;
  trailLength: number;
  isAfterimage: boolean;
  weaponType: string;

  private _lifeTimer = 0;
  private _maxLife: number;
  private _speed: number;
  private _angle: number;
  private _startX: number;
  private _startY: number;
  private _range: number;
  private _trailDots: GameObjects.Graphics | null = null;
  private _trailPositions: { x: number; y: number }[] = [];
  // For sinusoidal interference_pattern movement
  private _perpX: number = 0;
  private _perpY: number = 0;
  private _sinePhase: number = 0;
  private _lastSineOffset: number = 0;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    angle: number,
    stats: PlayerStats,
    isAfterimage = false,
    weaponType = 'phosphor_beam',
  ) {
    // Choose texture based on weapon type
    const textureKey = weaponType === 'scan_line' && scene.textures.exists('projectile_scanline')
      ? 'projectile_scanline'
      : 'projectile';
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.weaponType = weaponType;
    this.isAfterimage = isAfterimage;
    this.damage = stats.damage * (isAfterimage ? 0.5 : 1);
    this.piercing = stats.piercing;
    this.homingStrength = stats.homing;
    this.trailLength = stats.trailLength;
    this._speed = stats.projectileSpeed;
    this._angle = angle;
    this._startX = x;
    this._startY = y;
    this._range = stats.range;
    this._maxLife = (stats.range / stats.projectileSpeed) * 1000;

    // Weapon-type overrides applied on top of item stats
    if (weaponType === 'scan_line') {
      this.piercing = 99;
    } else if (weaponType === 'color_burst') {
      this._range = Math.min(this._range, 300);
      this._maxLife = (this._range / this._speed) * 1000;
    } else if (weaponType === 'interference_pattern') {
      if (this.homingStrength < 0.5) this.homingStrength = 0.5;
      // Precompute the perpendicular direction to travel angle
      this._perpX = -Math.sin(angle);
      this._perpY = Math.cos(angle);
      this._sinePhase = Math.random() * Math.PI * 2; // randomize starting phase
    }

    // Scale based on projectile size stat
    if (stats.projectileSize !== 1) {
      this.setScale(stats.projectileSize);
    }

    // Set velocity
    this.setVelocity(Math.cos(angle) * this._speed, Math.sin(angle) * this._speed);
    this.setRotation(angle);

    // Collision body
    const bodySize = Math.max(3, 4 * stats.projectileSize);
    this.body!.setCircle(bodySize, this.width / 2 - bodySize, this.height / 2 - bodySize);

    // Trail graphics
    if (this.trailLength > 0) {
      this._trailDots = scene.add.graphics();
    }
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this._lifeTimer += delta;

    // Range check
    const dx = this.x - this._startX;
    const dy = this.y - this._startY;
    if (dx * dx + dy * dy > this._range * this._range) {
      this.kill();
      return;
    }

    if (this._lifeTimer >= this._maxLife) {
      this.kill();
      return;
    }

    // Out of bounds
    if (this.x < -20 || this.x > GAME_WIDTH + 20 || this.y < -20 || this.y > GAME_HEIGHT + 20) {
      this.kill();
      return;
    }

    // Homing
    if (this.homingStrength > 0) {
      this._applyHoming(delta);
    }

    // Weapon-specific per-frame behaviors
    if (this.weaponType === 'interference_pattern') {
      this._applySinusoidalOffset(delta);
    }

    // Trail
    if (this.trailLength > 0 && this._trailDots) {
      this._trailPositions.push({ x: this.x, y: this.y });
      if (this._trailPositions.length > this.trailLength * 5) {
        this._trailPositions.shift();
      }
      this._drawTrail();
    }
  }

  private _applyHoming(delta: number): void {
    // Find nearest enemy
    const enemies = this.scene.children.list.filter(
      (obj) => obj instanceof Physics.Arcade.Sprite &&
               obj.active &&
               obj.getData('isEnemy') !== undefined,
    );

    // Broader search — just find objects with enemy_ texture prefix
    let nearest: Phaser.GameObjects.GameObject | null = null;
    let nearestDist = Infinity;

    this.scene.children.list.forEach((obj) => {
      if (obj === this || !obj.active) return;
      const sprite = obj as Physics.Arcade.Sprite;
      if (!sprite.texture || !sprite.texture.key.startsWith('enemy_')) return;
      const d = Phaser.Math.Distance.Between(this.x, this.y, sprite.x, sprite.y);
      if (d < nearestDist && d < 400) {
        nearestDist = d;
        nearest = obj;
      }
    });

    if (nearest) {
      const target = nearest as Physics.Arcade.Sprite;
      const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      let angleDiff = targetAngle - this._angle;

      // Normalize angle diff
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      this._angle += angleDiff * this.homingStrength * (delta / 16);
      this.setVelocity(
        Math.cos(this._angle) * this._speed,
        Math.sin(this._angle) * this._speed,
      );
      this.setRotation(this._angle);
    }
  }

  private _applySinusoidalOffset(delta: number): void {
    // Oscillate perpendicular to travel direction with amplitude 20px
    // Frequency ~2 cycles per second (2 * PI * 2 = ~12.6 rad/s)
    const frequency = 2 * Math.PI * 2; // radians per second
    this._sinePhase += frequency * (delta / 1000);
    const newOffset = Math.sin(this._sinePhase) * 20;
    const offsetDelta = newOffset - this._lastSineOffset;
    this._lastSineOffset = newOffset;

    // Apply the delta offset positionally — don't override physics velocity
    this.x += this._perpX * offsetDelta;
    this.y += this._perpY * offsetDelta;
  }

  private _drawTrail(): void {
    if (!this._trailDots) return;
    this._trailDots.clear();

    for (let i = 0; i < this._trailPositions.length; i++) {
      const pos = this._trailPositions[i];
      const alpha = (i / this._trailPositions.length) * 0.5;
      this._trailDots.fillStyle(0x33ff33, alpha);
      this._trailDots.fillCircle(pos.x, pos.y, 2);
    }
  }

  onEnemyHit(): boolean {
    // Returns true if projectile should be destroyed
    if (this.piercing > 0) {
      this.piercing--;
      return false; // pass through
    }
    return true; // destroy
  }

  kill(): void {
    this._trailDots?.destroy();
    this.setActive(false);
    this.setVisible(false);
    if (this.body) this.body.enable = false;
    this.destroy();
  }

  // Expose trail positions for trail damage checking
  getTrailPositions(): { x: number; y: number }[] {
    return this._trailPositions;
  }
}
