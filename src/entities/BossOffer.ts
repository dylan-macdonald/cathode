import { Physics, Scene, GameObjects } from 'phaser';
import { EnemyProjectile } from './Enemy';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

type BossPhase = 1 | 2 | 3;

// HP allocation out of 110 total
const HP_STAR = 36;
const HP_CIRCLE = 32;
const HP_RECT = 32;

const COLOR_STAR = 0xffcc33;
const COLOR_CIRCLE = 0xff8800;
const COLOR_RECT = 0x33ff33;

interface Piece {
  id: 'star' | 'circle' | 'rect';
  hp: number;
  maxHp: number;
  alive: boolean;
  color: number;
  // Position on orbit
  orbitAngle: number;
  orbitRadius: number;
  // Current draw position
  x: number;
  y: number;
  // Attack timers
  attackTimer: number;
  attackCooldown: number;
  // Speed multiplier (increases as pieces die)
  speedMult: number;
  // Frenzy (last piece alive)
  frenzy: boolean;
  frenzyTimer: number;
}

export class BossOffer {
  hp: number;
  maxHp: number;
  isAlive = true;

  private _scene: Scene;
  private _projectileGroup: Physics.Arcade.Group;
  private _phase: BossPhase = 1;
  private _phaseTransitioning = false;

  // Shared center point that drifts
  private _cx: number;
  private _cy: number;
  private _driftVx = 0;
  private _driftVy = 0;
  private _driftTimer = 0;
  private _driftAngle = Math.random() * Math.PI * 2;

  // Orbit speed
  private _orbitAngle = 0;
  private _baseOrbitSpeed = 0.001; // radians per ms

  // Pieces
  private _pieces: Piece[];

  // Spawn timer
  private _spawnTimer = 0;

  // Graphics
  private _bodyGraphics: GameObjects.Graphics;
  private _hpBar: GameObjects.Graphics;

  constructor(scene: Scene, x: number, y: number, projectileGroup: Physics.Arcade.Group) {
    this._scene = scene;
    this._cx = x;
    this._cy = y;
    this._projectileGroup = projectileGroup;

    this.maxHp = HP_STAR + HP_CIRCLE + HP_RECT; // 110
    this.hp = this.maxHp;

    this._bodyGraphics = scene.add.graphics();
    this._hpBar = scene.add.graphics();
    this._bodyGraphics.setDepth(10);
    this._hpBar.setDepth(100);

    // Initialize pieces
    this._pieces = [
      {
        id: 'star',
        hp: HP_STAR,
        maxHp: HP_STAR,
        alive: true,
        color: COLOR_STAR,
        orbitAngle: 0,
        orbitRadius: 110,
        x: x,
        y: y,
        attackTimer: 1000 + Math.random() * 500,
        attackCooldown: 2500,
        speedMult: 1,
        frenzy: false,
        frenzyTimer: 0,
      },
      {
        id: 'circle',
        hp: HP_CIRCLE,
        maxHp: HP_CIRCLE,
        alive: true,
        color: COLOR_CIRCLE,
        orbitAngle: (Math.PI * 2) / 3,
        orbitRadius: 110,
        x: x,
        y: y,
        attackTimer: 1500 + Math.random() * 500,
        attackCooldown: 2800,
        speedMult: 1,
        frenzy: false,
        frenzyTimer: 0,
      },
      {
        id: 'rect',
        hp: HP_RECT,
        maxHp: HP_RECT,
        alive: true,
        color: COLOR_RECT,
        orbitAngle: (Math.PI * 4) / 3,
        orbitRadius: 110,
        x: x,
        y: y,
        attackTimer: 2000 + Math.random() * 500,
        attackCooldown: 3000,
        speedMult: 1,
        frenzy: false,
        frenzyTimer: 0,
      },
    ];

    this._updateHPBar();
    this._drawPieces();
  }

  private _drawStar(gfx: GameObjects.Graphics, cx: number, cy: number, outerR: number, color: number, alpha = 1): void {
    const innerR = outerR * 0.45;
    const points = 5;
    gfx.fillStyle(color, alpha);
    gfx.beginPath();

    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      if (i === 0) {
        gfx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      } else {
        gfx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      }
    }

    gfx.closePath();
    gfx.fillPath();

    // Bright center
    gfx.fillStyle(0xffffff, 0.3 * alpha);
    gfx.fillCircle(cx, cy, outerR * 0.2);
  }

  private _drawPieces(): void {
    this._bodyGraphics.clear();
    if (!this.isAlive) return;

    for (const piece of this._pieces) {
      if (!piece.alive) continue;

      const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.06;

      if (piece.id === 'star') {
        this._drawStar(this._bodyGraphics, piece.x, piece.y, 28 * pulse, piece.color);
        // Glow ring
        this._bodyGraphics.lineStyle(2, piece.color, 0.3);
        this._bodyGraphics.strokeCircle(piece.x, piece.y, 36 * pulse);
      } else if (piece.id === 'circle') {
        this._bodyGraphics.fillStyle(piece.color, 1);
        this._bodyGraphics.fillCircle(piece.x, piece.y, 24 * pulse);
        // Bright core
        this._bodyGraphics.fillStyle(0xffffff, 0.35);
        this._bodyGraphics.fillCircle(piece.x, piece.y, 10);
        // Outer glow ring
        this._bodyGraphics.lineStyle(2, piece.color, 0.35);
        this._bodyGraphics.strokeCircle(piece.x, piece.y, 34 * pulse);
      } else {
        // Rectangle
        const hw = 30 * pulse;
        const hh = 22 * pulse;
        this._bodyGraphics.fillStyle(piece.color, 1);
        this._bodyGraphics.fillRect(piece.x - hw, piece.y - hh, hw * 2, hh * 2);
        // Bright edge
        this._bodyGraphics.lineStyle(2, 0xffffff, 0.3);
        this._bodyGraphics.strokeRect(piece.x - hw, piece.y - hh, hw * 2, hh * 2);
      }
    }
  }

  takeDamage(amount: number): boolean {
    if (!this.isAlive || this._phaseTransitioning) return false;

    // Damage the piece closest to center of the group or pick randomly
    // Use weighted random: alive pieces
    const alivePieces = this._pieces.filter(p => p.alive);
    if (alivePieces.length === 0) return false;

    // Distribute damage evenly among alive pieces (split damage)
    const target = alivePieces[Math.floor(Math.random() * alivePieces.length)];
    target.hp -= amount;
    playSFX('boss_hit');
    this._scene.cameras.main.shake(80, 0.004);

    if (target.hp <= 0) {
      target.hp = 0;
      this._killPiece(target);
    }

    // Recalculate total HP
    this.hp = this._pieces.reduce((sum, p) => sum + Math.max(0, p.hp), 0);

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

  private _killPiece(piece: Piece): void {
    piece.alive = false;

    playSFX('enemy_death_large');
    this._scene.cameras.main.flash(150, 255, 255, 255, false);
    this._scene.cameras.main.shake(200, 0.007);

    emitBurst(
      this._scene,
      piece.x,
      piece.y,
      { ...createDeathBurstConfig(), quantity: 25 },
    );

    // Remaining alive pieces speed up
    const alivePieces = this._pieces.filter(p => p.alive);
    for (const p of alivePieces) {
      p.speedMult *= 1.5;
      p.attackCooldown = Math.max(p.attackCooldown * 0.67, 800);

      // If only 1 left, trigger frenzy
      if (alivePieces.length === 1) {
        p.frenzy = true;
        p.attackCooldown = Math.max(p.attackCooldown * 0.5, 400);
      }
    }

    // Shrink orbit radius for remaining pieces
    const orbitR = alivePieces.length === 1 ? 80 : alivePieces.length === 2 ? 95 : 110;
    for (const p of alivePieces) {
      p.orbitRadius = orbitR;
    }
  }

  private _transitionPhase(newPhase: BossPhase): void {
    this._phaseTransitioning = true;
    this._phase = newPhase;
    playSFX('boss_phase');

    this._scene.cameras.main.shake(300, 0.008);
    this._scene.cameras.main.flash(200, 255, 200, 50, false);

    // Notify GameScene for CRT aberration pulse
    this._scene.events.emit('boss-phase-transition');

    const text = this._scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, `PHASE ${newPhase}`, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffcc33',
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

    // Phase 1 (0-1800ms): Remaining pieces spin faster and faster, shrinking
    const alivePieces = this._pieces.filter(p => p.alive);
    const spinAccel = { speed: this._baseOrbitSpeed, shrink: 1.0 };

    const spinEvent = this._scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!this._scene) return;
        this._orbitAngle += spinAccel.speed * 16;

        for (const piece of alivePieces) {
          const angle = piece.orbitAngle + this._orbitAngle * piece.speedMult;
          const radius = piece.orbitRadius * spinAccel.shrink;
          piece.x = this._cx + Math.cos(angle) * radius;
          piece.y = this._cy + Math.sin(angle) * radius;
        }

        this._drawPieces();
      },
    });

    // Accelerate spin and shrink radius
    this._scene.tweens.add({
      targets: spinAccel,
      speed: 0.03,
      shrink: 0.1,
      duration: 1800,
      ease: 'Quad.easeIn',
    });

    // Phase 2 (800-2200ms): Price tags (text particles) explode outward
    const priceTexts = ['$0.00', 'FREE', 'SOLD OUT', '$0.00', 'FREE', 'SOLD OUT', '$0.00', 'FREE'];
    for (let i = 0; i < priceTexts.length; i++) {
      this._scene.time.delayedCall(800 + i * 175, () => {
        if (!this._scene) return;
        const label = priceTexts[i];
        const angle = (Math.PI * 2 * i) / priceTexts.length + Math.random() * 0.5;
        const textObj = this._scene.add.text(this._cx, this._cy, label, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffcc33',
        }).setOrigin(0.5).setDepth(100);

        // Fly outward
        const targetX = this._cx + Math.cos(angle) * (200 + Math.random() * 100);
        const targetY = this._cy + Math.sin(angle) * (150 + Math.random() * 80);

        this._scene.tweens.add({
          targets: textObj,
          x: targetX,
          y: targetY,
          alpha: 0,
          angle: (Math.random() - 0.5) * 360,
          duration: 800,
          ease: 'Quad.easeOut',
          onComplete: () => textObj.destroy(),
        });
      });
    }

    // Camera shake builds
    this._scene.cameras.main.shake(1800, 0.006);

    // Phase 3 (1800-2400ms): Final collapse with particle burst
    this._scene.time.delayedCall(1800, () => {
      if (!this._scene) return;
      spinEvent.destroy();

      // Mark all pieces dead for drawing
      for (const piece of alivePieces) {
        piece.alive = false;
      }
      this._drawPieces();

      // Massive burst at center
      for (let i = 0; i < 5; i++) {
        this._scene.time.delayedCall(i * 80, () => {
          if (!this._scene) return;
          emitBurst(
            this._scene,
            this._cx + (Math.random() - 0.5) * 60,
            this._cy + (Math.random() - 0.5) * 40,
            { ...createDeathBurstConfig(), quantity: 25, tint: COLOR_STAR },
          );
        });
      }

      // Strong shake
      this._scene.cameras.main.shake(500, 0.018);
    });

    // Phase 4 (2400ms): Golden flash
    this._scene.time.delayedCall(2400, () => {
      if (!this._scene) return;
      // Golden flash
      this._scene.cameras.main.flash(400, 255, 204, 51, false);
    });

    // Cleanup at 3000ms
    this._scene.time.delayedCall(3000, () => {
      if (!this._scene) return;
      this._bodyGraphics.clear();
      this._hpBar.clear();
      this._scene.events.emit('boss-defeated');
    });
  }

  update(playerX: number, playerY: number, delta: number): void {
    if (!this.isAlive || this._phaseTransitioning) return;

    this._spawnTimer += delta;

    // Drift center
    this._driftTimer += delta;
    if (this._driftTimer > 2500) {
      this._driftAngle = Math.atan2(
        GAME_HEIGHT / 2 - this._cy + (Math.random() - 0.5) * 200,
        GAME_WIDTH / 2 - this._cx + (Math.random() - 0.5) * 200,
      );
      this._driftTimer = 0;
    }

    const driftSpeed = this._phase === 3 ? 30 : this._phase === 2 ? 22 : 15;
    this._driftVx = Math.cos(this._driftAngle) * driftSpeed;
    this._driftVy = Math.sin(this._driftAngle) * driftSpeed;

    this._cx += this._driftVx * (delta / 1000);
    this._cy += this._driftVy * (delta / 1000);
    this._cx = Phaser.Math.Clamp(this._cx, 160, GAME_WIDTH - 160);
    this._cy = Phaser.Math.Clamp(this._cy, 120, GAME_HEIGHT - 120);

    // Orbit speed scales with phase
    const orbitSpeed = this._baseOrbitSpeed * (this._phase === 3 ? 3 : this._phase === 2 ? 2 : 1);
    this._orbitAngle += orbitSpeed * delta;

    // Update each piece
    for (const piece of this._pieces) {
      if (!piece.alive) continue;

      // Orbit position
      const effectiveSpeed = piece.speedMult * (piece.frenzy ? 2.0 : 1.0);
      const angle = piece.orbitAngle + this._orbitAngle * effectiveSpeed;
      piece.x = this._cx + Math.cos(angle) * piece.orbitRadius;
      piece.y = this._cy + Math.sin(angle) * piece.orbitRadius;

      // Frenzy: erratic wobble
      if (piece.frenzy) {
        piece.x += (Math.random() - 0.5) * 12;
        piece.y += (Math.random() - 0.5) * 12;
        piece.frenzyTimer += delta;
      }

      // Attacks
      piece.attackTimer -= delta;
      if (piece.attackTimer <= 0) {
        piece.attackTimer = piece.attackCooldown;
        this._pieceAttack(piece, playerX, playerY);
      }
    }

    this._doSpawns();
    this._drawPieces();
    this._updateHPBar();
  }

  private _pieceAttack(piece: Piece, px: number, py: number): void {
    switch (piece.id) {
      case 'star':
        this._starSpreadBurst(piece.x, piece.y, px, py, piece.frenzy);
        break;
      case 'circle':
        this._circleRingAttack(piece.x, piece.y, piece.frenzy);
        break;
      case 'rect':
        this._rectAimedBeam(piece.x, piece.y, px, py, piece.frenzy);
        break;
    }
  }

  private _starSpreadBurst(bx: number, by: number, px: number, py: number, frenzy: boolean): void {
    const baseAngle = Phaser.Math.Angle.Between(bx, by, px, py);
    const count = frenzy ? 14 : 8;
    // Star fires a wide fan burst
    const spread = Phaser.Math.DegToRad(frenzy ? 140 : 100);
    const step = spread / (count - 1);

    for (let i = 0; i < count; i++) {
      const angle = baseAngle - spread / 2 + step * i;
      const proj = new EnemyProjectile(this._scene, bx, by, angle, 185, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
  }

  private _circleRingAttack(bx: number, by: number, frenzy: boolean): void {
    const count = frenzy ? 20 : 12;
    const speed = frenzy ? 210 : 165;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const proj = new EnemyProjectile(this._scene, bx, by, angle, speed, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
  }

  private _rectAimedBeam(bx: number, by: number, px: number, py: number, frenzy: boolean): void {
    const baseAngle = Phaser.Math.Angle.Between(bx, by, px, py);
    const count = frenzy ? 5 : 3;
    const spread = Phaser.Math.DegToRad(frenzy ? 25 : 15);
    const step = count > 1 ? spread / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle - spread / 2 + step * i;
      const proj = new EnemyProjectile(this._scene, bx, by, angle, 230, 1);
      this._projectileGroup.add(proj);
    }
    playSFX('enemy_shoot');
  }

  private _doSpawns(): void {
    const spawnInterval = this._phase === 3 ? 5000 : 10000;
    if (this._spawnTimer < spawnInterval) return;
    this._spawnTimer = 0;

    const count = this._phase === 3 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      this._scene.events.emit('boss-spawn-add', {
        type: 'pitchman',
        x: 100 + Math.random() * (GAME_WIDTH - 200),
        y: 100 + Math.random() * (GAME_HEIGHT - 200),
      });
    }
  }

  isBeamHitting(_px: number, _py: number): boolean {
    // BossOffer does not use traditional beam attacks
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

    // Draw 3 segments per piece
    const pieces = this._pieces;
    const totalMaxHp = this.maxHp;
    let drawX = x;

    for (const piece of pieces) {
      const segMaxW = (piece.maxHp / totalMaxHp) * barWidth;
      const segFillW = (Math.max(0, piece.hp) / piece.maxHp) * segMaxW;

      // Background segment
      this._hpBar.fillStyle(0x333333, 0.6);
      this._hpBar.fillRect(drawX, y, segMaxW - 1, barHeight);

      // Filled segment
      if (piece.alive && segFillW > 0) {
        this._hpBar.fillStyle(piece.color, 1);
        this._hpBar.fillRect(drawX, y, segFillW, barHeight);
      }

      drawX += segMaxW;
    }

    this._hpBar.setDepth(100);
  }

  cleanup(): void {
    this._bodyGraphics?.destroy();
    this._hpBar?.destroy();
  }
}
