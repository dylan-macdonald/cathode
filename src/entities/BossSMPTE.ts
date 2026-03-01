import { Physics, Scene, GameObjects } from 'phaser';
import { EnemyProjectile } from './Enemy';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

type BossPhase = 1 | 2 | 3;

const BAR_COLORS = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0000ff, 0x4400cc, 0x8800ff];
const BAR_COUNT = 7;
const BAR_WIDTH = 40;
const BOSS_HEIGHT = 80;

interface BarState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;     // orbit angle for phase 3
  chargeTarget: { x: number; y: number } | null;
  chargeTimer: number;
  attackTimer: number;
  alive: boolean;
}

export class BossSMPTE {
  hp: number;
  maxHp: number;
  isAlive = true;

  private _scene: Scene;
  private _projectileGroup: Physics.Arcade.Group;
  private _phase: BossPhase = 1;
  private _phaseTransitioning = false;

  // Core position (center of the bar cluster)
  private _cx: number;
  private _cy: number;

  // Phase 1/2 unit velocity
  private _unitVx = 0;
  private _unitVy = 0;
  private _moveTimer = 0;
  private _moveAngle = Math.random() * Math.PI * 2;

  // Bar states (phase 2+)
  private _bars: BarState[] = [];

  // Orbit angle for phase 3 (shared base)
  private _orbitAngle = 0;
  private _orbitSpeed = 0;

  // Attack timers (phase 1)
  private _beamAttackTimer = 0;
  private _spawnTimer = 0;

  // Beam state
  private _beamActive = false;
  private _beamPositions: number[] = [];
  private _beamTimer = 0;

  // Graphics layers
  private _barsGraphics: GameObjects.Graphics;
  private _beamGraphics: GameObjects.Graphics;
  private _telegraphGraphics: GameObjects.Graphics;
  private _hpBar: GameObjects.Graphics;

  constructor(scene: Scene, x: number, y: number, projectileGroup: Physics.Arcade.Group) {
    this._scene = scene;
    this._cx = x;
    this._cy = y;
    this._projectileGroup = projectileGroup;

    this.maxHp = 120;
    this.hp = 120;

    this._barsGraphics = scene.add.graphics();
    this._beamGraphics = scene.add.graphics();
    this._telegraphGraphics = scene.add.graphics();
    this._hpBar = scene.add.graphics();
    this._hpBar.setDepth(100);
    this._barsGraphics.setDepth(10);

    // Initialize bar states
    for (let i = 0; i < BAR_COUNT; i++) {
      this._bars.push({
        x: x + (i - (BAR_COUNT - 1) / 2) * BAR_WIDTH,
        y: y,
        vx: 0,
        vy: 0,
        angle: (Math.PI * 2 * i) / BAR_COUNT,
        chargeTarget: null,
        chargeTimer: 0,
        attackTimer: 2000 + Math.random() * 1000,
        alive: true,
      });
    }

    this._orbitSpeed = 0.02;
    this._updateHPBar();
    this._drawBars();
  }

  private _drawBars(): void {
    this._barsGraphics.clear();
    if (!this.isAlive) return;

    const phase = this._phase;

    if (phase === 1) {
      // All bars together as one unit
      const totalWidth = BAR_COUNT * BAR_WIDTH;
      const startX = this._cx - totalWidth / 2;
      const startY = this._cy - BOSS_HEIGHT / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        this._barsGraphics.fillStyle(BAR_COLORS[i], 1);
        this._barsGraphics.fillRect(startX + i * BAR_WIDTH, startY, BAR_WIDTH - 2, BOSS_HEIGHT);
      }
    } else {
      // Individual bar positions
      for (let i = 0; i < BAR_COUNT; i++) {
        const bar = this._bars[i];
        if (!bar.alive) continue;

        this._barsGraphics.fillStyle(BAR_COLORS[i], 1);
        this._barsGraphics.fillRect(
          bar.x - BAR_WIDTH / 2,
          bar.y - BOSS_HEIGHT / 2,
          BAR_WIDTH - 2,
          BOSS_HEIGHT,
        );

        // Bright top edge
        this._barsGraphics.fillStyle(0xffffff, 0.4);
        this._barsGraphics.fillRect(bar.x - BAR_WIDTH / 2, bar.y - BOSS_HEIGHT / 2, BAR_WIDTH - 2, 3);
      }
    }
  }

  takeDamage(amount: number): boolean {
    if (!this.isAlive || this._phaseTransitioning) return false;

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
    this._scene.cameras.main.flash(200, 255, 255, 255, false);

    // Notify GameScene for CRT aberration pulse
    this._scene.events.emit('boss-phase-transition');

    if (newPhase === 2) {
      // Scatter bars to individual positions
      for (let i = 0; i < BAR_COUNT; i++) {
        this._bars[i].x = this._cx + (i - (BAR_COUNT - 1) / 2) * BAR_WIDTH;
        this._bars[i].y = this._cy;
        // Give each bar a random initial velocity
        const a = Math.random() * Math.PI * 2;
        this._bars[i].vx = Math.cos(a) * 40;
        this._bars[i].vy = Math.sin(a) * 40;
      }
    } else if (newPhase === 3) {
      // Orbit mode: place bars on a circle around center
      for (let i = 0; i < BAR_COUNT; i++) {
        this._bars[i].angle = (Math.PI * 2 * i) / BAR_COUNT;
      }
      this._orbitSpeed = 0.05;
    }

    const text = this._scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, `PHASE ${newPhase}`, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffff00',
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

    this._beamActive = false;
    this._beamGraphics.clear();
    this._telegraphGraphics.clear();

    // Each color bar explodes individually in sequence (100ms apart), left to right
    // Sort bars by x position for left-to-right explosion
    const sortedIndices = [...Array(BAR_COUNT).keys()].sort((a, b) => this._bars[a].x - this._bars[b].x);

    for (let seq = 0; seq < BAR_COUNT; seq++) {
      const barIdx = sortedIndices[seq];
      const bar = this._bars[barIdx];
      const barColor = BAR_COLORS[barIdx];

      this._scene.time.delayedCall(seq * 100, () => {
        if (!this._scene) return;

        // Mark bar as no longer alive for drawing
        bar.alive = false;

        // Burst of particles in that bar's color
        const colorR = (barColor >> 16) & 0xff;
        const colorG = (barColor >> 8) & 0xff;
        const colorB = barColor & 0xff;

        // Emit colored burst using death burst config
        emitBurst(
          this._scene,
          bar.x,
          bar.y,
          {
            ...createDeathBurstConfig(),
            quantity: 20,
            tint: barColor,
          },
        );

        // Camera shake intensifies with each explosion
        const shakeIntensity = 0.003 + seq * 0.002;
        this._scene.cameras.main.shake(150, shakeIntensity);

        // Redraw bars (without the exploded one)
        this._drawBars();
      });
    }

    // Final white flash when last bar explodes
    this._scene.time.delayedCall(BAR_COUNT * 100, () => {
      if (!this._scene) return;
      this._scene.cameras.main.flash(400, 255, 255, 255, false);
      this._scene.cameras.main.shake(500, 0.015);
    });

    // Cleanup and emit boss-defeated after full 3-second death sequence
    this._scene.time.delayedCall(3000, () => {
      if (!this._scene) return;
      this._barsGraphics.clear();
      this._hpBar.clear();
      this._scene.events.emit('boss-defeated');
    });
  }

  update(playerX: number, playerY: number, delta: number): void {
    if (!this.isAlive || this._phaseTransitioning) return;

    this._beamAttackTimer += delta;
    this._spawnTimer += delta;

    if (this._phase === 1) {
      this._updatePhase1(playerX, playerY, delta);
    } else if (this._phase === 2) {
      this._updatePhase2(playerX, playerY, delta);
    } else {
      this._updatePhase3(playerX, playerY, delta);
    }

    // Update beam timeout
    if (this._beamActive) {
      this._beamTimer -= delta;
      if (this._beamTimer <= 0) {
        this._beamActive = false;
        this._beamGraphics.clear();
      }
    }

    this._doSpawns();
    this._drawBars();
    this._updateHPBar();
  }

  private _updatePhase1(px: number, py: number, delta: number): void {
    // Unit drifts left/right as a block
    this._moveTimer += delta;
    if (this._moveTimer > 2500) {
      this._moveAngle = Math.atan2(
        GAME_HEIGHT / 2 - this._cy + (Math.random() - 0.5) * 100,
        GAME_WIDTH / 2 - this._cx + (Math.random() - 0.5) * 150,
      );
      this._moveTimer = 0;
    }

    const speed = 25;
    this._unitVx = Math.cos(this._moveAngle) * speed;
    this._unitVy = Math.sin(this._moveAngle) * speed;

    this._cx += this._unitVx * (delta / 1000);
    this._cy += this._unitVy * (delta / 1000);

    const halfW = (BAR_COUNT * BAR_WIDTH) / 2;
    this._cx = Phaser.Math.Clamp(this._cx, 180 + halfW, GAME_WIDTH - 180 - halfW);
    this._cy = Phaser.Math.Clamp(this._cy, 120, GAME_HEIGHT - 120);

    // Sync bar x positions to unit center
    for (let i = 0; i < BAR_COUNT; i++) {
      this._bars[i].x = this._cx + (i - (BAR_COUNT - 1) / 2) * BAR_WIDTH;
      this._bars[i].y = this._cy;
    }

    // Fire horizontal beam attack
    const cooldown = 3000;
    if (this._beamAttackTimer >= cooldown) {
      this._beamAttackTimer = 0;
      this._fireHorizontalBeam(3);
    }
  }

  private _updatePhase2(px: number, py: number, delta: number): void {
    // Each bar drifts independently
    for (let i = 0; i < BAR_COUNT; i++) {
      const bar = this._bars[i];
      if (!bar.alive) continue;

      bar.attackTimer -= delta;

      // Drift: change velocity gradually
      if (Math.random() < 0.005) {
        const a = Math.random() * Math.PI * 2;
        bar.vx = Math.cos(a) * 50;
        bar.vy = Math.sin(a) * 50;
      }

      bar.x += bar.vx * (delta / 1000);
      bar.y += bar.vy * (delta / 1000);

      // Clamp to arena
      bar.x = Phaser.Math.Clamp(bar.x, 100, GAME_WIDTH - 100);
      bar.y = Phaser.Math.Clamp(bar.y, 80, GAME_HEIGHT - 80);

      // Bounce off walls
      if (bar.x <= 100 || bar.x >= GAME_WIDTH - 100) bar.vx *= -1;
      if (bar.y <= 80 || bar.y >= GAME_HEIGHT - 80) bar.vy *= -1;

      // Fire aimed burst from each bar
      if (bar.attackTimer <= 0) {
        bar.attackTimer = 1500 + Math.random() * 1000;
        this._fireAimedBurstFromBar(bar.x, bar.y, px, py);
      }
    }

    // Update center for reference
    this._cx = GAME_WIDTH / 2;
    this._cy = GAME_HEIGHT / 2;

    // Overall beam attack still fires occasionally
    const cooldown = 4000;
    if (this._beamAttackTimer >= cooldown) {
      this._beamAttackTimer = 0;
      this._fireHorizontalBeam(2);
    }
  }

  private _updatePhase3(px: number, py: number, delta: number): void {
    this._orbitAngle += this._orbitSpeed * delta / 16;
    const orbitRadius = 140;

    for (let i = 0; i < BAR_COUNT; i++) {
      const bar = this._bars[i];
      if (!bar.alive) continue;

      bar.attackTimer -= delta;

      if (bar.chargeTarget) {
        // Charging toward player
        bar.chargeTimer -= delta;
        const dx = bar.chargeTarget.x - bar.x;
        const dy = bar.chargeTarget.y - bar.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        bar.x += (dx / (dist || 1)) * 250 * (delta / 1000);
        bar.y += (dy / (dist || 1)) * 250 * (delta / 1000);

        if (dist < 20 || bar.chargeTimer <= 0) {
          bar.chargeTarget = null;
          bar.chargeTimer = 0;
          // Bounce back to orbit
          bar.angle = (Math.PI * 2 * i) / BAR_COUNT + this._orbitAngle;
        }
      } else {
        // Orbit center
        bar.angle = (Math.PI * 2 * i) / BAR_COUNT + this._orbitAngle;
        bar.x = this._cx + Math.cos(bar.angle) * orbitRadius;
        bar.y = this._cy + Math.sin(bar.angle) * orbitRadius;

        // Occasionally charge at player
        if (bar.attackTimer <= 0) {
          bar.attackTimer = 2000 + Math.random() * 1500;
          if (Math.random() < 0.4) {
            bar.chargeTarget = { x: px, y: py };
            bar.chargeTimer = 800;
          } else {
            this._fireAimedBurstFromBar(bar.x, bar.y, px, py);
          }
        }
      }

      // Clamp center drift
      this._cx = GAME_WIDTH / 2;
      this._cy = GAME_HEIGHT / 2;
    }

    // Ring attack from center
    if (this._beamAttackTimer >= 2500) {
      this._beamAttackTimer = 0;
      this._fireRingFromCenter();
    }
  }

  private _fireHorizontalBeam(count: number): void {
    this._telegraphGraphics.clear();
    const positions: number[] = [];

    for (let i = 0; i < count; i++) {
      const pos = 100 + Math.random() * (GAME_HEIGHT - 200);
      positions.push(pos);

      this._telegraphGraphics.lineStyle(2, 0xffff00, 0.25);
      this._telegraphGraphics.beginPath();
      this._telegraphGraphics.moveTo(0, pos);
      this._telegraphGraphics.lineTo(GAME_WIDTH, pos);
      this._telegraphGraphics.strokePath();
    }

    this._scene.time.delayedCall(500, () => {
      if (!this.isAlive) return;
      this._telegraphGraphics.clear();
      this._beamActive = true;
      this._beamPositions = positions;
      this._beamTimer = 900;

      this._beamGraphics.clear();
      for (const pos of positions) {
        // Draw 7-color striped beam using bar colors
        for (let i = 0; i < BAR_COUNT; i++) {
          const segW = GAME_WIDTH / BAR_COUNT;
          this._beamGraphics.lineStyle(8, BAR_COLORS[i], 0.8);
          this._beamGraphics.beginPath();
          this._beamGraphics.moveTo(i * segW, pos);
          this._beamGraphics.lineTo((i + 1) * segW, pos);
          this._beamGraphics.strokePath();
        }
      }

      this._scene.cameras.main.shake(100, 0.003);
      playSFX('enemy_shoot');
    });
  }

  private _fireAimedBurstFromBar(bx: number, by: number, px: number, py: number): void {
    const baseAngle = Phaser.Math.Angle.Between(bx, by, px, py);
    const count = this._phase === 3 ? 7 : 5;
    const spread = Phaser.Math.DegToRad(50);
    const step = spread / (count - 1);

    for (let i = 0; i < count; i++) {
      const angle = baseAngle - spread / 2 + step * i;
      const proj = new EnemyProjectile(this._scene, bx, by, angle, 200, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
  }

  private _fireRingFromCenter(): void {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, 180, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
    this._scene.cameras.main.flash(60, 255, 255, 0, false);
  }

  private _doSpawns(): void {
    const spawnInterval = this._phase === 3 ? 5000 : 10000;
    if (this._spawnTimer < spawnInterval) return;
    this._spawnTimer = 0;

    const count = this._phase === 3 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      this._scene.events.emit('boss-spawn-add', {
        type: 'grid_walker',
        x: 100 + Math.random() * (GAME_WIDTH - 200),
        y: 100 + Math.random() * (GAME_HEIGHT - 200),
      });
    }
  }

  isBeamHitting(px: number, py: number): boolean {
    if (!this._beamActive) return false;

    for (const pos of this._beamPositions) {
      if (Math.abs(py - pos) < 4) return true;
    }
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
    const color = this._phase === 3 ? 0xff0000 : this._phase === 2 ? 0xff8800 : 0xffff00;
    this._hpBar.fillStyle(color, 1);
    this._hpBar.fillRect(x, y, fillWidth, barHeight);

    // Draw striped HP bar using bar colors
    for (let i = 0; i < BAR_COUNT; i++) {
      const segW = fillWidth / BAR_COUNT;
      this._hpBar.fillStyle(BAR_COLORS[i], 1);
      this._hpBar.fillRect(x + i * segW, y, segW, barHeight);
    }

    this._hpBar.setDepth(100);
  }

  cleanup(): void {
    this._barsGraphics?.destroy();
    this._beamGraphics?.destroy();
    this._telegraphGraphics?.destroy();
    this._hpBar?.destroy();
  }
}
