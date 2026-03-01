import { Physics, Scene, GameObjects } from 'phaser';
import { EnemyProjectile } from './Enemy';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

type BossPhase = 1 | 2 | 3;

// The void does not have a color. It has the absence of one.
const VOID_COLOR = 0x111111;
const VOID_RED = 0xff0000;
const VOID_DEEP = 0x050505;
const VOID_CORE = 0x220000;

const BASE_RADIUS = 80;
const CENTER_X = GAME_WIDTH / 2;
const CENTER_Y = GAME_HEIGHT / 2;

// Gravity well state
interface GravityWell {
  x: number;
  y: number;
  radius: number;
  pullStrength: number;
  angle: number;       // orbit angle around boss
  orbitRadius: number;
  alive: boolean;
  pulsePhase: number;
}

export class BossSignalZero {
  hp: number;
  maxHp: number;
  private _alive = true;

  private _scene: Scene;
  private _projectileGroup: Physics.Arcade.Group;
  private _phase: BossPhase = 1;
  private _phaseTransitioning = false;

  // Position
  private _cx: number;
  private _cy: number;

  // Movement
  private _moveTimer = 0;
  private _moveAngle = Math.random() * Math.PI * 2;

  // Timers
  private _ringTimer = 0;
  private _aimedTimer = 0;
  private _spawnTimer = 0;
  private _pulsePhase = 0;

  // Gravity wells (phase 1+)
  private _gravityWells: GravityWell[] = [];
  private _wellOrbitAngle = 0;

  // Phase 2: darkness overlay
  private _darknessAlpha = 0;

  // Phase 2: sweep beam
  private _sweepBeamAngle = 0;
  private _sweepBeamActive = false;
  private _sweepBeamEndX = 0;
  private _sweepBeamEndY = 0;

  // Phase 3: arena collapse
  private _arenaCollapseInset = 0; // px inward from each edge
  private _playerPullStrength = 0;

  // Phase 3: noise overlay
  private _noiseTimer = 0;

  // Graphics layers
  private _voidGraphics: GameObjects.Graphics;      // boss body
  private _wellGraphics: GameObjects.Graphics;       // gravity wells
  private _beamGraphics: GameObjects.Graphics;       // sweep beam
  private _overlayGraphics: GameObjects.Graphics;    // darkness / arena collapse / noise
  private _hpBar: GameObjects.Graphics;

  constructor(scene: Scene, x: number, y: number, projectileGroup: Physics.Arcade.Group) {
    this._scene = scene;
    this._cx = x;
    this._cy = y;
    this._projectileGroup = projectileGroup;

    this.maxHp = 200;
    this.hp = 200;

    this._voidGraphics = scene.add.graphics();
    this._wellGraphics = scene.add.graphics();
    this._beamGraphics = scene.add.graphics();
    this._overlayGraphics = scene.add.graphics();
    this._hpBar = scene.add.graphics();

    this._voidGraphics.setDepth(10);
    this._wellGraphics.setDepth(9);
    this._beamGraphics.setDepth(8);
    this._overlayGraphics.setDepth(90);
    this._hpBar.setDepth(100);

    // Spawn initial gravity wells
    this._spawnGravityWells(2);

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
    this._voidGraphics.clear();
    if (!this._alive) return;

    const time = Date.now();
    const breathe = 1 + Math.sin(this._pulsePhase) * 0.05;
    const r = BASE_RADIUS * breathe;

    // Gravitational distortion rings - concentric warping halos
    const distortionRings = this._phase === 3 ? 8 : this._phase === 2 ? 6 : 4;
    for (let i = distortionRings; i >= 1; i--) {
      const ringR = r + i * 14;
      const wobble = Math.sin(time * 0.002 + i * 0.7) * 3;
      const alpha = 0.02 + (i / distortionRings) * 0.03;
      this._voidGraphics.lineStyle(2, VOID_RED, alpha);
      this._voidGraphics.strokeCircle(this._cx + wobble, this._cy - wobble * 0.5, ringR);
    }

    // Outer absorption glow - light being pulled in
    for (let i = 5; i >= 1; i--) {
      const glowR = r + i * 8;
      const alpha = 0.06 - i * 0.008;
      this._voidGraphics.fillStyle(VOID_DEEP, alpha);
      this._voidGraphics.fillCircle(this._cx, this._cy, glowR);
    }

    // Main void body - the abyss
    this._voidGraphics.fillStyle(VOID_COLOR, 1);
    this._voidGraphics.fillCircle(this._cx, this._cy, r);

    // Inner darkness gradient - darker than dark
    this._voidGraphics.fillStyle(0x000000, 0.8);
    this._voidGraphics.fillCircle(this._cx, this._cy, r * 0.75);

    this._voidGraphics.fillStyle(0x000000, 0.95);
    this._voidGraphics.fillCircle(this._cx, this._cy, r * 0.5);

    // The absolute center: pure void
    this._voidGraphics.fillStyle(0x000000, 1);
    this._voidGraphics.fillCircle(this._cx, this._cy, r * 0.25);

    // Red outline - the event horizon, pulsing with malice
    const outlineAlpha = 0.6 + Math.sin(this._pulsePhase * 2) * 0.3;
    const outlineWidth = this._phase === 3 ? 4 : this._phase === 2 ? 3 : 2;
    this._voidGraphics.lineStyle(outlineWidth, VOID_RED, outlineAlpha);
    this._voidGraphics.strokeCircle(this._cx, this._cy, r);

    // Phase 2+: secondary red outline
    if (this._phase >= 2) {
      const secondaryAlpha = 0.3 + Math.sin(this._pulsePhase * 1.5 + 1) * 0.2;
      this._voidGraphics.lineStyle(1, VOID_RED, secondaryAlpha);
      this._voidGraphics.strokeCircle(this._cx, this._cy, r * 1.15);
    }

    // Phase 3: flickering red core cracks
    if (this._phase === 3) {
      const crackCount = 6;
      for (let i = 0; i < crackCount; i++) {
        const crackAngle = (Math.PI * 2 * i) / crackCount + this._pulsePhase * 0.3;
        const crackLen = r * (0.3 + Math.sin(time * 0.005 + i) * 0.15);
        const crackAlpha = 0.3 + Math.sin(time * 0.008 + i * 2) * 0.2;
        this._voidGraphics.lineStyle(2, VOID_RED, crackAlpha);
        this._voidGraphics.beginPath();
        this._voidGraphics.moveTo(this._cx, this._cy);
        this._voidGraphics.lineTo(
          this._cx + Math.cos(crackAngle) * crackLen,
          this._cy + Math.sin(crackAngle) * crackLen,
        );
        this._voidGraphics.strokePath();
      }
    }

    // Static noise specks inside the void (it consumes signal)
    const noiseCount = this._phase === 3 ? 30 : this._phase === 2 ? 20 : 12;
    for (let i = 0; i < noiseCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * r * 0.85;
      const nx = this._cx + Math.cos(angle) * dist;
      const ny = this._cy + Math.sin(angle) * dist;
      const brightness = Math.random() * 0.15;
      this._voidGraphics.fillStyle(
        Phaser.Display.Color.GetColor(brightness * 255, 0, 0),
        0.3 + Math.random() * 0.3,
      );
      this._voidGraphics.fillRect(nx, ny, 2, 2);
    }
  }

  private _drawGravityWells(): void {
    this._wellGraphics.clear();
    if (!this._alive) return;

    for (const well of this._gravityWells) {
      if (!well.alive) continue;

      const pulse = 1 + Math.sin(well.pulsePhase) * 0.12;
      const wr = well.radius * pulse;

      // Gravitational pull indicator - concentric rings being sucked in
      for (let i = 3; i >= 1; i--) {
        const ringR = wr + i * 10 + Math.sin(well.pulsePhase * 2 + i) * 3;
        this._wellGraphics.lineStyle(1, VOID_RED, 0.08 * i);
        this._wellGraphics.strokeCircle(well.x, well.y, ringR);
      }

      // Well body
      this._wellGraphics.fillStyle(VOID_COLOR, 0.9);
      this._wellGraphics.fillCircle(well.x, well.y, wr);

      // Dark core
      this._wellGraphics.fillStyle(0x000000, 0.9);
      this._wellGraphics.fillCircle(well.x, well.y, wr * 0.5);

      // Red outline
      const alpha = 0.4 + Math.sin(well.pulsePhase * 3) * 0.2;
      this._wellGraphics.lineStyle(2, VOID_RED, alpha);
      this._wellGraphics.strokeCircle(well.x, well.y, wr);
    }
  }

  private _drawSweepBeam(): void {
    this._beamGraphics.clear();
    if (!this._alive || !this._sweepBeamActive) return;

    const beamLength = Math.max(GAME_WIDTH, GAME_HEIGHT) * 1.5;
    this._sweepBeamEndX = this._cx + Math.cos(this._sweepBeamAngle) * beamLength;
    this._sweepBeamEndY = this._cy + Math.sin(this._sweepBeamAngle) * beamLength;

    // Void beam - a spotlight from the abyss
    // Outer glow (dark, wide)
    this._beamGraphics.lineStyle(20, VOID_COLOR, 0.3);
    this._beamGraphics.beginPath();
    this._beamGraphics.moveTo(this._cx, this._cy);
    this._beamGraphics.lineTo(this._sweepBeamEndX, this._sweepBeamEndY);
    this._beamGraphics.strokePath();

    // Main beam (red, medium)
    this._beamGraphics.lineStyle(8, VOID_RED, 0.5);
    this._beamGraphics.beginPath();
    this._beamGraphics.moveTo(this._cx, this._cy);
    this._beamGraphics.lineTo(this._sweepBeamEndX, this._sweepBeamEndY);
    this._beamGraphics.strokePath();

    // Core (bright, thin)
    this._beamGraphics.lineStyle(3, 0xff4444, 0.7);
    this._beamGraphics.beginPath();
    this._beamGraphics.moveTo(this._cx, this._cy);
    this._beamGraphics.lineTo(this._sweepBeamEndX, this._sweepBeamEndY);
    this._beamGraphics.strokePath();
  }

  private _drawOverlays(): void {
    this._overlayGraphics.clear();
    if (!this._alive) return;

    // Phase 2+: darkness overlay (boss absorbing screen brightness)
    if (this._phase >= 2 && this._darknessAlpha > 0) {
      this._overlayGraphics.fillStyle(0x000000, this._darknessAlpha);
      this._overlayGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Phase 3: arena collapse (closing walls)
    if (this._phase === 3 && this._arenaCollapseInset > 0) {
      const inset = this._arenaCollapseInset;
      const wallAlpha = 0.85;

      // Draw closing walls as thick dark borders
      this._overlayGraphics.fillStyle(0x000000, wallAlpha);
      // Top
      this._overlayGraphics.fillRect(0, 0, GAME_WIDTH, inset);
      // Bottom
      this._overlayGraphics.fillRect(0, GAME_HEIGHT - inset, GAME_WIDTH, inset);
      // Left
      this._overlayGraphics.fillRect(0, 0, inset, GAME_HEIGHT);
      // Right
      this._overlayGraphics.fillRect(GAME_WIDTH - inset, 0, inset, GAME_HEIGHT);

      // Red edges on the closing walls
      this._overlayGraphics.lineStyle(2, VOID_RED, 0.6);
      // Top edge
      this._overlayGraphics.beginPath();
      this._overlayGraphics.moveTo(0, inset);
      this._overlayGraphics.lineTo(GAME_WIDTH, inset);
      this._overlayGraphics.strokePath();
      // Bottom edge
      this._overlayGraphics.beginPath();
      this._overlayGraphics.moveTo(0, GAME_HEIGHT - inset);
      this._overlayGraphics.lineTo(GAME_WIDTH, GAME_HEIGHT - inset);
      this._overlayGraphics.strokePath();
      // Left edge
      this._overlayGraphics.beginPath();
      this._overlayGraphics.moveTo(inset, 0);
      this._overlayGraphics.lineTo(inset, GAME_HEIGHT);
      this._overlayGraphics.strokePath();
      // Right edge
      this._overlayGraphics.beginPath();
      this._overlayGraphics.moveTo(GAME_WIDTH - inset, 0);
      this._overlayGraphics.lineTo(GAME_WIDTH - inset, GAME_HEIGHT);
      this._overlayGraphics.strokePath();
    }

    // Phase 3: static noise overlay (total signal degradation)
    if (this._phase === 3) {
      const noiseIntensity = 1 - (this.hp / (this.maxHp * 0.3));
      const noiseCount = Math.floor(20 + noiseIntensity * 60);
      for (let i = 0; i < noiseCount; i++) {
        const nx = Math.random() * GAME_WIDTH;
        const ny = Math.random() * GAME_HEIGHT;
        const brightness = Math.random() * 0.1;
        this._overlayGraphics.fillStyle(
          Phaser.Display.Color.GetColor(brightness * 255, brightness * 255, brightness * 255),
          0.1 + Math.random() * 0.15,
        );
        this._overlayGraphics.fillRect(nx, ny, 3 + Math.random() * 5, 1 + Math.random() * 3);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Gravity Wells
  // ---------------------------------------------------------------------------

  private _spawnGravityWells(count: number): void {
    this._gravityWells = [];
    for (let i = 0; i < count; i++) {
      this._gravityWells.push({
        x: this._cx,
        y: this._cy,
        radius: 25,
        pullStrength: 30,
        angle: (Math.PI * 2 * i) / count,
        orbitRadius: 150,
        alive: true,
        pulsePhase: i * Math.PI,
      });
    }
  }

  private _updateGravityWells(playerX: number, playerY: number, delta: number): { pullX: number; pullY: number } {
    let totalPullX = 0;
    let totalPullY = 0;

    this._wellOrbitAngle += 0.0008 * delta;

    for (const well of this._gravityWells) {
      if (!well.alive) continue;

      well.pulsePhase += 0.004 * delta;

      // Orbit around boss
      well.angle += 0.0005 * delta;
      well.x = this._cx + Math.cos(well.angle + this._wellOrbitAngle) * well.orbitRadius;
      well.y = this._cy + Math.sin(well.angle + this._wellOrbitAngle) * well.orbitRadius;

      // Clamp to arena
      well.x = Phaser.Math.Clamp(well.x, 100, GAME_WIDTH - 100);
      well.y = Phaser.Math.Clamp(well.y, 80, GAME_HEIGHT - 80);

      // Calculate gravitational pull on player
      const dx = well.x - playerX;
      const dy = well.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 20 && dist < 250) {
        const force = well.pullStrength / Math.max(dist * 0.5, 1);
        totalPullX += (dx / dist) * force;
        totalPullY += (dy / dist) * force;
      }
    }

    return { pullX: totalPullX, pullY: totalPullY };
  }

  // ---------------------------------------------------------------------------
  // Damage / Phase transitions
  // ---------------------------------------------------------------------------

  takeDamage(amount: number): boolean {
    if (!this._alive || this._phaseTransitioning) return false;

    this.hp -= amount;
    playSFX('boss_hit');
    this._scene.cameras.main.shake(80, 0.004);

    // Phase transitions at 60% and 30%
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

    this._scene.cameras.main.shake(400, 0.012);
    this._scene.cameras.main.flash(300, 80, 0, 0, false);

    this._scene.events.emit('boss-phase-transition');

    if (newPhase === 2) {
      // Move boss to center and begin absorption
      this._scene.tweens.add({
        targets: { x: this._cx, y: this._cy },
        x: CENTER_X,
        y: CENTER_Y,
        duration: 800,
        ease: 'Quad.easeInOut',
        onUpdate: (_tween: Phaser.Tweens.Tween, target: { x: number; y: number }) => {
          this._cx = target.x;
          this._cy = target.y;
        },
      });

      // Begin darkness absorption
      this._scene.tweens.add({
        targets: this,
        _darknessAlpha: 0.25,
        duration: 2000,
        ease: 'Quad.easeIn',
      });

      // Activate sweep beam
      this._sweepBeamActive = true;
      this._sweepBeamAngle = 0;

      // Upgrade gravity wells
      for (const well of this._gravityWells) {
        well.pullStrength = 40;
        well.orbitRadius = 180;
      }
    } else if (newPhase === 3) {
      // Begin arena collapse
      this._scene.tweens.add({
        targets: this,
        _arenaCollapseInset: 60,
        duration: 5000,
        ease: 'Sine.easeInOut',
      });

      // Deepen darkness
      this._scene.tweens.add({
        targets: this,
        _darknessAlpha: 0.4,
        duration: 3000,
        ease: 'Quad.easeIn',
      });

      // Constant player pull toward boss
      this._playerPullStrength = 15;

      // More aggressive gravity wells
      this._spawnGravityWells(3);
      for (const well of this._gravityWells) {
        well.pullStrength = 55;
        well.orbitRadius = 130;
      }
    }

    const phaseColor = newPhase === 3 ? '#ff0000' : '#880000';
    const text = this._scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2,
      newPhase === 2 ? 'HUD ABSORPTION' : 'ARENA COLLAPSE',
      {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: phaseColor,
      },
    ).setOrigin(0.5).setDepth(100);

    this._scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: 2000,
      onComplete: () => text.destroy(),
    });

    this._scene.time.delayedCall(1200, () => {
      this._phaseTransitioning = false;
    });
  }

  // ---------------------------------------------------------------------------
  // Death Sequence
  // ---------------------------------------------------------------------------

  private _die(): void {
    this._alive = false;
    playSFX('boss_death');

    // Disable active effects
    this._sweepBeamActive = false;
    this._beamGraphics.clear();
    this._wellGraphics.clear();

    // ---------- Phase 1 (0-1500ms): Boss freezes, screen goes to near-black ----------
    // All light drains from the screen
    const blackout = { alpha: this._darknessAlpha };
    this._scene.tweens.add({
      targets: blackout,
      alpha: 0.92,
      duration: 1500,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        this._overlayGraphics.clear();
        this._overlayGraphics.fillStyle(0x000000, blackout.alpha);
        this._overlayGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      },
    });

    // Boss body shrinks and pulses rapidly
    const deathPulse = { phase: 0, scale: 1.0 };
    const pulseEvent = this._scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!this._scene) return;
        deathPulse.phase += 0.4;
        const r = BASE_RADIUS * deathPulse.scale * (1 + Math.sin(deathPulse.phase) * 0.15);

        this._voidGraphics.clear();
        // Flickering void body
        this._voidGraphics.fillStyle(VOID_COLOR, 0.8);
        this._voidGraphics.fillCircle(this._cx, this._cy, r);
        this._voidGraphics.fillStyle(0x000000, 0.9);
        this._voidGraphics.fillCircle(this._cx, this._cy, r * 0.6);
        // Red cracks intensify
        const crackCount = 8;
        for (let i = 0; i < crackCount; i++) {
          const crackAngle = (Math.PI * 2 * i) / crackCount + deathPulse.phase * 0.5;
          const crackLen = r * (0.5 + Math.random() * 0.4);
          this._voidGraphics.lineStyle(2 + Math.random() * 2, VOID_RED, 0.5 + Math.random() * 0.4);
          this._voidGraphics.beginPath();
          this._voidGraphics.moveTo(this._cx, this._cy);
          this._voidGraphics.lineTo(
            this._cx + Math.cos(crackAngle) * crackLen,
            this._cy + Math.sin(crackAngle) * crackLen,
          );
          this._voidGraphics.strokePath();
        }
      },
    });

    // Shrink boss over 1.5s
    this._scene.tweens.add({
      targets: deathPulse,
      scale: 0.1,
      duration: 1500,
      ease: 'Quad.easeIn',
    });

    // Low rumble: camera shake builds
    this._scene.cameras.main.shake(1500, 0.005);

    // ---------- Phase 2 (1500-2200ms): Single white line expands from center ----------
    // Like a CRT turning ON from off — a horizontal line of light splits the void
    this._scene.time.delayedCall(1500, () => {
      if (!this._scene) return;
      pulseEvent.destroy();
      this._voidGraphics.clear();

      // The line
      const lineState = { width: GAME_WIDTH, height: 1, alpha: 1.0 };

      const lineEvent = this._scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (!this._scene) return;
          this._voidGraphics.clear();

          // Draw the expanding white line over the blackout
          this._voidGraphics.fillStyle(0xffffff, lineState.alpha);
          this._voidGraphics.fillRect(
            CENTER_X - lineState.width / 2,
            CENTER_Y - lineState.height / 2,
            lineState.width,
            lineState.height,
          );

          // Red glow around the line
          if (lineState.height > 2) {
            this._voidGraphics.fillStyle(VOID_RED, lineState.alpha * 0.3);
            this._voidGraphics.fillRect(
              CENTER_X - lineState.width / 2,
              CENTER_Y - lineState.height / 2 - 4,
              lineState.width,
              lineState.height + 8,
            );
          }
        },
      });

      // Line expands vertically from a slit to fill the screen
      this._scene.tweens.add({
        targets: lineState,
        height: GAME_HEIGHT + 40,
        duration: 700,
        ease: 'Expo.easeIn',
        onComplete: () => {
          lineEvent.destroy();
        },
      });

      // Small camera judder as the line expands
      this._scene.cameras.main.shake(700, 0.008);
    });

    // ---------- Phase 3 (2200-2600ms): Flash to blinding white ----------
    this._scene.time.delayedCall(2200, () => {
      if (!this._scene) return;

      // Full white flash
      this._scene.cameras.main.flash(600, 255, 255, 255, false);

      // Strong camera shake at the moment of annihilation
      this._scene.cameras.main.shake(600, 0.025);

      // Massive particle burst: the void shatters
      for (let wave = 0; wave < 4; wave++) {
        this._scene.time.delayedCall(wave * 100, () => {
          if (!this._scene) return;
          const ringCount = 8;
          const radius = 30 + wave * 40;
          for (let i = 0; i < ringCount; i++) {
            const angle = (Math.PI * 2 * i) / ringCount + wave * 0.3;
            emitBurst(
              this._scene,
              this._cx + Math.cos(angle) * radius,
              this._cy + Math.sin(angle) * radius,
              { ...createDeathBurstConfig(), quantity: 20, tint: VOID_RED },
            );
          }
        });
      }

      // White particle burst at center
      emitBurst(
        this._scene,
        this._cx,
        this._cy,
        { ...createDeathBurstConfig(), quantity: 50, tint: 0xffffff },
      );
    });

    // ---------- Cleanup (3000ms): Signal restored ----------
    this._scene.time.delayedCall(3000, () => {
      if (!this._scene) return;

      this._voidGraphics.clear();
      this._wellGraphics.clear();
      this._beamGraphics.clear();
      this._overlayGraphics.clear();
      this._hpBar.clear();

      this._scene.events.emit('boss-defeated');
    });
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  update(playerX: number, playerY: number, delta: number): void {
    if (!this._alive || this._phaseTransitioning) return;

    this._ringTimer += delta;
    this._aimedTimer += delta;
    this._spawnTimer += delta;
    this._pulsePhase += 0.003 * delta;

    if (this._phase === 1) {
      this._updatePhase1(playerX, playerY, delta);
    } else if (this._phase === 2) {
      this._updatePhase2(playerX, playerY, delta);
    } else {
      this._updatePhase3(playerX, playerY, delta);
    }

    // Update gravity wells (all phases)
    this._updateGravityWells(playerX, playerY, delta);

    this._doSpawns();
    this._drawBody();
    this._drawGravityWells();
    this._drawSweepBeam();
    this._drawOverlays();
    this._updateHPBar();
  }

  // --- Phase 1: Gravity Wells ---
  private _updatePhase1(playerX: number, playerY: number, delta: number): void {
    // Slow drift toward player
    this._moveTimer += delta;
    if (this._moveTimer > 3000) {
      this._moveAngle = Phaser.Math.Angle.Between(this._cx, this._cy, playerX, playerY);
      // Add some randomness
      this._moveAngle += (Math.random() - 0.5) * 0.6;
      this._moveTimer = 0;
    }

    const driftSpeed = 20;
    this._cx += Math.cos(this._moveAngle) * driftSpeed * (delta / 1000);
    this._cy += Math.sin(this._moveAngle) * driftSpeed * (delta / 1000);
    this._cx = Phaser.Math.Clamp(this._cx, 150, GAME_WIDTH - 150);
    this._cy = Phaser.Math.Clamp(this._cy, 120, GAME_HEIGHT - 120);

    // Ring attack: 8 projectiles every 3s
    if (this._ringTimer >= 3000) {
      this._ringTimer = 0;
      this._fireRing(8, 140);
    }
  }

  // --- Phase 2: HUD Absorption ---
  private _updatePhase2(playerX: number, playerY: number, delta: number): void {
    // Boss stays near center, slight drift
    const toCenterX = CENTER_X - this._cx;
    const toCenterY = CENTER_Y - this._cy;
    this._cx += toCenterX * 0.001 * delta;
    this._cy += toCenterY * 0.001 * delta;

    // Aimed triple-shot every 2s
    if (this._aimedTimer >= 2000) {
      this._aimedTimer = 0;
      this._fireAimedTriple(playerX, playerY);
    }

    // Ring attack: 12 projectiles every 4s
    if (this._ringTimer >= 4000) {
      this._ringTimer = 0;
      this._fireRing(12, 160);
    }

    // Sweep beam: slowly tracks player
    if (this._sweepBeamActive) {
      this._updateSweepBeam(playerX, playerY, delta);
    }
  }

  // --- Phase 3: Arena Collapse ---
  private _updatePhase3(playerX: number, playerY: number, delta: number): void {
    // Boss stays center but vibrates with rage
    this._cx = CENTER_X + (Math.random() - 0.5) * 6;
    this._cy = CENTER_Y + (Math.random() - 0.5) * 6;

    // Aimed bursts every 1.5s
    if (this._aimedTimer >= 1500) {
      this._aimedTimer = 0;
      this._fireAimedTriple(playerX, playerY);
    }

    // Ring attack: 16 projectiles every 2.5s
    if (this._ringTimer >= 2500) {
      this._ringTimer = 0;
      this._fireRing(16, 180);
    }

    // Sweep beam continues
    if (this._sweepBeamActive) {
      this._updateSweepBeam(playerX, playerY, delta);
    }

    // Noise overlay flicker
    this._noiseTimer += delta;
  }

  // ---------------------------------------------------------------------------
  // Sweep Beam
  // ---------------------------------------------------------------------------

  private _updateSweepBeam(playerX: number, playerY: number, delta: number): void {
    // Slowly track player direction
    const targetAngle = Phaser.Math.Angle.Between(this._cx, this._cy, playerX, playerY);
    const turnSpeed = this._phase === 3 ? 1.0 : 0.6; // radians per second
    const angleDiff = Phaser.Math.Angle.Wrap(targetAngle - this._sweepBeamAngle);

    if (Math.abs(angleDiff) < turnSpeed * (delta / 1000)) {
      this._sweepBeamAngle = targetAngle;
    } else {
      this._sweepBeamAngle += Math.sign(angleDiff) * turnSpeed * (delta / 1000);
    }

    this._sweepBeamAngle = Phaser.Math.Angle.Wrap(this._sweepBeamAngle);
  }

  // ---------------------------------------------------------------------------
  // Attacks
  // ---------------------------------------------------------------------------

  private _fireRing(count: number, speed: number): void {
    const angleOffset = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = angleOffset + (Math.PI * 2 * i) / count;
      const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, speed, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
    this._scene.cameras.main.flash(40, 80, 0, 0, false);
  }

  private _fireAimedTriple(playerX: number, playerY: number): void {
    const baseAngle = Phaser.Math.Angle.Between(this._cx, this._cy, playerX, playerY);
    const spread = Phaser.Math.DegToRad(20);

    for (let i = 0; i < 3; i++) {
      const angle = baseAngle - spread + spread * i;
      const speed = this._phase === 3 ? 220 : 190;
      const proj = new EnemyProjectile(this._scene, this._cx, this._cy, angle, speed, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
  }

  // ---------------------------------------------------------------------------
  // Spawns
  // ---------------------------------------------------------------------------

  private _doSpawns(): void {
    let spawnInterval: number;
    let spawnType: string;

    if (this._phase === 1) {
      spawnInterval = 6000;
      spawnType = 'static_mote';
    } else if (this._phase === 2) {
      spawnInterval = 7000;
      spawnType = 'signal_ghost';
    } else {
      spawnInterval = 8000;
      spawnType = 'bar_sentinel';
    }

    if (this._spawnTimer < spawnInterval) return;
    this._spawnTimer = 0;

    // Spawn within arena bounds (accounting for collapse in phase 3)
    const inset = this._arenaCollapseInset + 100;
    const count = this._phase === 3 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      this._scene.events.emit('boss-spawn-add', {
        type: spawnType,
        x: inset + Math.random() * (GAME_WIDTH - inset * 2),
        y: inset + Math.random() * (GAME_HEIGHT - inset * 2),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Beam Hit Detection (sweep beam)
  // ---------------------------------------------------------------------------

  isBeamHitting(px: number, py: number): boolean {
    if (!this._sweepBeamActive || this._phase < 2) return false;

    // Calculate distance from point to beam line
    const beamLength = Math.max(GAME_WIDTH, GAME_HEIGHT) * 1.5;
    const dx = Math.cos(this._sweepBeamAngle) * beamLength;
    const dy = Math.sin(this._sweepBeamAngle) * beamLength;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return false;

    // Parameter along the beam line
    const t = ((px - this._cx) * dx + (py - this._cy) * dy) / (len * len);
    if (t < 0) return false; // Behind the boss

    const closestX = this._cx + t * dx;
    const closestY = this._cy + t * dy;
    const dist = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);

    return dist < 14; // Beam hit radius
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

    // Background
    this._hpBar.fillStyle(0x1a1a1a, 0.9);
    this._hpBar.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    // Fill
    const fillWidth = (this.hp / this.maxHp) * barWidth;
    const color = this._phase === 3 ? VOID_RED : this._phase === 2 ? 0x880000 : VOID_COLOR;
    this._hpBar.fillStyle(color, 1);
    this._hpBar.fillRect(x, y, fillWidth, barHeight);

    // Red accent line at the top of the HP bar
    this._hpBar.fillStyle(VOID_RED, 0.6);
    this._hpBar.fillRect(x, y, fillWidth, 1);

    this._hpBar.setDepth(100);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  cleanup(): void {
    this._voidGraphics?.destroy();
    this._wellGraphics?.destroy();
    this._beamGraphics?.destroy();
    this._overlayGraphics?.destroy();
    this._hpBar?.destroy();
  }
}
