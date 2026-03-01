import { Scene, GameObjects, Physics } from 'phaser';
import { EnemyProjectile } from './Enemy';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

type BossPhase = 1 | 2 | 3;

const HEX_RADIUS = 70;
const BOSS_COLOR = 0x33cc33;
const SHIELD_COLOR = 0xffcc33;

export class BossNarrator {
  hp: number;
  maxHp: number;
  private _isAlive = true;

  private _scene: Scene;
  private _projectileGroup: Physics.Arcade.Group;
  private _phase: BossPhase = 1;
  private _phaseTransitioning = false;

  // Position (fixed center-top)
  private _cx: number;
  private _cy: number;

  // Graphics
  private _graphics: GameObjects.Graphics;
  private _shieldGraphics: GameObjects.Graphics;
  private _hpBar: GameObjects.Graphics;

  // Attack timers
  private _attackTimer = 0;
  private _spawnTimer = 0;
  private _ringTimer = 0;

  // Shield
  private _shieldActive = false;
  private _shieldTimer = 0;
  private _shieldCooldownTimer = 0;

  // Phase 3 beam tracking
  private _beamActive = false;
  private _beamAngle = 0;
  private _beamEndX = 0;
  private _beamEndY = 0;
  private _beamGraphics: GameObjects.Graphics;

  // Pulse
  private _pulsePhase = 0;

  constructor(scene: Scene, x: number, y: number, projectileGroup: Physics.Arcade.Group) {
    this._scene = scene;
    this._cx = x;
    this._cy = y;
    this._projectileGroup = projectileGroup;

    this.maxHp = 140;
    this.hp = 140;

    this._graphics = scene.add.graphics();
    this._shieldGraphics = scene.add.graphics();
    this._beamGraphics = scene.add.graphics();
    this._hpBar = scene.add.graphics();

    this._graphics.setDepth(10);
    this._shieldGraphics.setDepth(11);
    this._beamGraphics.setDepth(9);
    this._hpBar.setDepth(100);

    // Start shield cooldown at 10s for first activation
    this._shieldCooldownTimer = 0;

    this._updateHPBar();
    this._drawBody();
  }

  get isAlive(): boolean {
    return this._isAlive;
  }

  private _drawHexagon(gfx: GameObjects.Graphics, cx: number, cy: number, radius: number, color: number, alpha = 1): void {
    gfx.fillStyle(color, alpha);
    gfx.beginPath();

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      if (i === 0) {
        gfx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      } else {
        gfx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      }
    }

    gfx.closePath();
    gfx.fillPath();
  }

  private _strokeHexagon(gfx: GameObjects.Graphics, cx: number, cy: number, radius: number, color: number, lineWidth: number, alpha = 1): void {
    gfx.lineStyle(lineWidth, color, alpha);
    gfx.beginPath();

    for (let i = 0; i <= 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      if (i === 0) {
        gfx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      } else {
        gfx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      }
    }

    gfx.strokePath();
  }

  private _drawBody(): void {
    this._graphics.clear();
    if (!this._isAlive) return;

    const pulse = 1 + Math.sin(this._pulsePhase) * 0.06;
    const r = HEX_RADIUS * pulse;

    // Multi-layer glow
    const glowLayers = 4;
    for (let i = glowLayers; i >= 1; i--) {
      const alpha = 0.04 * i;
      const glowR = r + i * 12;
      this._drawHexagon(this._graphics, this._cx, this._cy, glowR, BOSS_COLOR, alpha);
    }

    // Main hexagon body
    this._drawHexagon(this._graphics, this._cx, this._cy, r, BOSS_COLOR, 0.8);

    // Bright inner hexagon
    this._drawHexagon(this._graphics, this._cx, this._cy, r * 0.5, 0x66ff66, 0.6);

    // Bright core
    this._graphics.fillStyle(0xffffff, 0.35);
    this._graphics.fillCircle(this._cx, this._cy, r * 0.2);

    // Outline
    this._strokeHexagon(this._graphics, this._cx, this._cy, r, 0x66ff66, 3, 0.8);

    // Phase indicator rings
    if (this._phase >= 2) {
      this._strokeHexagon(this._graphics, this._cx, this._cy, r * 1.15, 0x22aa22, 2, 0.5);
    }
    if (this._phase >= 3) {
      this._strokeHexagon(this._graphics, this._cx, this._cy, r * 1.3, 0x11ff11, 2, 0.4);
    }
  }

  private _drawShield(): void {
    this._shieldGraphics.clear();
    if (!this._isAlive || !this._shieldActive) return;

    const shieldPulse = 1 + Math.sin(this._pulsePhase * 3) * 0.08;
    const shieldRadius = (HEX_RADIUS + 20) * shieldPulse;

    // Outer ring
    this._shieldGraphics.lineStyle(4, SHIELD_COLOR, 0.8);
    this._shieldGraphics.strokeCircle(this._cx, this._cy, shieldRadius);

    // Inner glow ring
    this._shieldGraphics.lineStyle(2, SHIELD_COLOR, 0.4);
    this._shieldGraphics.strokeCircle(this._cx, this._cy, shieldRadius - 6);

    // Soft fill
    this._shieldGraphics.fillStyle(SHIELD_COLOR, 0.08);
    this._shieldGraphics.fillCircle(this._cx, this._cy, shieldRadius);
  }

  takeDamage(amount: number): boolean {
    if (!this._isAlive || this._phaseTransitioning) return false;

    // Shield blocks all damage
    if (this._shieldActive) {
      playSFX('boss_hit');
      // Visual feedback: shield flash
      this._shieldGraphics.clear();
      this._shieldGraphics.fillStyle(SHIELD_COLOR, 0.4);
      this._shieldGraphics.fillCircle(this._cx, this._cy, HEX_RADIUS + 25);
      return false;
    }

    this.hp -= amount;
    playSFX('boss_hit');
    this._scene.cameras.main.shake(80, 0.004);

    // Phase transitions
    if (this.hp <= this.maxHp * 0.6 && this.hp > this.maxHp * 0.3 && this._phase === 1) {
      this._transitionPhase(2);
    } else if (this.hp <= this.maxHp * 0.3 && this.hp > 0 && this._phase < 3) {
      this._transitionPhase(3);
    } else if (this.hp <= 0) {
      this.hp = 0;
      this._die();
      return true;
    }

    this._updateHPBar();
    return false;
  }

  private _transitionPhase(newPhase: BossPhase): void {
    this._phaseTransitioning = true;
    this._phase = newPhase;
    playSFX('boss_phase');

    this._scene.cameras.main.shake(300, 0.008);
    this._scene.cameras.main.flash(200, 50, 255, 50, false);

    // Deactivate shield on phase transition
    this._shieldActive = false;
    this._shieldCooldownTimer = 0;

    // Notify GameScene for CRT aberration pulse
    this._scene.events.emit('boss-phase-transition');

    const text = this._scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, `PHASE ${newPhase}`, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#33cc33',
    }).setOrigin(0.5).setDepth(100);

    this._scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: 1500,
      onComplete: () => text.destroy(),
    });

    this._scene.time.delayedCall(1000, () => {
      this._phaseTransitioning = false;
    });
  }

  private _die(): void {
    this._isAlive = false;
    playSFX('boss_death');

    this._shieldActive = false;
    this._beamActive = false;
    this._shieldGraphics.clear();
    this._beamGraphics.clear();

    // Phase 1 (0-1500ms): Hexagon pulses rapidly and shrinks
    const pulseAccel = { speed: 0.008, scale: 1.0 };
    let deathPulseDir = 1;
    let deathPulseScale = 1.0;

    const pulseEvent = this._scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!this._scene) return;
        deathPulseScale += deathPulseDir * pulseAccel.speed;
        if (deathPulseScale >= 1.4) { deathPulseScale = 1.4; deathPulseDir = -1; }
        if (deathPulseScale <= 0.6) { deathPulseScale = 0.6; deathPulseDir = 1; }
        this._pulsePhase += 0.3;
        this._drawBody();
      },
    });

    this._scene.tweens.add({
      targets: pulseAccel,
      speed: 0.06,
      duration: 1500,
      ease: 'Quad.easeIn',
    });

    // Phase 2 (500-2000ms): Green particle bursts in hexagonal pattern
    for (let wave = 0; wave < 6; wave++) {
      this._scene.time.delayedCall(500 + wave * 250, () => {
        if (!this._scene) return;
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI * 2 * i) / 6 + wave * 0.2;
          const radius = 40 + wave * 20;
          emitBurst(
            this._scene,
            this._cx + Math.cos(angle) * radius,
            this._cy + Math.sin(angle) * radius,
            { ...createDeathBurstConfig(), quantity: 12, tint: BOSS_COLOR },
          );
        }
        this._scene.cameras.main.shake(100, 0.003 + wave * 0.002);
      });
    }

    // Phase 3 (2000-2700ms): Hexagon collapses to nothing
    this._scene.time.delayedCall(2000, () => {
      if (!this._scene) return;
      pulseEvent.destroy();

      const shrinkObj = { scale: 1.0 };
      this._scene.tweens.add({
        targets: shrinkObj,
        scale: 0,
        duration: 700,
        ease: 'Quad.easeIn',
        onUpdate: () => {
          this._pulsePhase = Math.asin((shrinkObj.scale - 1) / 0.06);
          this._drawBody();
        },
      });
    });

    // Phase 4 (2700ms): Final green flash
    this._scene.time.delayedCall(2700, () => {
      if (!this._scene) return;
      this._scene.cameras.main.shake(600, 0.02);
      this._scene.cameras.main.flash(400, 50, 255, 50, false);

      emitBurst(
        this._scene,
        this._cx,
        this._cy,
        { ...createDeathBurstConfig(), quantity: 40, tint: BOSS_COLOR },
      );
    });

    // Cleanup at 3000ms
    this._scene.time.delayedCall(3000, () => {
      if (!this._scene) return;
      this._graphics.clear();
      this._shieldGraphics.clear();
      this._beamGraphics.clear();
      this._hpBar.clear();
      this._scene.events.emit('boss-defeated');
    });
  }

  update(playerX: number, playerY: number, delta: number): void {
    if (!this._isAlive || this._phaseTransitioning) return;

    this._attackTimer += delta;
    this._spawnTimer += delta;
    this._ringTimer += delta;
    this._shieldCooldownTimer += delta;
    this._pulsePhase += 0.003 * delta;

    // Shield logic
    this._updateShield(delta);

    if (this._phase === 1) {
      this._updatePhase1(playerX, playerY, delta);
    } else if (this._phase === 2) {
      this._updatePhase2(playerX, playerY, delta);
    } else {
      this._updatePhase3(playerX, playerY, delta);
    }

    this._doSpawns();
    this._drawBody();
    this._drawShield();
    this._updateHPBar();
  }

  private _updateShield(delta: number): void {
    if (this._shieldActive) {
      this._shieldTimer -= delta;
      if (this._shieldTimer <= 0) {
        this._shieldActive = false;
        this._shieldCooldownTimer = 0;
        this._shieldGraphics.clear();
      }
    } else {
      const shieldCooldown = this._phase === 3 ? 6000 : this._phase === 2 ? 8000 : 10000;
      if (this._shieldCooldownTimer >= shieldCooldown) {
        this._shieldActive = true;
        const shieldDuration = this._phase === 3 ? 2000 : 3000;
        this._shieldTimer = shieldDuration;
        this._shieldCooldownTimer = 0;
      }
    }
  }

  private _updatePhase1(px: number, py: number, _delta: number): void {
    // Fire aimed projectile at player every 1.5s
    if (this._attackTimer >= 1500) {
      this._attackTimer = 0;
      this._fireAimed(px, py);
    }
  }

  private _updatePhase2(px: number, py: number, _delta: number): void {
    // Fire quad_aimed every 1.5s
    if (this._attackTimer >= 1500) {
      this._attackTimer = 0;
      this._fireQuadAimed(px, py);
    }

    // Ring attack every 4s
    if (this._ringTimer >= 4000) {
      this._ringTimer = 0;
      this._fireRing();
    }
  }

  private _updatePhase3(px: number, py: number, delta: number): void {
    // Tracking beam
    this._updateTrackingBeam(px, py, delta);

    // Ring every 3s
    if (this._ringTimer >= 3000) {
      this._ringTimer = 0;
      this._fireRing();
    }
  }

  private _fireAimed(px: number, py: number): void {
    const angle = Phaser.Math.Angle.Between(this._cx, this._cy, px, py);
    const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, 200, 1);
    this._projectileGroup.add(proj);
    playSFX('enemy_shoot');
  }

  private _fireQuadAimed(px: number, py: number): void {
    const baseAngle = Phaser.Math.Angle.Between(this._cx, this._cy, px, py);

    // 4 directions: toward player, and 3 cardinal offsets
    const angles = [
      baseAngle,
      baseAngle + Math.PI / 2,
      baseAngle + Math.PI,
      baseAngle + (Math.PI * 3) / 2,
    ];

    for (const angle of angles) {
      const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, 190, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
  }

  private _fireRing(): void {
    const count = this._phase === 3 ? 16 : 12;
    const speed = this._phase === 3 ? 190 : 160;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, speed, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
    this._scene.cameras.main.flash(60, 50, 255, 50, false);
  }

  private _updateTrackingBeam(px: number, py: number, delta: number): void {
    // Beam is always active in phase 3 -- slowly tracks player
    if (!this._beamActive) {
      this._beamActive = true;
      this._beamAngle = Phaser.Math.Angle.Between(this._cx, this._cy, px, py);
    }

    // Smoothly rotate beam toward player
    const targetAngle = Phaser.Math.Angle.Between(this._cx, this._cy, px, py);
    const turnSpeed = 0.8; // radians per second
    const angleDiff = Phaser.Math.Angle.Wrap(targetAngle - this._beamAngle);

    if (Math.abs(angleDiff) < turnSpeed * (delta / 1000)) {
      this._beamAngle = targetAngle;
    } else {
      this._beamAngle += Math.sign(angleDiff) * turnSpeed * (delta / 1000);
    }

    this._beamAngle = Phaser.Math.Angle.Wrap(this._beamAngle);

    // Calculate beam endpoint (extends to screen edge)
    const beamLength = Math.max(GAME_WIDTH, GAME_HEIGHT) * 1.5;
    this._beamEndX = this._cx + Math.cos(this._beamAngle) * beamLength;
    this._beamEndY = this._cy + Math.sin(this._beamAngle) * beamLength;

    // Draw beam
    this._beamGraphics.clear();

    // Telegraph line (thin)
    this._beamGraphics.lineStyle(2, BOSS_COLOR, 0.3);
    this._beamGraphics.beginPath();
    this._beamGraphics.moveTo(this._cx, this._cy);
    this._beamGraphics.lineTo(this._beamEndX, this._beamEndY);
    this._beamGraphics.strokePath();

    // Main beam (thick, bright)
    this._beamGraphics.lineStyle(8, BOSS_COLOR, 0.7);
    this._beamGraphics.beginPath();
    this._beamGraphics.moveTo(this._cx, this._cy);
    this._beamGraphics.lineTo(this._beamEndX, this._beamEndY);
    this._beamGraphics.strokePath();

    // Core beam (bright white center)
    this._beamGraphics.lineStyle(3, 0xffffff, 0.5);
    this._beamGraphics.beginPath();
    this._beamGraphics.moveTo(this._cx, this._cy);
    this._beamGraphics.lineTo(this._beamEndX, this._beamEndY);
    this._beamGraphics.strokePath();
  }

  isBeamHitting(px: number, py: number): boolean {
    if (!this._beamActive || this._phase < 3) return false;

    // Calculate distance from point to beam line
    // Beam goes from (cx, cy) toward (beamEndX, beamEndY)
    const dx = this._beamEndX - this._cx;
    const dy = this._beamEndY - this._cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return false;

    // Perpendicular distance from point to line
    const t = ((px - this._cx) * dx + (py - this._cy) * dy) / (len * len);
    if (t < 0) return false; // Behind the boss

    const closestX = this._cx + t * dx;
    const closestY = this._cy + t * dy;
    const dist = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);

    return dist < 12; // Beam hit radius
  }

  private _doSpawns(): void {
    let spawnInterval: number;
    let spawnType: string;

    if (this._phase === 1) {
      spawnInterval = 5000;
      spawnType = 'spore';
    } else if (this._phase === 2) {
      spawnInterval = 8000;
      spawnType = 'tendril';
    } else {
      spawnInterval = 6000;
      spawnType = 'predator';
    }

    if (this._spawnTimer < spawnInterval) return;
    this._spawnTimer = 0;

    const count = this._phase === 3 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      this._scene.events.emit('boss-spawn-add', {
        type: spawnType,
        x: 100 + Math.random() * (GAME_WIDTH - 200),
        y: 100 + Math.random() * (GAME_HEIGHT - 200),
      });
    }
  }

  private _updateHPBar(): void {
    this._hpBar.clear();
    if (!this._isAlive) return;

    const barWidth = 300;
    const barHeight = 8;
    const x = GAME_WIDTH / 2 - barWidth / 2;
    const y = 12;

    this._hpBar.fillStyle(0x1a1a1a, 0.9);
    this._hpBar.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    const fillWidth = (this.hp / this.maxHp) * barWidth;
    const color = this._phase === 3 ? 0xff0000 : this._phase === 2 ? 0x22aa22 : BOSS_COLOR;
    this._hpBar.fillStyle(color, 1);
    this._hpBar.fillRect(x, y, fillWidth, barHeight);

    this._hpBar.setDepth(100);
  }

  cleanup(): void {
    this._graphics?.destroy();
    this._shieldGraphics?.destroy();
    this._beamGraphics?.destroy();
    this._hpBar?.destroy();
  }
}
