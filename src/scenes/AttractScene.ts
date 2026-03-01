import { Scene, GameObjects } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CSS_PHOSPHOR_GREEN } from '../utils/constants';

/**
 * Attract mode: simulated gameplay after 30s idle on the title screen.
 * Draws fake player, enemies, and projectiles using Graphics — no real entities.
 */
export class AttractScene extends Scene {
  private _fakePlayer = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, angle: 0 };
  private _fakeEnemies: { x: number; y: number; vx: number; vy: number; hp: number }[] = [];
  private _fakeProjectiles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private _gfx!: GameObjects.Graphics;
  private _shootTimer = 0;
  private _spawnTimer = 0;
  private _moveAngle = 0;
  private _done = false;

  constructor() {
    super({ key: 'AttractScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x070f07);
    this.cameras.main.setPostPipeline('CRTPipeline');

    this._gfx = this.add.graphics();

    // Scanlines
    const scanlines = this.add.graphics();
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      scanlines.fillStyle(0x000000, 0.12);
      scanlines.fillRect(0, y, GAME_WIDTH, 1);
    }

    // "PRESS ANY KEY" overlay
    const pressText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'PRESS ANY KEY', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: CSS_PHOSPHOR_GREEN,
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets: pressText,
      alpha: { from: 1, to: 0.2 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // "DEMO" watermark
    this.add.text(GAME_WIDTH / 2, 20, 'DEMO', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#333333',
    }).setOrigin(0.5).setDepth(10);

    // Init state
    this._fakePlayer = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, angle: 0 };
    this._fakeEnemies = [];
    this._fakeProjectiles = [];
    this._shootTimer = 0;
    this._spawnTimer = 0;
    this._moveAngle = Math.random() * Math.PI * 2;
    this._done = false;

    // Spawn initial enemies
    for (let i = 0; i < 5; i++) {
      this._spawnFakeEnemy();
    }

    // Any input returns to title
    this.time.delayedCall(500, () => {
      this.input.keyboard!.on('keydown', () => this._exit());
      this.input.on('pointerdown', () => this._exit());
    });

    this.cameras.main.fadeIn(400);
  }

  update(_time: number, delta: number): void {
    if (this._done) return;

    const dt = delta / 1000;
    const p = this._fakePlayer;

    // Move player in a wandering pattern
    this._moveAngle += (Math.random() - 0.5) * 2 * dt;
    p.x += Math.cos(this._moveAngle) * 120 * dt;
    p.y += Math.sin(this._moveAngle) * 120 * dt;

    // Bounce off walls
    if (p.x < 60) { p.x = 60; this._moveAngle = Math.PI - this._moveAngle; }
    if (p.x > GAME_WIDTH - 60) { p.x = GAME_WIDTH - 60; this._moveAngle = Math.PI - this._moveAngle; }
    if (p.y < 60) { p.y = 60; this._moveAngle = -this._moveAngle; }
    if (p.y > GAME_HEIGHT - 60) { p.y = GAME_HEIGHT - 60; this._moveAngle = -this._moveAngle; }

    // Aim at nearest enemy
    let nearestDist = Infinity;
    let aimAngle = 0;
    for (const e of this._fakeEnemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < nearestDist) {
        nearestDist = d;
        aimAngle = Math.atan2(e.y - p.y, e.x - p.x);
      }
    }
    p.angle = aimAngle;

    // Shoot
    this._shootTimer += delta;
    if (this._shootTimer > 250) {
      this._shootTimer = 0;
      this._fakeProjectiles.push({
        x: p.x, y: p.y,
        vx: Math.cos(aimAngle) * 400,
        vy: Math.sin(aimAngle) * 400,
        life: 1000,
      });
    }

    // Spawn enemies
    this._spawnTimer += delta;
    if (this._spawnTimer > 2000 && this._fakeEnemies.length < 8) {
      this._spawnTimer = 0;
      this._spawnFakeEnemy();
    }

    // Update enemies
    for (const e of this._fakeEnemies) {
      const angleToPlayer = Math.atan2(p.y - e.y, p.x - e.x);
      e.vx = Math.cos(angleToPlayer) * 60;
      e.vy = Math.sin(angleToPlayer) * 60;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }

    // Update projectiles
    for (const proj of this._fakeProjectiles) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= delta;

      // Hit enemies
      for (let i = this._fakeEnemies.length - 1; i >= 0; i--) {
        const e = this._fakeEnemies[i];
        if (Math.hypot(proj.x - e.x, proj.y - e.y) < 20) {
          e.hp -= 1;
          proj.life = 0;
          if (e.hp <= 0) {
            this._fakeEnemies.splice(i, 1);
          }
          break;
        }
      }
    }

    // Remove dead projectiles
    this._fakeProjectiles = this._fakeProjectiles.filter(pr => pr.life > 0 && pr.x > 0 && pr.x < GAME_WIDTH && pr.y > 0 && pr.y < GAME_HEIGHT);

    // Draw everything
    this._gfx.clear();

    // Draw player
    this._gfx.fillStyle(0x33ff33, 1);
    this._gfx.fillCircle(p.x, p.y, 8);
    this._gfx.lineStyle(1, 0x33ff33, 0.5);
    this._gfx.strokeCircle(p.x, p.y, 12);

    // Draw enemies
    for (const e of this._fakeEnemies) {
      this._gfx.fillStyle(0xff3333, 0.8);
      this._gfx.fillCircle(e.x, e.y, 10);
      this._gfx.lineStyle(1, 0xff3333, 0.4);
      this._gfx.strokeCircle(e.x, e.y, 14);
    }

    // Draw projectiles
    this._gfx.fillStyle(0x33ff33, 0.9);
    for (const pr of this._fakeProjectiles) {
      this._gfx.fillCircle(pr.x, pr.y, 3);
    }
  }

  private _spawnFakeEnemy(): void {
    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    switch (edge) {
      case 0: x = Math.random() * GAME_WIDTH; y = 20; break;
      case 1: x = Math.random() * GAME_WIDTH; y = GAME_HEIGHT - 20; break;
      case 2: x = 20; y = Math.random() * GAME_HEIGHT; break;
      case 3: x = GAME_WIDTH - 20; y = Math.random() * GAME_HEIGHT; break;
    }
    this._fakeEnemies.push({ x, y, vx: 0, vy: 0, hp: 3 });
  }

  private _exit(): void {
    if (this._done) return;
    this._done = true;
    this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) this.scene.start('MenuScene');
    });
  }
}
