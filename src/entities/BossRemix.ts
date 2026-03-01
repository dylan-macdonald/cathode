import { Physics, Scene, GameObjects } from 'phaser';
import { EnemyProjectile } from './Enemy';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

type BossPhase = 1 | 2 | 3;

const BOSS_COLOR = 0xff33ff;

export class BossRemix {
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

  private _beatCount = 0;
  private _attackTimer = 0;
  private _pulseScale = 1;
  private _spawnTimer = 0;

  private _graphics: GameObjects.Graphics;
  private _glowGraphics: GameObjects.Graphics;
  private _hpBar: GameObjects.Graphics;

  constructor(scene: Scene, x: number, y: number, projectileGroup: Physics.Arcade.Group) {
    this._scene = scene;
    this._cx = x;
    this._cy = y;
    this._projectileGroup = projectileGroup;

    this.maxHp = 180;
    this.hp = 180;

    this._glowGraphics = scene.add.graphics().setDepth(8);
    this._graphics = scene.add.graphics().setDepth(10);
    this._hpBar = scene.add.graphics().setDepth(100);

    // Listen to beat events
    scene.events.on('beat', (count: number) => {
      if (!this._alive || this._phaseTransitioning) return;
      this._beatCount = count;
      this._onBeat(count);
    });

    this._drawBody();
    this._updateHPBar();
  }

  get isAlive(): boolean { return this._alive; }

  private _drawBody(): void {
    this._graphics.clear();
    this._glowGraphics.clear();
    if (!this._alive) return;

    const r = 50 * this._pulseScale;

    // Multi-ring glow
    for (let i = 4; i >= 1; i--) {
      this._glowGraphics.fillStyle(BOSS_COLOR, 0.04 * i);
      this._glowGraphics.fillCircle(this._cx, this._cy, r + i * 12);
    }

    // Concentric rings (like an equalizer display)
    const ringColors = [0xff33ff, 0x33ffff, 0xffff33];
    for (let i = 0; i < 3; i++) {
      const ringR = r * (1 - i * 0.25);
      this._graphics.lineStyle(4, ringColors[i], 0.7);
      this._graphics.strokeCircle(this._cx, this._cy, ringR);
    }

    // Inner core
    this._graphics.fillStyle(BOSS_COLOR, 0.8);
    this._graphics.fillCircle(this._cx, this._cy, r * 0.3);

    // Beat indicator bars
    const barCount = 8;
    for (let i = 0; i < barCount; i++) {
      const angle = (Math.PI * 2 * i) / barCount;
      const barH = 10 + (this._pulseScale - 1) * 30;
      const innerR = r + 5;
      const outerR = innerR + barH;
      this._graphics.lineStyle(3, ringColors[i % 3], 0.6);
      this._graphics.beginPath();
      this._graphics.moveTo(
        this._cx + Math.cos(angle) * innerR,
        this._cy + Math.sin(angle) * innerR,
      );
      this._graphics.lineTo(
        this._cx + Math.cos(angle) * outerR,
        this._cy + Math.sin(angle) * outerR,
      );
      this._graphics.strokePath();
    }
  }

  private _onBeat(count: number): void {
    // Pulse visually on every beat
    this._pulseScale = 1.3;
    this._scene.tweens.add({
      targets: this,
      _pulseScale: 1,
      duration: 200,
      ease: 'Quad.easeOut',
    });

    if (this._phase === 1) {
      // Radial burst on every 4th beat
      if (count % 4 === 0) {
        this._fireRadialBurst(12, 170);
      }
    } else if (this._phase === 2) {
      // Radial burst on every 4th beat + sine wave on every 2nd
      if (count % 4 === 0) {
        this._fireRadialBurst(14, 180);
      }
      if (count % 2 === 0) {
        this._fireSineWave();
      }
    } else {
      // "Drop" — fire on every beat
      this._fireRadialBurst(8, 200);
      if (count % 2 === 0) {
        this._fireSineWave();
      }
    }
  }

  private _fireRadialBurst(count: number, speed: number): void {
    const offset = this._beatCount * 0.2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + offset;
      const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, speed, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('bass_drop');
  }

  private _fireSineWave(): void {
    // Sine-wave projectile path — fire 5 projectiles in a horizontal line
    // with alternating vertical offsets
    for (let i = 0; i < 5; i++) {
      const xOffset = (i - 2) * 30;
      const angle = Math.PI / 2 + (i - 2) * 0.15;
      const proj = new EnemyProjectile(this._scene, this._cx + xOffset, this._cy, angle, 160, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
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
    this._scene.cameras.main.flash(200, 255, 51, 255, false);
    this._scene.events.emit('boss-phase-transition');

    const text = this._scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, `PHASE ${newPhase}`, {
      fontFamily: 'monospace', fontSize: '20px', color: '#ff33ff',
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
        const ringCount = 8;
        for (let i = 0; i < ringCount; i++) {
          const angle = (Math.PI * 2 * i) / ringCount + wave * 0.3;
          emitBurst(this._scene,
            this._cx + Math.cos(angle) * (20 + wave * 15),
            this._cy + Math.sin(angle) * (20 + wave * 15),
            { ...createDeathBurstConfig(), quantity: 10, tint: BOSS_COLOR });
        }
        this._scene.cameras.main.shake(100, 0.003 + wave * 0.002);
      });
    }

    this._scene.time.delayedCall(2000, () => {
      if (!this._scene) return;
      this._scene.cameras.main.shake(600, 0.018);
      this._scene.cameras.main.flash(400, 255, 51, 255, false);
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

  update(_playerX: number, _playerY: number, delta: number): void {
    if (!this._alive || this._phaseTransitioning) return;

    // Slowly drift toward center
    this._cx += (GAME_WIDTH / 2 - this._cx) * 0.0005 * delta;
    this._cy += (GAME_HEIGHT / 2 - this._cy) * 0.0005 * delta;

    // Pulse scale decay handled by tweens
    if (this._pulseScale > 1) {
      this._pulseScale = Math.max(1, this._pulseScale - delta * 0.002);
    }

    // Spawn adds
    this._spawnTimer += delta;
    if (this._spawnTimer >= 8000) {
      this._spawnTimer = 0;
      this._scene.events.emit('boss-spawn-add', {
        type: this._phase >= 2 ? 'synth_wave' : 'bass_drop',
        x: 100 + Math.random() * (GAME_WIDTH - 200),
        y: 100 + Math.random() * (GAME_HEIGHT - 200),
      });
    }

    this._drawBody();
    this._updateHPBar();
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
    const color = this._phase === 3 ? 0xcc00cc : this._phase === 2 ? 0xff55ff : BOSS_COLOR;
    this._hpBar.fillStyle(color, 1);
    this._hpBar.fillRect(x, y, fillWidth, barHeight);
  }

  cleanup(): void {
    this._graphics?.destroy();
    this._glowGraphics?.destroy();
    this._hpBar?.destroy();
    this._scene.events.off('beat');
  }
}
