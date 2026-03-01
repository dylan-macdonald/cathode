import { Physics, Scene, GameObjects } from 'phaser';
import { EnemyProjectile } from './Enemy';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

type BossPhase = 1 | 2 | 3;

const BOSS_COLOR = 0x33cc33;

export class BossHalftime {
  hp: number;
  maxHp: number;
  private _alive = true;

  private _scene: Scene;
  private _projectileGroup: Physics.Arcade.Group;
  private _phase: BossPhase = 1;
  private _phaseTransitioning = false;
  private _phaseThresholds = [0.6, 0.3];

  private _cx: number;
  private _cy: number;
  private _vx: number;
  private _vy: number;

  private _attackTimer = 0;
  private _sweepAngle = 0;
  private _chargeTimer = 0;
  private _chargeTarget = { x: 0, y: 0 };
  private _charging = false;
  private _spawnTimer = 0;

  private _graphics: GameObjects.Graphics;
  private _glowGraphics: GameObjects.Graphics;
  private _hpBar: GameObjects.Graphics;

  constructor(scene: Scene, x: number, y: number, projectileGroup: Physics.Arcade.Group) {
    this._scene = scene;
    this._cx = x;
    this._cy = y;
    this._projectileGroup = projectileGroup;

    this.maxHp = 120;
    this.hp = 120;

    const angle = Math.random() * Math.PI * 2;
    this._vx = Math.cos(angle) * 50;
    this._vy = Math.sin(angle) * 50;

    this._glowGraphics = scene.add.graphics().setDepth(8);
    this._graphics = scene.add.graphics().setDepth(10);
    this._hpBar = scene.add.graphics().setDepth(100);

    this._drawBody();
    this._updateHPBar();
  }

  get isAlive(): boolean { return this._alive; }

  private _drawBody(): void {
    this._graphics.clear();
    this._glowGraphics.clear();
    if (!this._alive) return;

    // Marching band formation — horizontal line of circles
    const count = this._phase === 1 ? 5 : this._phase === 2 ? 7 : 9;
    const spacing = 30;
    const r = this._phase === 3 ? 12 : 15;
    const startX = this._cx - ((count - 1) * spacing) / 2;

    for (let i = 0; i < count; i++) {
      const px = startX + i * spacing;
      const py = this._cy;

      // Glow
      this._glowGraphics.fillStyle(BOSS_COLOR, 0.1);
      this._glowGraphics.fillCircle(px, py, r + 10);

      // Body
      this._graphics.fillStyle(BOSS_COLOR, 1);
      this._graphics.fillCircle(px, py, r);
      this._graphics.lineStyle(2, 0xffffff, 0.3);
      this._graphics.strokeCircle(px, py, r);
    }

    // Center emblem
    this._graphics.fillStyle(0xffffff, 0.4);
    this._graphics.fillCircle(this._cx, this._cy, 8);
  }

  takeDamage(amount: number): boolean {
    if (!this._alive || this._phaseTransitioning) return false;

    this.hp -= amount;
    playSFX('boss_hit');
    this._scene.cameras.main.shake(80, 0.004);

    if (this.hp <= this.maxHp * this._phaseThresholds[0] && this._phase === 1) {
      this._transitionPhase(2);
    } else if (this.hp <= this.maxHp * this._phaseThresholds[1] && this._phase < 3) {
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
    this._scene.cameras.main.flash(200, 51, 204, 51, false);
    this._scene.events.emit('boss-phase-transition');

    const text = this._scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, `PHASE ${newPhase}`, {
      fontFamily: 'monospace', fontSize: '20px', color: '#33cc33',
    }).setOrigin(0.5).setDepth(100);

    this._scene.tweens.add({
      targets: text, alpha: 0, duration: 1500,
      onComplete: () => text.destroy(),
    });

    this._scene.time.delayedCall(1000, () => { this._phaseTransitioning = false; });
  }

  private _die(): void {
    this._alive = false;
    playSFX('boss_death');

    for (let wave = 0; wave < 5; wave++) {
      this._scene.time.delayedCall(300 + wave * 300, () => {
        if (!this._scene) return;
        emitBurst(this._scene, this._cx + (Math.random() - 0.5) * 100,
          this._cy + (Math.random() - 0.5) * 60,
          { ...createDeathBurstConfig(), quantity: 15, tint: BOSS_COLOR });
        this._scene.cameras.main.shake(100, 0.003 + wave * 0.002);
      });
    }

    this._scene.time.delayedCall(2000, () => {
      if (!this._scene) return;
      this._scene.cameras.main.shake(600, 0.018);
      this._scene.cameras.main.flash(400, 51, 204, 51, false);
      emitBurst(this._scene, this._cx, this._cy,
        { ...createDeathBurstConfig(), quantity: 40, tint: BOSS_COLOR });
    });

    this._scene.time.delayedCall(2800, () => {
      if (!this._scene) return;
      this._graphics.clear();
      this._glowGraphics.clear();
      this._hpBar.clear();
      this._scene.events.emit('boss-defeated');
    });
  }

  update(playerX: number, playerY: number, delta: number): void {
    if (!this._alive || this._phaseTransitioning) return;

    this._attackTimer += delta;
    this._spawnTimer += delta;

    // Bounce
    this._cx += this._vx * (delta / 1000);
    this._cy += this._vy * (delta / 1000);

    const margin = 120;
    if (this._cx <= margin) { this._cx = margin; this._vx = Math.abs(this._vx); }
    if (this._cx >= GAME_WIDTH - margin) { this._cx = GAME_WIDTH - margin; this._vx = -Math.abs(this._vx); }
    if (this._cy <= margin) { this._cy = margin; this._vy = Math.abs(this._vy); }
    if (this._cy >= GAME_HEIGHT - margin) { this._cy = GAME_HEIGHT - margin; this._vy = -Math.abs(this._vy); }

    if (this._phase === 1) {
      this._updatePhase1(playerX, playerY, delta);
    } else if (this._phase === 2) {
      this._updatePhase2(playerX, playerY, delta);
    } else {
      this._updatePhase3(playerX, playerY, delta);
    }

    // Spawn adds
    if (this._spawnTimer >= (this._phase === 3 ? 6000 : 8000)) {
      this._spawnTimer = 0;
      this._scene.events.emit('boss-spawn-add', {
        type: this._phase >= 2 ? 'cheerleader' : 'puck',
        x: 100 + Math.random() * (GAME_WIDTH - 200),
        y: 100 + Math.random() * (GAME_HEIGHT - 200),
      });
    }

    this._drawBody();
    this._updateHPBar();
  }

  private _updatePhase1(_px: number, _py: number, delta: number): void {
    // Horizontal sweep of projectiles every 2s
    if (this._attackTimer >= 2000) {
      this._attackTimer = 0;
      this._sweepAngle += 0.3;
      const count = 10;
      for (let i = 0; i < count; i++) {
        const x = (GAME_WIDTH / (count + 1)) * (i + 1);
        const proj = new EnemyProjectile(this._scene, x, 80, Math.PI / 2 + this._sweepAngle * 0.1, 150, 1);
        this._projectileGroup.add(proj);
      }
      playSFX('enemy_shoot');
    }
  }

  private _updatePhase2(px: number, py: number, delta: number): void {
    // Sweep + V-formation charge
    if (this._attackTimer >= 2000) {
      this._attackTimer = 0;

      if (!this._charging && Math.random() < 0.4) {
        // V-formation: fire aimed burst in V shape
        const baseAngle = Phaser.Math.Angle.Between(this._cx, this._cy, px, py);
        for (let i = -3; i <= 3; i++) {
          const angle = baseAngle + i * 0.15;
          const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, 200, 1);
          this._projectileGroup.add(proj);
        }
        playSFX('enemy_shoot');
      } else {
        // Sweep
        const count = 12;
        for (let i = 0; i < count; i++) {
          const x = (GAME_WIDTH / (count + 1)) * (i + 1);
          const proj = new EnemyProjectile(this._scene, x, 80, Math.PI / 2, 160, 1);
          this._projectileGroup.add(proj);
        }
        playSFX('enemy_shoot');
      }
    }
  }

  private _updatePhase3(px: number, py: number, delta: number): void {
    // Randomized chaos — rapid fire
    if (this._attackTimer >= 1200) {
      this._attackTimer = 0;

      const pattern = Math.random();
      if (pattern < 0.33) {
        // Random aimed burst
        const baseAngle = Phaser.Math.Angle.Between(this._cx, this._cy, px, py);
        for (let i = 0; i < 8; i++) {
          const angle = baseAngle + (Math.random() - 0.5) * 1.2;
          const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, 180 + Math.random() * 60, 1);
          this._projectileGroup.add(proj);
        }
      } else if (pattern < 0.66) {
        // Ring attack
        const count = 14;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count;
          const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, 170, 1);
          this._projectileGroup.add(proj);
        }
      } else {
        // Full sweep
        const count = 15;
        for (let i = 0; i < count; i++) {
          const x = (GAME_WIDTH / (count + 1)) * (i + 1);
          const proj = new EnemyProjectile(this._scene, x, 80, Math.PI / 2 + (Math.random() - 0.5) * 0.3, 170, 1);
          this._projectileGroup.add(proj);
        }
      }
      playSFX('enemy_shoot');
    }
  }

  isBeamHitting(_px: number, _py: number): boolean { return false; }

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
    this._hpBar.fillStyle(BOSS_COLOR, 1);
    this._hpBar.fillRect(x, y, fillWidth, barHeight);
  }

  cleanup(): void {
    this._graphics?.destroy();
    this._glowGraphics?.destroy();
    this._hpBar?.destroy();
  }
}
