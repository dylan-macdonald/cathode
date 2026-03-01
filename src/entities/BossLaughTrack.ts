import { Physics, Scene, GameObjects } from 'phaser';
import { EnemyProjectile } from './Enemy';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

type BossPhase = 1 | 2 | 3;

const BOSS_COLOR = 0xff66aa;
const BASE_RADIUS = 60;

/** Position state for each visual circle (split forms in phases 2 and 3). */
interface CircleState {
  x: number;
  y: number;
  angle: number; // orbit angle around center (phase 3)
  attackTimer: number;
}

export class BossLaughTrack {
  hp: number;
  maxHp: number;
  private _alive = true;

  private _scene: Scene;
  private _projectileGroup: Physics.Arcade.Group;
  private _phase: BossPhase = 1;
  private _phaseTransitioning = false;
  private _phaseThresholds = [0.6, 0.3];

  // Core position
  private _cx: number;
  private _cy: number;

  // Movement (bounce)
  private _vx: number;
  private _vy: number;

  // Timers
  private _attackTimer = 0;
  private _spawnTimer = 0;

  // Phase 2 split circles
  private _circles: CircleState[] = [];

  // Phase 3 orbit
  private _orbitAngle = 0;

  // Graphics
  private _graphics: GameObjects.Graphics;
  private _glowGraphics: GameObjects.Graphics;
  private _hpBar: GameObjects.Graphics;

  constructor(scene: Scene, x: number, y: number, projectileGroup: Physics.Arcade.Group) {
    this._scene = scene;
    this._cx = x;
    this._cy = y;
    this._projectileGroup = projectileGroup;

    this.maxHp = 130;
    this.hp = 130;

    // Initial bounce velocity
    const angle = Math.random() * Math.PI * 2;
    this._vx = Math.cos(angle) * 40;
    this._vy = Math.sin(angle) * 40;

    this._glowGraphics = scene.add.graphics();
    this._graphics = scene.add.graphics();
    this._hpBar = scene.add.graphics();

    this._glowGraphics.setDepth(8);
    this._graphics.setDepth(10);
    this._hpBar.setDepth(100);

    // Initialize a single circle for phase 1
    this._circles = [
      { x, y, angle: 0, attackTimer: 2000 },
    ];

    this._updateHPBar();
    this._drawBody();
  }

  get isAlive(): boolean {
    return this._alive;
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  private _drawBody(): void {
    this._graphics.clear();
    this._glowGraphics.clear();
    if (!this._alive) return;

    if (this._phase === 1) {
      this._drawCircleWithGlow(this._cx, this._cy, BASE_RADIUS);
    } else if (this._phase === 2) {
      // Two smaller circles
      const r = BASE_RADIUS * 0.65;
      for (const c of this._circles) {
        this._drawCircleWithGlow(c.x, c.y, r);
      }
    } else {
      // Four even smaller orbiting circles
      const r = BASE_RADIUS * 0.42;
      for (const c of this._circles) {
        this._drawCircleWithGlow(c.x, c.y, r);
      }
    }
  }

  private _drawCircleWithGlow(cx: number, cy: number, radius: number): void {
    // Multi-layer glow
    const glowLayers = 4;
    for (let i = glowLayers; i >= 1; i--) {
      const alpha = 0.05 * i;
      const glowR = radius + i * 8;
      this._glowGraphics.fillStyle(BOSS_COLOR, alpha);
      this._glowGraphics.fillCircle(cx, cy, glowR);
    }

    // Main body
    this._graphics.fillStyle(BOSS_COLOR, 1);
    this._graphics.fillCircle(cx, cy, radius);

    // Bright inner core
    this._graphics.fillStyle(0xffaacc, 0.6);
    this._graphics.fillCircle(cx, cy, radius * 0.4);

    // Highlight ring
    this._graphics.lineStyle(3, 0xffffff, 0.25);
    this._graphics.strokeCircle(cx, cy, radius * 0.7);

    // Cartoony outline
    this._graphics.lineStyle(3, 0xcc3377, 1);
    this._graphics.strokeCircle(cx, cy, radius);
  }

  // ---------------------------------------------------------------------------
  // Damage / Phase transitions
  // ---------------------------------------------------------------------------

  takeDamage(amount: number): boolean {
    if (!this._alive || this._phaseTransitioning) return false;

    this.hp -= amount;
    playSFX('boss_hit');
    this._scene.cameras.main.shake(80, 0.004);

    if (this.hp <= this.maxHp * this._phaseThresholds[0] && this.hp > this.maxHp * this._phaseThresholds[1] && this._phase === 1) {
      this._transitionPhase(2);
    } else if (this.hp <= this.maxHp * this._phaseThresholds[1] && this.hp > 0 && this._phase < 3) {
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
    this._scene.cameras.main.flash(200, 255, 100, 170, false);

    this._scene.events.emit('boss-phase-transition');

    if (newPhase === 2) {
      // Split into 2 circles offset from center
      this._circles = [
        { x: this._cx - 50, y: this._cy, angle: 0, attackTimer: 1500 },
        { x: this._cx + 50, y: this._cy, angle: Math.PI, attackTimer: 1500 + 750 },
      ];
    } else if (newPhase === 3) {
      // 4 orbiting circles
      this._circles = [];
      for (let i = 0; i < 4; i++) {
        this._circles.push({
          x: this._cx,
          y: this._cy,
          angle: (Math.PI * 2 * i) / 4,
          attackTimer: 1000 + i * 250,
        });
      }
      this._orbitAngle = 0;
    }

    const text = this._scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, `PHASE ${newPhase}`, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ff66aa',
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
    this._alive = false;
    playSFX('boss_death');

    // Phase 1 (0-1500ms): Circles pulse and shrink inward
    const shrinkObj = { scale: 1.0 };
    const pulseEvent = this._scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!this._scene) return;
        // Rapidly flicker the circles
        for (const c of this._circles) {
          c.x += (Math.random() - 0.5) * 8;
          c.y += (Math.random() - 0.5) * 8;
        }
        this._drawBody();
      },
    });

    // Particles burst outward in waves
    for (let wave = 0; wave < 5; wave++) {
      this._scene.time.delayedCall(300 + wave * 300, () => {
        if (!this._scene) return;
        const ringCount = 6;
        const radius = 20 + wave * 20;
        for (let i = 0; i < ringCount; i++) {
          const angle = (Math.PI * 2 * i) / ringCount + wave * 0.4;
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

    // Phase 2 (1800ms): Collapse circles to center and shrink
    this._scene.time.delayedCall(1800, () => {
      if (!this._scene) return;
      pulseEvent.destroy();

      this._scene.tweens.add({
        targets: shrinkObj,
        scale: 0,
        duration: 700,
        ease: 'Quad.easeIn',
        onUpdate: () => {
          // Pull circles toward center
          for (const c of this._circles) {
            c.x = Phaser.Math.Linear(c.x, this._cx, 0.1);
            c.y = Phaser.Math.Linear(c.y, this._cy, 0.1);
          }
          this._drawBody();
        },
      });
    });

    // Phase 3 (2500ms): Final magenta flash
    this._scene.time.delayedCall(2500, () => {
      if (!this._scene) return;
      this._scene.cameras.main.shake(600, 0.018);
      this._scene.cameras.main.flash(400, 255, 100, 170, false);

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
      this._glowGraphics.clear();
      this._hpBar.clear();
      this._scene.events.emit('boss-defeated');
    });
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  update(playerX: number, playerY: number, delta: number): void {
    if (!this._alive || this._phaseTransitioning) return;

    this._attackTimer += delta;
    this._spawnTimer += delta;

    if (this._phase === 1) {
      this._updatePhase1(playerX, playerY, delta);
    } else if (this._phase === 2) {
      this._updatePhase2(playerX, playerY, delta);
    } else {
      this._updatePhase3(playerX, playerY, delta);
    }

    this._doSpawns();
    this._drawBody();
    this._updateHPBar();
  }

  private _updatePhase1(px: number, py: number, delta: number): void {
    // Bounce around screen edges
    this._cx += this._vx * (delta / 1000);
    this._cy += this._vy * (delta / 1000);

    const margin = BASE_RADIUS + 80;
    if (this._cx <= margin) { this._cx = margin; this._vx = Math.abs(this._vx); }
    if (this._cx >= GAME_WIDTH - margin) { this._cx = GAME_WIDTH - margin; this._vx = -Math.abs(this._vx); }
    if (this._cy <= margin) { this._cy = margin; this._vy = Math.abs(this._vy); }
    if (this._cy >= GAME_HEIGHT - margin) { this._cy = GAME_HEIGHT - margin; this._vy = -Math.abs(this._vy); }

    // Sync single circle position
    this._circles[0].x = this._cx;
    this._circles[0].y = this._cy;

    // Fire burst of 5 at player every 2s
    if (this._attackTimer >= 2000) {
      this._attackTimer = 0;
      this._fireAimedBurst(this._cx, this._cy, px, py, 5);
    }
  }

  private _updatePhase2(px: number, py: number, delta: number): void {
    // Center still bounces
    this._cx += this._vx * 1.2 * (delta / 1000);
    this._cy += this._vy * 1.2 * (delta / 1000);

    const margin = 100;
    if (this._cx <= margin) { this._cx = margin; this._vx = Math.abs(this._vx); }
    if (this._cx >= GAME_WIDTH - margin) { this._cx = GAME_WIDTH - margin; this._vx = -Math.abs(this._vx); }
    if (this._cy <= margin) { this._cy = margin; this._vy = Math.abs(this._vy); }
    if (this._cy >= GAME_HEIGHT - margin) { this._cy = GAME_HEIGHT - margin; this._vy = -Math.abs(this._vy); }

    // Position two circles offset from center
    const offset = 55;
    this._circles[0].x = this._cx - offset;
    this._circles[0].y = this._cy;
    this._circles[1].x = this._cx + offset;
    this._circles[1].y = this._cy;

    // Each circle fires independently at 1.5s cooldown
    for (const c of this._circles) {
      c.attackTimer -= delta;
      if (c.attackTimer <= 0) {
        c.attackTimer = 1500;
        this._fireAimedBurst(c.x, c.y, px, py, 5);
      }
    }
  }

  private _updatePhase3(px: number, py: number, delta: number): void {
    // Center drifts slowly toward screen center
    this._cx += (GAME_WIDTH / 2 - this._cx) * 0.001 * delta;
    this._cy += (GAME_HEIGHT / 2 - this._cy) * 0.001 * delta;

    // Orbit 4 circles around center
    this._orbitAngle += 0.0015 * delta;
    const orbitRadius = 100;

    for (let i = 0; i < this._circles.length; i++) {
      const c = this._circles[i];
      c.angle = (Math.PI * 2 * i) / 4 + this._orbitAngle;
      c.x = this._cx + Math.cos(c.angle) * orbitRadius;
      c.y = this._cy + Math.sin(c.angle) * orbitRadius;

      // Each circle fires ring attack at 1s cooldown
      c.attackTimer -= delta;
      if (c.attackTimer <= 0) {
        c.attackTimer = 1000;
        this._fireRingAttack(c.x, c.y);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Attacks
  // ---------------------------------------------------------------------------

  private _fireAimedBurst(bx: number, by: number, px: number, py: number, count: number): void {
    const baseAngle = Phaser.Math.Angle.Between(bx, by, px, py);
    const spread = Phaser.Math.DegToRad(50);
    const step = spread / (count - 1);

    for (let i = 0; i < count; i++) {
      const angle = baseAngle - spread / 2 + step * i;
      const proj = new EnemyProjectile(this._scene, bx, by, angle, 190, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
  }

  private _fireRingAttack(cx: number, cy: number): void {
    const count = 10;
    const speed = 170;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const proj = new EnemyProjectile(this._scene, cx, cy, angle, speed, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
  }

  // ---------------------------------------------------------------------------
  // Spawns
  // ---------------------------------------------------------------------------

  private _doSpawns(): void {
    let interval: number;
    let enemyType: string;

    if (this._phase === 1) {
      interval = 5000;
      enemyType = 'static_mote';
    } else if (this._phase === 2) {
      interval = 6000;
      enemyType = 'bounce_blob';
    } else {
      interval = 8000;
      enemyType = 'ink_blot';
    }

    if (this._spawnTimer < interval) return;
    this._spawnTimer = 0;

    const count = this._phase === 3 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      this._scene.events.emit('boss-spawn-add', {
        type: enemyType,
        x: 100 + Math.random() * (GAME_WIDTH - 200),
        y: 100 + Math.random() * (GAME_HEIGHT - 200),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Beam check (not used by this boss)
  // ---------------------------------------------------------------------------

  isBeamHitting(_px: number, _py: number): boolean {
    return false;
  }

  // ---------------------------------------------------------------------------
  // HP Bar
  // ---------------------------------------------------------------------------

  private _updateHPBar(): void {
    this._hpBar.clear();
    if (!this._alive) return;

    const barWidth = 300;
    const barHeight = 8;
    const x = GAME_WIDTH / 2 - barWidth / 2;
    const y = 12;

    this._hpBar.fillStyle(0x1a1a1a, 0.9);
    this._hpBar.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    const fillWidth = (this.hp / this.maxHp) * barWidth;
    const color = this._phase === 3 ? 0xff3366 : this._phase === 2 ? 0xff5599 : BOSS_COLOR;
    this._hpBar.fillStyle(color, 1);
    this._hpBar.fillRect(x, y, fillWidth, barHeight);

    this._hpBar.setDepth(100);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  cleanup(): void {
    this._graphics?.destroy();
    this._glowGraphics?.destroy();
    this._hpBar?.destroy();
  }
}
