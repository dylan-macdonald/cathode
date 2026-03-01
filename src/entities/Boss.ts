import { Physics, Scene, GameObjects } from 'phaser';
import { EnemyProjectile } from './Enemy';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { CRTPipeline } from '../rendering/CRTShader';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';
import { logEvent } from '../debug/EventLog';

type BossPhase = 1 | 2 | 3;

export class Boss extends Physics.Arcade.Sprite {
  hp = 100;
  maxHp = 100;
  phase: BossPhase = 1;
  isAlive = true;

  private _projectileGroup: Physics.Arcade.Group;
  private _hpBar: GameObjects.Graphics;
  private _noiseGraphics: GameObjects.Graphics;
  private _attackTimer = 0;
  private _spawnTimer = 0;
  private _moveTimer = 0;
  private _moveAngle = Math.random() * Math.PI * 2;
  private _phaseTransitioning = false;
  private _telegraphGraphics: GameObjects.Graphics;
  private _beamGraphics: GameObjects.Graphics;
  private _vignetteOverlay: GameObjects.Graphics;

  // Beam attack state
  private _beamActive = false;
  private _beamHorizontal = true;
  private _beamPositions: number[] = [];
  private _beamTimer = 0;

  constructor(scene: Scene, x: number, y: number, projectileGroup: Physics.Arcade.Group) {
    super(scene, x, y, 'enemy_bar_sentinel'); // reuse tall rect texture for now
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this._projectileGroup = projectileGroup;

    const body = this.body as Physics.Arcade.Body;
    body.setSize(120, 90);
    body.setOffset(this.width / 2 - 60, this.height / 2 - 45);

    // Make the boss a large rectangle via scale
    this.setDisplaySize(200, 150);

    this._hpBar = scene.add.graphics();
    this._noiseGraphics = scene.add.graphics();
    this._telegraphGraphics = scene.add.graphics();
    this._beamGraphics = scene.add.graphics();
    this._vignetteOverlay = scene.add.graphics();
    this._vignetteOverlay.setDepth(90);

    // Animated static noise on the boss
    scene.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => this._drawNoise(),
    });
  }

  private _drawNoise(): void {
    if (!this.active) return;
    this._noiseGraphics.clear();
    this._noiseGraphics.setDepth(this.depth + 1);
    const hw = 100;
    const hh = 75;
    for (let i = 0; i < 50; i++) {
      const nx = this.x - hw + Math.random() * hw * 2;
      const ny = this.y - hh + Math.random() * hh * 2;
      const brightness = Math.random();
      this._noiseGraphics.fillStyle(
        Phaser.Display.Color.GetColor(brightness * 255, brightness * 255, brightness * 255),
        Math.random() * 0.4,
      );
      this._noiseGraphics.fillRect(nx, ny, 4, 4);
    }

    // Occasional "channel flash" — colored shape inside
    if (Math.random() < 0.05) {
      const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
      this._noiseGraphics.fillStyle(colors[Math.floor(Math.random() * colors.length)], 0.3);
      this._noiseGraphics.fillRect(
        this.x - 30 + Math.random() * 60,
        this.y - 20 + Math.random() * 40,
        20 + Math.random() * 30,
        10 + Math.random() * 20,
      );
    }
  }

  takeDamage(amount: number): boolean {
    if (!this.isAlive || this._phaseTransitioning) return false;

    this.hp -= amount;
    logEvent('boss_hit', { hpRemaining: this.hp, phase: this.phase });
    playSFX('boss_hit');
    this.scene.cameras.main.shake(80, 0.004);

    // Hit flash
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.active) this.clearTint();
    });

    // Phase transitions
    const prevPhase = this.phase;
    if (this.hp <= this.maxHp * 0.6 && this.hp > this.maxHp * 0.3 && this.phase === 1) {
      this._transitionPhase(2);
    } else if (this.hp <= this.maxHp * 0.3 && this.hp > 0 && this.phase < 3) {
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
    this.phase = newPhase;
    logEvent('boss_phase', { newPhase });
    playSFX('boss_phase');

    this.scene.cameras.main.shake(300, 0.008);
    this.scene.cameras.main.flash(200, 255, 255, 255, false);

    // Notify GameScene for CRT aberration pulse
    this.scene.events.emit('boss-phase-transition');

    // Clear all active beams
    this._beamActive = false;
    this._beamGraphics.clear();
    this._telegraphGraphics.clear();

    // Phase text
    const text = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, `PHASE ${newPhase}`, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ff3333',
    }).setOrigin(0.5).setDepth(100);

    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: 1500,
      onComplete: () => text.destroy(),
    });

    this.scene.time.delayedCall(1000, () => {
      this._phaseTransitioning = false;
    });
  }

  /** Get the CRT pipeline instance from the camera */
  private _getCRTPipeline(): CRTPipeline | null {
    const crtPipelines = this.scene.cameras.main.getPostPipeline('CRTPipeline');
    if (!crtPipelines) return null;
    const arr = Array.isArray(crtPipelines) ? crtPipelines : [crtPipelines];
    for (const p of arr) {
      if (p instanceof CRTPipeline) return p;
    }
    return null;
  }

  private _die(): void {
    this.isAlive = false;
    logEvent('boss_death');
    playSFX('boss_death');

    // Clean up active attacks
    this._beamActive = false;
    this._beamGraphics.clear();
    this._telegraphGraphics.clear();
    this._vignetteOverlay.clear();

    // Phase 1 (0-2000ms): CRT distortion ramp-up + particle shower + rotation
    const crt = this._getCRTPipeline();
    const distortionTween = { value: 0.08 };
    const aberrationTween = { value: 0.002 };

    // Ramp up CRT distortion over 2 seconds
    this.scene.tweens.add({
      targets: distortionTween,
      value: 0.4,
      duration: 2000,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        crt?.setDistortionOverride(distortionTween.value);
      },
    });
    this.scene.tweens.add({
      targets: aberrationTween,
      value: 0.015,
      duration: 2000,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        crt?.setAberrationOverride(aberrationTween.value);
      },
    });

    // Increasing camera shake during distortion ramp
    this.scene.cameras.main.shake(2000, 0.008);

    // Particle shower during ramp-up
    for (let i = 0; i < 8; i++) {
      this.scene.time.delayedCall(i * 250, () => {
        if (!this.scene) return;
        emitBurst(
          this.scene,
          this.x + (Math.random() - 0.5) * 150,
          this.y + (Math.random() - 0.5) * 100,
          { ...createDeathBurstConfig(), quantity: 20 },
        );
      });
    }

    // Phase 2 (2000ms): Static burst - screen fills with heavy static noise briefly
    this.scene.time.delayedCall(2000, () => {
      if (!this.scene) return;
      const staticBurst = this.scene.add.graphics();
      staticBurst.setDepth(95);

      // Fill screen with heavy static noise
      for (let i = 0; i < 400; i++) {
        const sx = Math.random() * GAME_WIDTH;
        const sy = Math.random() * GAME_HEIGHT;
        const brightness = Math.random();
        staticBurst.fillStyle(
          Phaser.Display.Color.GetColor(brightness * 255, brightness * 255, brightness * 255),
          0.6 + Math.random() * 0.4,
        );
        staticBurst.fillRect(sx, sy, 4 + Math.random() * 8, 2 + Math.random() * 6);
      }

      this.scene.cameras.main.flash(300, 255, 255, 255, false);

      // Fade out static burst
      this.scene.tweens.add({
        targets: staticBurst,
        alpha: 0,
        duration: 400,
        delay: 200,
        onComplete: () => staticBurst.destroy(),
      });
    });

    // Phase 3 (2200ms): Final implosion - boss sprites scale to 0 with rotation
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      angle: 720,
      duration: 800,
      delay: 2200,
      ease: 'Quad.easeIn',
    });

    // Fade noise graphics in sync
    this.scene.tweens.add({
      targets: this._noiseGraphics,
      alpha: 0,
      duration: 800,
      delay: 2200,
    });

    // Final cleanup at 3000ms: reset CRT params and emit boss-defeated
    this.scene.time.delayedCall(3000, () => {
      if (!this.scene) return;

      // Reset CRT overrides
      crt?.resetOverrides();

      this._hpBar.destroy();
      this._noiseGraphics.destroy();
      this._telegraphGraphics.destroy();
      this._beamGraphics.destroy();
      this._vignetteOverlay.destroy();
      this.destroy();
      this.scene.events.emit('boss-defeated');
    });
  }

  update(playerX: number, playerY: number, delta: number): void {
    if (!this.isAlive || this._phaseTransitioning) return;

    this._attackTimer += delta;
    this._spawnTimer += delta;
    this._moveTimer += delta;

    // Movement — slow drift
    const moveSpeed = this.phase === 3 ? 40 : this.phase === 2 ? 30 : 20;
    if (this._moveTimer > 2000) {
      this._moveAngle = Math.atan2(
        GAME_HEIGHT / 2 - this.y + (Math.random() - 0.5) * 200,
        GAME_WIDTH / 2 - this.x + (Math.random() - 0.5) * 200,
      );
      this._moveTimer = 0;
    }

    const body = this.body as Physics.Arcade.Body;
    body.setVelocity(
      Math.cos(this._moveAngle) * moveSpeed,
      Math.sin(this._moveAngle) * moveSpeed,
    );

    // Keep boss in central area
    const cx = Phaser.Math.Clamp(this.x, 200, GAME_WIDTH - 200);
    const cy = Phaser.Math.Clamp(this.y, 150, GAME_HEIGHT - 150);
    if (cx !== this.x || cy !== this.y) {
      this.setPosition(cx, cy);
    }

    // Attacks by phase
    this._doPhaseAttacks(playerX, playerY, delta);

    // Spawn adds
    this._doSpawns(delta);

    // Phase 3: vignette effect (shrinking play area)
    if (this.phase === 3) {
      this._drawVignette();
    }

    // Update beam if active
    if (this._beamActive) {
      this._beamTimer -= delta;
      if (this._beamTimer <= 0) {
        this._beamActive = false;
        this._beamGraphics.clear();
      }
    }

    this._updateHPBar();
  }

  private _doPhaseAttacks(px: number, py: number, delta: number): void {
    const cooldown = this.phase === 3 ? 1500 : this.phase === 2 ? 2500 : 3000;

    if (this._attackTimer < cooldown) return;
    this._attackTimer = 0;

    const roll = Math.random();

    if (this.phase === 1) {
      // Horizontal scanline beams
      this._fireBeamAttack(true, 3);
    } else if (this.phase === 2) {
      if (roll < 0.5) {
        // Alternating horizontal/vertical beams
        this._fireBeamAttack(Math.random() < 0.5, 3);
      } else {
        // Aimed burst at player
        this._fireBurstAtPlayer(px, py, 8);
      }
    } else {
      // Phase 3: everything
      if (roll < 0.3) {
        // Crosshatch beams
        this._fireBeamAttack(true, 3);
        this.scene.time.delayedCall(300, () => {
          if (this.isAlive) this._fireBeamAttack(false, 3);
        });
      } else if (roll < 0.6) {
        // Ring attack (telegraphed)
        this._fireRingAttack();
      } else {
        this._fireBurstAtPlayer(px, py, 12);
      }
    }
  }

  private _fireBeamAttack(horizontal: boolean, count: number): void {
    // Telegraph
    this._telegraphGraphics.clear();
    const positions: number[] = [];

    for (let i = 0; i < count; i++) {
      const pos = 100 + Math.random() * (horizontal ? GAME_HEIGHT - 200 : GAME_WIDTH - 200);
      positions.push(pos);

      // Draw telegraph lines
      this._telegraphGraphics.lineStyle(2, 0xff3333, 0.2);
      this._telegraphGraphics.beginPath();
      if (horizontal) {
        this._telegraphGraphics.moveTo(0, pos);
        this._telegraphGraphics.lineTo(GAME_WIDTH, pos);
      } else {
        this._telegraphGraphics.moveTo(pos, 0);
        this._telegraphGraphics.lineTo(pos, GAME_HEIGHT);
      }
      this._telegraphGraphics.strokePath();
    }

    // Fire beams after telegraph delay
    this.scene.time.delayedCall(500, () => {
      if (!this.isAlive) return;
      this._telegraphGraphics.clear();
      this._beamActive = true;
      this._beamHorizontal = horizontal;
      this._beamPositions = positions;
      this._beamTimer = 800;

      this._beamGraphics.clear();
      for (const pos of positions) {
        this._beamGraphics.lineStyle(8, 0xff3333, 0.7);
        this._beamGraphics.beginPath();
        if (horizontal) {
          this._beamGraphics.moveTo(0, pos);
          this._beamGraphics.lineTo(GAME_WIDTH, pos);
        } else {
          this._beamGraphics.moveTo(pos, 0);
          this._beamGraphics.lineTo(pos, GAME_HEIGHT);
        }
        this._beamGraphics.strokePath();
      }

      this.scene.cameras.main.shake(100, 0.003);
    });
  }

  private _fireBurstAtPlayer(px: number, py: number, count: number): void {
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
    const spread = Phaser.Math.DegToRad(60);
    const step = spread / (count - 1);

    for (let i = 0; i < count; i++) {
      const angle = baseAngle - spread / 2 + step * i;
      const proj = new EnemyProjectile(this.scene, this.x, this.y, angle, 200, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
  }

  private _fireRingAttack(): void {
    // Telegraph
    const cx = this.x;
    const cy = this.y;

    // Draw expanding ring telegraph
    let radius = 0;
    const telegraphTimer = this.scene.time.addEvent({
      delay: 16,
      repeat: 30,
      callback: () => {
        radius += 5;
        this._telegraphGraphics.clear();
        this._telegraphGraphics.lineStyle(2, 0xff3333, 0.15);
        this._telegraphGraphics.strokeCircle(cx, cy, radius);
      },
    });

    this.scene.time.delayedCall(500, () => {
      telegraphTimer.destroy();
      this._telegraphGraphics.clear();
      if (!this.isAlive) return;

      // Fire ring
      const count = 16;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const proj = new EnemyProjectile(this.scene, this.x, this.y, angle, 180, 1);
        this._projectileGroup.add(proj);
      }
      playSFX('enemy_shoot');
    });
  }

  private _doSpawns(delta: number): void {
    const spawnInterval = this.phase === 3 ? 5000 : 10000;
    if (this._spawnTimer < spawnInterval) return;
    this._spawnTimer = 0;

    const spawnType = this.phase >= 2 ? 'signal_ghost' : 'static_mote';
    const count = this.phase === 3 ? 3 : 2;

    for (let i = 0; i < count; i++) {
      this.scene.events.emit('boss-spawn-add', {
        type: spawnType,
        x: 100 + Math.random() * (GAME_WIDTH - 200),
        y: 100 + Math.random() * (GAME_HEIGHT - 200),
      });
    }
  }

  private _drawVignette(): void {
    this._vignetteOverlay.clear();

    // Darken edges — larger vignette as HP decreases
    const intensity = 1 - (this.hp / 30); // 0 at 30hp, 1 at 0hp
    const edgeSize = 40 + intensity * 60;

    this._vignetteOverlay.fillStyle(0x000000, 0.3 + intensity * 0.4);
    // Top
    this._vignetteOverlay.fillRect(0, 0, GAME_WIDTH, edgeSize);
    // Bottom
    this._vignetteOverlay.fillRect(0, GAME_HEIGHT - edgeSize, GAME_WIDTH, edgeSize);
    // Left
    this._vignetteOverlay.fillRect(0, 0, edgeSize, GAME_HEIGHT);
    // Right
    this._vignetteOverlay.fillRect(GAME_WIDTH - edgeSize, 0, edgeSize, GAME_HEIGHT);
  }

  isBeamHitting(px: number, py: number): boolean {
    if (!this._beamActive) return false;

    for (const pos of this._beamPositions) {
      if (this._beamHorizontal) {
        if (Math.abs(py - pos) < 4) return true;
      } else {
        if (Math.abs(px - pos) < 4) return true;
      }
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

    // Background
    this._hpBar.fillStyle(0x1a1a1a, 0.9);
    this._hpBar.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    // Fill
    const fillWidth = (this.hp / this.maxHp) * barWidth;
    const color = this.phase === 3 ? 0xff0000 : this.phase === 2 ? 0xff6633 : 0xff3333;
    this._hpBar.fillStyle(color, 1);
    this._hpBar.fillRect(x, y, fillWidth, barHeight);

    // Name
    this._hpBar.setDepth(100);
  }

  cleanup(): void {
    this._hpBar?.destroy();
    this._noiseGraphics?.destroy();
    this._telegraphGraphics?.destroy();
    this._beamGraphics?.destroy();
    this._vignetteOverlay?.destroy();
  }
}
