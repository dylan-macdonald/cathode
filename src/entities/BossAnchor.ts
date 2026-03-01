import { Physics, Scene, GameObjects } from 'phaser';
import { EnemyProjectile } from './Enemy';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

type BossPhase = 1 | 2 | 3;

const BOSS_COLOR = 0x3366ff;

export class BossAnchor {
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

  private _attackTimer = 0;
  private _spawnTimer = 0;
  private _teleportTimer = 0;
  private _flickerAlpha = 1;

  private _graphics: GameObjects.Graphics;
  private _glowGraphics: GameObjects.Graphics;
  private _hpBar: GameObjects.Graphics;

  constructor(scene: Scene, x: number, y: number, projectileGroup: Physics.Arcade.Group) {
    this._scene = scene;
    this._cx = x;
    this._cy = y;
    this._projectileGroup = projectileGroup;

    this.maxHp = 150;
    this.hp = 150;

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

    // News desk shape — wide rectangle with smaller rectangles
    const deskW = 120;
    const deskH = 40;

    // Glow
    this._glowGraphics.fillStyle(BOSS_COLOR, 0.08);
    this._glowGraphics.fillCircle(this._cx, this._cy, 80);

    // Main desk
    this._graphics.fillStyle(BOSS_COLOR, this._flickerAlpha);
    this._graphics.fillRect(this._cx - deskW / 2, this._cy - deskH / 2, deskW, deskH);

    // Screen behind desk
    this._graphics.fillStyle(0x112244, 0.9);
    this._graphics.fillRect(this._cx - 50, this._cy - deskH / 2 - 40, 100, 35);
    this._graphics.lineStyle(2, BOSS_COLOR, 0.6);
    this._graphics.strokeRect(this._cx - 50, this._cy - deskH / 2 - 40, 100, 35);

    // "Anchor" figure on top
    this._graphics.fillStyle(0xffffff, 0.6 * this._flickerAlpha);
    this._graphics.fillCircle(this._cx, this._cy - deskH / 2 - 55, 10);

    // Outline
    this._graphics.lineStyle(2, 0xffffff, 0.3);
    this._graphics.strokeRect(this._cx - deskW / 2, this._cy - deskH / 2, deskW, deskH);
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
    this._scene.cameras.main.flash(200, 51, 102, 255, false);
    this._scene.events.emit('boss-phase-transition');

    const text = this._scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, `PHASE ${newPhase}`, {
      fontFamily: 'monospace', fontSize: '20px', color: '#3366ff',
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
      this._scene.cameras.main.flash(400, 51, 102, 255, false);
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

    if (this._phase === 1) {
      this._updatePhase1(playerX, playerY, delta);
    } else if (this._phase === 2) {
      this._updatePhase2(playerX, playerY, delta);
    } else {
      this._updatePhase3(playerX, playerY, delta);
    }

    this._drawBody();
    this._updateHPBar();
  }

  private _updatePhase1(px: number, py: number, _delta: number): void {
    // Fire "headline" horizontal bar projectiles
    if (this._attackTimer >= 2000) {
      this._attackTimer = 0;
      // 3 horizontal bars at different heights aimed at player
      for (let i = 0; i < 3; i++) {
        const y = this._cy + (i - 1) * 20;
        const angle = Phaser.Math.Angle.Between(this._cx, y, px, py);
        const proj = new EnemyProjectile(this._scene, this._cx, y, angle, 180, 1);
        this._projectileGroup.add(proj);
      }
      playSFX('enemy_shoot');
    }
  }

  private _updatePhase2(px: number, py: number, delta: number): void {
    // Headlines + spawns
    if (this._attackTimer >= 1500) {
      this._attackTimer = 0;

      // Burst pattern
      const baseAngle = Phaser.Math.Angle.Between(this._cx, this._cy, px, py);
      const count = 7;
      const spread = Phaser.Math.DegToRad(80);
      for (let i = 0; i < count; i++) {
        const angle = baseAngle - spread / 2 + (spread / (count - 1)) * i;
        const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, 200, 1);
        this._projectileGroup.add(proj);
      }
      playSFX('enemy_shoot');
    }

    // Spawn ticker and camera_drone
    if (this._spawnTimer >= 6000) {
      this._spawnTimer = 0;
      this._scene.events.emit('boss-spawn-add', {
        type: Math.random() < 0.5 ? 'ticker' : 'camera_drone',
        x: 100 + Math.random() * (GAME_WIDTH - 200),
        y: 100 + Math.random() * (GAME_HEIGHT - 200),
      });
    }
  }

  private _updatePhase3(px: number, py: number, delta: number): void {
    // "We interrupt this program" — teleport + rapid fire + flicker
    this._teleportTimer += delta;

    if (this._teleportTimer >= 3000) {
      this._teleportTimer = 0;
      // Teleport to random position
      emitBurst(this._scene, this._cx, this._cy, createDeathBurstConfig());
      this._cx = 150 + Math.random() * (GAME_WIDTH - 300);
      this._cy = 120 + Math.random() * (GAME_HEIGHT - 240);
      emitBurst(this._scene, this._cx, this._cy, createDeathBurstConfig());
      playSFX('teleport');

      // Screen flicker
      this._flickerAlpha = 0.3;
      this._scene.time.delayedCall(200, () => { this._flickerAlpha = 1; });
    }

    // Rapid aimed shots
    if (this._attackTimer >= 800) {
      this._attackTimer = 0;
      const angle = Phaser.Math.Angle.Between(this._cx, this._cy, px, py);
      for (let i = -1; i <= 1; i++) {
        const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle + i * 0.12, 220, 1.5);
        this._projectileGroup.add(proj);
      }
      playSFX('enemy_shoot');
    }

    // Spawns
    if (this._spawnTimer >= 5000) {
      this._spawnTimer = 0;
      for (let i = 0; i < 2; i++) {
        this._scene.events.emit('boss-spawn-add', {
          type: 'camera_drone',
          x: 100 + Math.random() * (GAME_WIDTH - 200),
          y: 100 + Math.random() * (GAME_HEIGHT - 200),
        });
      }
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
    const color = this._phase === 3 ? 0x0033cc : this._phase === 2 ? 0x3355ff : BOSS_COLOR;
    this._hpBar.fillStyle(color, 1);
    this._hpBar.fillRect(x, y, fillWidth, barHeight);
  }

  cleanup(): void {
    this._graphics?.destroy();
    this._glowGraphics?.destroy();
    this._hpBar?.destroy();
  }
}
