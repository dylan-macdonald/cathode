import { Physics, Scene, GameObjects } from 'phaser';
import { EnemyProjectile } from './Enemy';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

type BossPhase = 1 | 2 | 3;

const BASE_RADIUS = 60;
const BOSS_COLOR = 0xff3333;

export class BossTone {
  hp: number;
  maxHp: number;
  isAlive = true;

  private _scene: Scene;
  private _projectileGroup: Physics.Arcade.Group;
  private _phase: BossPhase = 1;
  private _phaseTransitioning = false;

  // Position
  private _cx: number;
  private _cy: number;

  // Pulse state
  private _pulseScale = 1.0;
  private _pulseDir = 1;
  private _pulseTimer = 0;

  // Attack timers
  private _ringTimer = 0;
  private _burstTimer = 0;
  private _spawnTimer = 0;

  // Movement
  private _moveTimer = 0;
  private _moveAngle = Math.random() * Math.PI * 2;
  private _vx = 0;
  private _vy = 0;

  // Graphics
  private _bodyGraphics: GameObjects.Graphics;
  private _glowGraphics: GameObjects.Graphics;
  private _hpBar: GameObjects.Graphics;

  constructor(scene: Scene, x: number, y: number, projectileGroup: Physics.Arcade.Group) {
    this._scene = scene;
    this._cx = x;
    this._cy = y;
    this._projectileGroup = projectileGroup;

    this.maxHp = 110;
    this.hp = 110;

    this._glowGraphics = scene.add.graphics();
    this._bodyGraphics = scene.add.graphics();
    this._hpBar = scene.add.graphics();

    this._glowGraphics.setDepth(8);
    this._bodyGraphics.setDepth(10);
    this._hpBar.setDepth(100);

    this._updateHPBar();
    this._drawBody();
  }

  private _drawBody(): void {
    this._bodyGraphics.clear();
    this._glowGraphics.clear();
    if (!this.isAlive) return;

    const r = BASE_RADIUS * this._pulseScale;

    // Multi-layer glow effect
    const glowLayers = 4;
    for (let i = glowLayers; i >= 1; i--) {
      const alpha = 0.04 * i;
      const glowR = r + i * 10;
      this._glowGraphics.fillStyle(BOSS_COLOR, alpha);
      this._glowGraphics.fillCircle(this._cx, this._cy, glowR);
    }

    // Inner bright core
    this._bodyGraphics.fillStyle(0xff6666, 1);
    this._bodyGraphics.fillCircle(this._cx, this._cy, r * 0.4);

    // Main body ring
    this._bodyGraphics.lineStyle(6, BOSS_COLOR, 1);
    this._bodyGraphics.strokeCircle(this._cx, this._cy, r);

    // Secondary rings synced to pulse
    this._bodyGraphics.lineStyle(2, BOSS_COLOR, 0.4);
    this._bodyGraphics.strokeCircle(this._cx, this._cy, r * 0.65);

    // Phase indicator rings
    if (this._phase >= 2) {
      this._bodyGraphics.lineStyle(3, 0xff8800, 0.6);
      this._bodyGraphics.strokeCircle(this._cx, this._cy, r * 1.15);
    }
    if (this._phase >= 3) {
      this._bodyGraphics.lineStyle(2, 0xffff00, 0.4);
      this._bodyGraphics.strokeCircle(this._cx, this._cy, r * 1.3);
    }
  }

  takeDamage(amount: number): boolean {
    if (!this.isAlive || this._phaseTransitioning) return false;

    this.hp -= amount;
    playSFX('boss_hit');
    this._scene.cameras.main.shake(80, 0.004);

    // Hit pulse: spike the scale up briefly
    this._pulseScale = Math.min(this._pulseScale + 0.2, 1.4);

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
    this._scene.cameras.main.flash(200, 255, 50, 50, false);

    // Notify GameScene for CRT aberration pulse
    this._scene.events.emit('boss-phase-transition');

    // Screen flash on each ring fire intensifies
    const text = this._scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, `PHASE ${newPhase}`, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ff3333',
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
    this.isAlive = false;
    playSFX('boss_death');

    // Phase 1 (0-1500ms): Pulsing accelerates rapidly
    const pulseAccel = { speed: 0.008 };
    let deathPulseScale = this._pulseScale;
    let deathPulseDir = 1;

    const pulseEvent = this._scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!this._scene) return;
        deathPulseScale += deathPulseDir * pulseAccel.speed;
        if (deathPulseScale >= 1.4) { deathPulseScale = 1.4; deathPulseDir = -1; }
        if (deathPulseScale <= 0.6) { deathPulseScale = 0.6; deathPulseDir = 1; }
        this._pulseScale = deathPulseScale;
        this._drawBody();
      },
    });

    // Accelerate pulse speed over 1.5 seconds
    this._scene.tweens.add({
      targets: pulseAccel,
      speed: 0.06,
      duration: 1500,
      ease: 'Quad.easeIn',
    });

    // Phase 2 (500-2000ms): Concentric rings of particles expand outward in waves
    for (let wave = 0; wave < 5; wave++) {
      this._scene.time.delayedCall(500 + wave * 300, () => {
        if (!this._scene) return;
        const ringCount = 8;
        const radius = 30 + wave * 25;
        for (let i = 0; i < ringCount; i++) {
          const angle = (Math.PI * 2 * i) / ringCount + wave * 0.3;
          emitBurst(
            this._scene,
            this._cx + Math.cos(angle) * radius,
            this._cy + Math.sin(angle) * radius,
            { ...createDeathBurstConfig(), quantity: 10, tint: BOSS_COLOR },
          );
        }
        this._scene.cameras.main.shake(100, 0.003 + wave * 0.002);
      });
    }

    // Phase 3 (2000-2700ms): Circle contracts to nothing
    this._scene.time.delayedCall(2000, () => {
      if (!this._scene) return;
      pulseEvent.destroy();

      // Shrink body scale to 0
      const shrinkObj = { scale: this._pulseScale };
      this._scene.tweens.add({
        targets: shrinkObj,
        scale: 0,
        duration: 700,
        ease: 'Quad.easeIn',
        onUpdate: () => {
          this._pulseScale = shrinkObj.scale;
          this._drawBody();
        },
      });
    });

    // Phase 4 (2700ms): Final sonic boom - big shake + red flash
    this._scene.time.delayedCall(2700, () => {
      if (!this._scene) return;

      // Big camera shake
      this._scene.cameras.main.shake(600, 0.02);
      // Red screen flash
      this._scene.cameras.main.flash(400, 255, 50, 50, false);

      // Final massive burst at center
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
      this._bodyGraphics.clear();
      this._glowGraphics.clear();
      this._hpBar.clear();
      this._scene.events.emit('boss-defeated');
    });
  }

  update(playerX: number, playerY: number, delta: number): void {
    if (!this.isAlive || this._phaseTransitioning) return;

    this._ringTimer += delta;
    this._burstTimer += delta;
    this._spawnTimer += delta;
    this._pulseTimer += delta;
    this._moveTimer += delta;

    // Pulse oscillation: 0.8 to 1.2
    const pulseSpeed = this._phase === 3 ? 0.008 : this._phase === 2 ? 0.005 : 0.003;
    this._pulseScale += this._pulseDir * pulseSpeed * delta;
    if (this._pulseScale >= 1.2) {
      this._pulseScale = 1.2;
      this._pulseDir = -1;
    } else if (this._pulseScale <= 0.8) {
      this._pulseScale = 0.8;
      this._pulseDir = 1;
    }

    // Slow movement
    if (this._moveTimer > 3000) {
      this._moveAngle = Math.atan2(
        GAME_HEIGHT / 2 - this._cy + (Math.random() - 0.5) * 150,
        GAME_WIDTH / 2 - this._cx + (Math.random() - 0.5) * 150,
      );
      this._moveTimer = 0;
    }

    const moveSpeed = this._phase === 3 ? 35 : this._phase === 2 ? 25 : 18;
    this._vx = Math.cos(this._moveAngle) * moveSpeed;
    this._vy = Math.sin(this._moveAngle) * moveSpeed;

    this._cx += this._vx * (delta / 1000);
    this._cy += this._vy * (delta / 1000);

    this._cx = Phaser.Math.Clamp(this._cx, 160, GAME_WIDTH - 160);
    this._cy = Phaser.Math.Clamp(this._cy, 120, GAME_HEIGHT - 120);

    // Ring attacks
    const ringCooldown = this._phase === 3 ? 1500 : this._phase === 2 ? 2000 : 3000;
    if (this._ringTimer >= ringCooldown) {
      this._ringTimer = 0;
      this._fireRingAttack();
    }

    // Aimed bursts (phase 2+)
    if (this._phase >= 2) {
      const burstCooldown = this._phase === 3 ? 1200 : 2500;
      if (this._burstTimer >= burstCooldown) {
        this._burstTimer = 0;
        this._fireAimedBurst(playerX, playerY);
      }
    }

    this._doSpawns();
    this._drawBody();
    this._updateHPBar();
  }

  private _fireRingAttack(): void {
    const count = this._phase === 3 ? 20 : this._phase === 2 ? 16 : 12;
    const speed = this._phase === 3 ? 200 : this._phase === 2 ? 175 : 150;

    if (this._phase >= 2) {
      this._scene.cameras.main.flash(40, 255, 50, 50, false);
    }

    if (this._phase === 3) {
      // Double rings: inner and outer
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        // Inner ring
        const innerProj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, speed * 0.6, 1);
        this._projectileGroup.add(innerProj);
        // Outer ring (offset by half a step)
        const outerAngle = angle + Math.PI / count;
        const outerProj = new EnemyProjectile(this._scene, this._cx, this._cy, outerAngle, speed, 1);
        this._projectileGroup.add(outerProj);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, speed, 1);
        this._projectileGroup.add(proj);
      }
    }

    playSFX('enemy_shoot');

    // Spike the pulse on ring fire
    this._pulseScale = 1.2;
    this._pulseDir = -1;
  }

  private _fireAimedBurst(px: number, py: number): void {
    const baseAngle = Phaser.Math.Angle.Between(this._cx, this._cy, px, py);
    const count = this._phase === 3 ? 9 : 6;
    const spread = Phaser.Math.DegToRad(55);
    const step = spread / (count - 1);

    for (let i = 0; i < count; i++) {
      const angle = baseAngle - spread / 2 + step * i;
      const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, 190, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
  }

  private _doSpawns(): void {
    const spawnInterval = this._phase === 3 ? 4500 : 9000;
    if (this._spawnTimer < spawnInterval) return;
    this._spawnTimer = 0;

    const count = this._phase === 3 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      this._scene.events.emit('boss-spawn-add', {
        type: 'siren_crawler',
        x: 100 + Math.random() * (GAME_WIDTH - 200),
        y: 100 + Math.random() * (GAME_HEIGHT - 200),
      });
    }
  }

  isBeamHitting(_px: number, _py: number): boolean {
    // BossTone does not use beam attacks
    return false;
  }

  private _updateHPBar(): void {
    this._hpBar.clear();
    if (!this.isAlive) return;

    const barWidth = 300;
    const barHeight = 8;
    const x = GAME_WIDTH / 2 - barWidth / 2;
    const y = 12;

    this._hpBar.fillStyle(0x1a1a1a, 0.9);
    this._hpBar.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    const fillWidth = (this.hp / this.maxHp) * barWidth;
    const color = this._phase === 3 ? 0xff0000 : this._phase === 2 ? 0xff6633 : BOSS_COLOR;
    this._hpBar.fillStyle(color, 1);
    this._hpBar.fillRect(x, y, fillWidth, barHeight);

    this._hpBar.setDepth(100);
  }

  cleanup(): void {
    this._bodyGraphics?.destroy();
    this._glowGraphics?.destroy();
    this._hpBar?.destroy();
  }
}
