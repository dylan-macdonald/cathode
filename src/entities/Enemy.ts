import { Physics, Scene, GameObjects } from 'phaser';
import { EnemyConfig, ENEMY_CONFIGS } from '../data/enemies';
import { playSFX } from '../audio/SFXGenerator';
import { emitBurst, createDeathBurstConfig } from '../rendering/ParticlePresets';
import { HIT_SHAKE_INTENSITY, HIT_SHAKE_DURATION, GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';
import { logEvent } from '../debug/EventLog';

export class EnemyProjectile extends Physics.Arcade.Sprite {
  damage: number;
  private _lifeTimer = 0;
  private _maxLife: number;

  constructor(scene: Scene, x: number, y: number, angle: number, speed: number, damage: number, maxLife = 3000) {
    super(scene, x, y, 'enemy_projectile');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.damage = damage;
    this._maxLife = maxLife;

    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.body!.setCircle(5, this.width / 2 - 5, this.height / 2 - 5);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this._lifeTimer += delta;
    if (this._lifeTimer >= this._maxLife) {
      this.kill();
    }
    // Kill if out of bounds
    if (this.x < -20 || this.x > GAME_WIDTH + 20 || this.y < -20 || this.y > GAME_HEIGHT + 20) {
      this.kill();
    }
  }

  kill(): void {
    this.setActive(false);
    this.setVisible(false);
    if (this.body) this.body.enable = false;
    this.destroy();
  }
}

export class Enemy extends Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  speed: number;
  contactDamage: number;
  scoreValue: number;
  config: EnemyConfig;

  private _healthBar: GameObjects.Graphics;
  private _flashTween: Phaser.Tweens.Tween | null = null;

  // Behavior state
  private _attackTimer = 0;
  private _behaviorTimer = 0;
  private _strafeDir = 1;
  private _orbitDir = 1;
  private _orbitSwitchTimer = 0;
  private _teleportTimer = 0;
  private _teleportPhase: 'idle' | 'charging' | 'arrived' = 'idle';
  private _sentinelAngle = 0;
  private _sentinelActive = false;
  private _sentinelTelegraph: GameObjects.Graphics | null = null;
  private _sentinelBeam: GameObjects.Graphics | null = null;
  private _hitStopTimer = 0;

  // New behavior state
  private _cardinalDir = { x: 0, y: 0 };
  private _cardinalTimer = 0;
  private _expandPhase = 0;
  private _zigzagDir = { x: 1, y: 1 };
  private _zigzagTimer = 0;
  private _scrollDir = 1;
  private _chargeTimer = 0;
  private _chargePhase: 'idle' | 'charging' = 'idle';
  private _swarmAngle = 0;
  private _swarmDiving = false;
  private _swarmDiveTimer = 0;
  private _spawnerTimer = 0;

  // Ricochet state
  private _ricochetVx = 0;
  private _ricochetVy = 0;

  // Beat drift state
  private _beatDriftActive = false;
  private _beatDriftTimer = 0;

  // Strobe dash state
  private _strobeDashTimer = 0;
  private _strobeBeatCount = 0;

  // Speed multiplier (rally buff)
  speedMultiplier = 1;
  private _speedBuffTimer = 0;

  // New attack state
  private _trackingBeamGraphics: GameObjects.Graphics | null = null;
  private _trackingBeamAngle = 0;
  private _trackingBeamActive = false;

  // Scene reference for spawning projectiles
  private _projectileGroup: Physics.Arcade.Group;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    configKey: string,
    projectileGroup: Physics.Arcade.Group,
  ) {
    const config = ENEMY_CONFIGS[configKey] ?? ENEMY_CONFIGS.static_mote;
    super(scene, x, y, `enemy_${config.key}`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.config = config;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.speed = config.speed;
    this.contactDamage = config.damage;
    this.scoreValue = config.points;
    this._projectileGroup = projectileGroup;

    const body = this.body as Physics.Arcade.Body;
    body.setCircle(config.size, this.width / 2 - config.size, this.height / 2 - config.size);

    // Turrets and expand_contract are immovable
    if (config.behavior === 'turret' || config.behavior === 'expand_contract') {
      body.setImmovable(true);
    }

    // Health bar
    this._healthBar = scene.add.graphics();
    this._updateHealthBar();

    // Bobbing animation for non-turret, non-expand_contract enemies
    if (config.behavior !== 'turret' && config.behavior !== 'expand_contract') {
      scene.tweens.add({
        targets: this,
        scaleX: { from: 0.95, to: 1.05 },
        scaleY: { from: 1.05, to: 0.95 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Sentinel-specific setup
    if (config.key === 'bar_sentinel') {
      this._sentinelAngle = Math.random() * Math.PI * 2;
      this._sentinelTelegraph = scene.add.graphics();
      this._sentinelBeam = scene.add.graphics();
    }

    // Tracking beam setup (tone_spike)
    if (config.attackType === 'tracking_beam') {
      this._trackingBeamGraphics = scene.add.graphics();
      this._trackingBeamAngle = Math.random() * Math.PI * 2;
    }

    // Cardinal walker: pick a random initial direction
    if (config.behavior === 'cardinal') {
      this._cardinalPickDir();
      this._cardinalTimer = 2000;
    }

    // Zigzag: random initial diagonal
    if (config.behavior === 'zigzag') {
      this._zigzagDir = { x: Math.random() < 0.5 ? 1 : -1, y: Math.random() < 0.5 ? 1 : -1 };
      this._zigzagTimer = 1500;
    }

    // Scroll: random initial horizontal direction
    if (config.behavior === 'scroll') {
      this._scrollDir = Math.random() < 0.5 ? 1 : -1;
    }

    // Swarm: random orbit start angle
    if (config.behavior === 'swarm') {
      this._swarmAngle = Math.atan2(y - GAME_HEIGHT / 2, x - GAME_WIDTH / 2);
    }

    // Charge: start idle
    if (config.behavior === 'charge') {
      this._chargeTimer = 1000 + Math.random() * 1000;
      this._chargePhase = 'idle';
    }

    // Spawner: stagger initial spawn timer
    if (config.behavior === 'spawner') {
      this._spawnerTimer = 4000 + Math.random() * 4000;
    }

    // Ricochet: random initial direction
    if (config.behavior === 'ricochet') {
      const rAngle = Math.random() * Math.PI * 2;
      this._ricochetVx = Math.cos(rAngle) * config.speed;
      this._ricochetVy = Math.sin(rAngle) * config.speed;
    }

    // Beat drift: listen for beat events
    if (config.behavior === 'beat_drift') {
      scene.events.on('beat', () => {
        if (!this.active) return;
        this._beatDriftActive = true;
        this._beatDriftTimer = 200;
        // Random direction on each beat
        const bAngle = Math.random() * Math.PI * 2;
        const body2 = this.body as Physics.Arcade.Body;
        body2.setVelocity(Math.cos(bAngle) * this.speed * 2, Math.sin(bAngle) * this.speed * 2);
      });
    }

    // Strobe dash: teleport every 2 beats
    if (config.behavior === 'strobe_dash') {
      this._strobeBeatCount = 0;
      scene.events.on('beat', () => {
        if (!this.active) return;
        this._strobeBeatCount++;
        if (this._strobeBeatCount >= 2) {
          this._strobeBeatCount = 0;
          // Teleport to random position
          const newX = 100 + Math.random() * (GAME_WIDTH - 200);
          const newY = 100 + Math.random() * (GAME_HEIGHT - 200);
          this.setPosition(newX, newY);
          // Fire ring on arrival
          this._attackRing();
        }
      });
    }

    // Ghost flicker
    if (config.key === 'signal_ghost') {
      scene.tweens.add({
        targets: this,
        alpha: { from: 0.6, to: 1 },
        duration: 200,
        yoyo: true,
        repeat: -1,
      });
      this._teleportPhase = 'idle';
      this._teleportTimer = config.attackCooldown;
    }

    // Randomize initial strafe direction
    this._strafeDir = Math.random() < 0.5 ? 1 : -1;
    this._orbitSwitchTimer = 3000 + Math.random() * 2000;
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    logEvent('enemy_hit', { key: this.config.key, hpRemaining: this.hp });
    playSFX('enemy_hit');
    this.scene.cameras.main.shake(HIT_SHAKE_DURATION, HIT_SHAKE_INTENSITY);

    // Hit flash
    this._flashTween?.destroy();
    this.setTintFill(0xffffff);
    this._flashTween = this.scene.tweens.add({
      targets: this,
      duration: 60,
      onComplete: () => this.clearTint(),
    });

    // Hit stop (freeze 1 frame)
    this._hitStopTimer = 50;

    // Knockback away from shot
    if (this.body && this.config.behavior !== 'turret') {
      const body = this.body as Physics.Arcade.Body;
      const pointer = this.scene.input.activePointer;
      const angle = Phaser.Math.Angle.Between(pointer.worldX, pointer.worldY, this.x, this.y);
      body.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
      this.scene.time.delayedCall(100, () => {
        if (this.active && body.enable) body.setVelocity(0, 0);
      });
    }

    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this._updateHealthBar();
    return false;
  }

  die(): void {
    logEvent('enemy_death', { key: this.config.key });
    // Death SFX based on enemy size
    if (this.config.hp >= 6) {
      playSFX('enemy_death_large');
    } else if (this.config.hp >= 3) {
      playSFX('enemy_death_medium');
    } else {
      playSFX('enemy_death_small');
    }

    // Split-on-death (feedback_loop spawns dead_pixel children)
    if (this.config.onDeath === 'split') {
      this.scene.events.emit('enemy-split', { x: this.x, y: this.y, parentKey: 'dead_pixel' });
    }

    emitBurst(this.scene, this.x, this.y, createDeathBurstConfig());
    this._cleanup();
    this.destroy();
  }

  private _cleanup(): void {
    this._healthBar?.destroy();
    this._sentinelTelegraph?.destroy();
    this._sentinelBeam?.destroy();
    this._trackingBeamGraphics?.destroy();
    this._trackingBeamGraphics = null;
  }

  override destroy(fromScene?: boolean): void {
    this._cleanup();
    super.destroy(fromScene);
  }

  update(playerX: number, playerY: number, delta: number): void {
    if (!this.active || !this.body) return;

    // Hit stop
    if (this._hitStopTimer > 0) {
      this._hitStopTimer -= delta;
      (this.body as Physics.Arcade.Body).setVelocity(0, 0);
      this._updateHealthBar();
      return;
    }

    this._behaviorTimer += delta;
    this._attackTimer += delta;

    const body = this.body as Physics.Arcade.Body;

    switch (this.config.behavior) {
      case 'chase':
        this._behaviorChase(playerX, playerY, body);
        break;
      case 'strafe':
        this._behaviorStrafe(playerX, playerY, body, delta);
        break;
      case 'orbit':
        this._behaviorOrbit(playerX, playerY, body, delta);
        break;
      case 'turret':
        this._behaviorTurret(playerX, playerY, delta);
        break;
      case 'teleport':
        this._behaviorTeleport(playerX, playerY, delta);
        break;
      case 'cardinal':
        this._behaviorCardinal(body, delta);
        break;
      case 'expand_contract':
        this._behaviorExpandContract(playerX, playerY, delta);
        break;
      case 'zigzag':
        this._behaviorZigzag(body, delta);
        break;
      case 'scroll':
        this._behaviorScroll(body, delta);
        break;
      case 'charge':
        this._behaviorCharge(playerX, playerY, body, delta);
        break;
      case 'swarm':
        this._behaviorSwarm(playerX, playerY, body, delta);
        break;
      case 'spawner':
        this._behaviorSpawner(playerX, playerY, body, delta);
        break;
      case 'ricochet':
        this._behaviorRicochet(body, delta);
        break;
      case 'beat_drift':
        this._behaviorBeatDrift(body, delta);
        break;
      case 'strobe_dash':
        this._behaviorStrobeDash(body, delta);
        break;
    }

    // Speed buff decay
    if (this._speedBuffTimer > 0) {
      this._speedBuffTimer -= delta;
      if (this._speedBuffTimer <= 0) {
        this.speedMultiplier = 1;
      }
    }

    // Attack logic
    if (this.config.attackType !== 'none' && this.config.behavior !== 'teleport') {
      if (this._attackTimer >= this.config.attackCooldown) {
        this._attack(playerX, playerY);
        this._attackTimer = 0;
      }
    }

    this._updateHealthBar();
  }

  // ── Behaviors ──

  private _behaviorChase(px: number, py: number, body: Physics.Arcade.Body): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
    body.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
  }

  private _behaviorStrafe(px: number, py: number, body: Physics.Arcade.Body, delta: number): void {
    // Move horizontally, reversing on wall collision
    const vx = this._strafeDir * this.speed;
    // Slight drift toward player on Y axis
    const dy = py - this.y;
    const vy = Math.sign(dy) * Math.min(Math.abs(dy) * 0.5, 20);

    body.setVelocity(vx, vy);

    // Reverse at room edges (with padding)
    if (this.x < 100 || this.x > GAME_WIDTH - 100) {
      this._strafeDir *= -1;
    }
  }

  private _behaviorOrbit(px: number, py: number, body: Physics.Arcade.Body, delta: number): void {
    const targetDist = 200;
    const dx = this.x - px;
    const dy = this.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angleToPlayer = Math.atan2(dy, dx);

    // Move perpendicular to player-enemy vector (orbit)
    const perpAngle = angleToPlayer + (Math.PI / 2) * this._orbitDir;

    // Also adjust distance toward target
    let radialForce = 0;
    if (dist < targetDist - 30) radialForce = 1;
    else if (dist > targetDist + 30) radialForce = -1;

    const moveAngle = perpAngle;
    let vx = Math.cos(moveAngle) * this.speed + Math.cos(angleToPlayer) * radialForce * 40;
    let vy = Math.sin(moveAngle) * this.speed + Math.sin(angleToPlayer) * radialForce * 40;

    body.setVelocity(vx, vy);

    // Switch orbit direction periodically
    this._orbitSwitchTimer -= delta;
    if (this._orbitSwitchTimer <= 0) {
      this._orbitDir *= -1;
      this._orbitSwitchTimer = 3000 + Math.random() * 2000;
    }
  }

  private _behaviorTurret(px: number, py: number, delta: number): void {
    // Bar Sentinel: rotating beam
    if (this.config.key !== 'bar_sentinel') return;

    const rotSpeed = (Math.PI * 2) / this.config.attackCooldown; // full rotation per attackCooldown
    this._sentinelAngle += rotSpeed * delta;

    // Draw telegraph and beam
    this._sentinelTelegraph!.clear();
    this._sentinelBeam!.clear();

    if (this._sentinelActive) {
      // Active beam
      this._sentinelBeam!.lineStyle(6, 0xff3333, 0.8);
      this._sentinelBeam!.beginPath();
      this._sentinelBeam!.moveTo(this.x, this.y);
      const beamLen = 500;
      this._sentinelBeam!.lineTo(
        this.x + Math.cos(this._sentinelAngle) * beamLen,
        this.y + Math.sin(this._sentinelAngle) * beamLen,
      );
      this._sentinelBeam!.strokePath();
    }

    // Telegraph (dim preview of next half rotation)
    const telegraphAngle = this._sentinelAngle + Math.PI * 0.1;
    this._sentinelTelegraph!.lineStyle(2, 0xff3333, 0.15);
    this._sentinelTelegraph!.beginPath();
    this._sentinelTelegraph!.moveTo(this.x, this.y);
    this._sentinelTelegraph!.lineTo(
      this.x + Math.cos(telegraphAngle) * 500,
      this.y + Math.sin(telegraphAngle) * 500,
    );
    this._sentinelTelegraph!.strokePath();
  }

  private _behaviorTeleport(px: number, py: number, delta: number): void {
    const body = this.body as Physics.Arcade.Body;
    body.setVelocity(0, 0);

    this._teleportTimer -= delta;

    if (this._teleportPhase === 'idle' && this._teleportTimer <= 0) {
      // Start teleport
      this._teleportPhase = 'charging';
      this.setAlpha(0.2);

      // Find random position near player
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 100;
      const newX = Phaser.Math.Clamp(px + Math.cos(angle) * dist, 80, GAME_WIDTH - 80);
      const newY = Phaser.Math.Clamp(py + Math.sin(angle) * dist, 80, GAME_HEIGHT - 80);

      // Dissolve effect
      emitBurst(this.scene, this.x, this.y, createDeathBurstConfig());
      playSFX('teleport');

      this.scene.time.delayedCall(200, () => {
        if (!this.active) return;
        this.setPosition(newX, newY);
        this.setAlpha(1);
        this._teleportPhase = 'arrived';

        emitBurst(this.scene, this.x, this.y, createDeathBurstConfig());

        // Attack on arrival
        this._attack(px, py);

        this.scene.time.delayedCall(500, () => {
          if (this.active) {
            this._teleportPhase = 'idle';
            this._teleportTimer = this.config.attackCooldown;
          }
        });
      });
    }
  }

  private _cardinalPickDir(): void {
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    this._cardinalDir = dirs[Math.floor(Math.random() * dirs.length)];
  }

  private _behaviorCardinal(body: Physics.Arcade.Body, delta: number): void {
    this._cardinalTimer -= delta;

    // Pick new direction at boundary or timer expiry
    if (
      this._cardinalTimer <= 0 ||
      this.x < 90 ||
      this.x > GAME_WIDTH - 90 ||
      this.y < 90 ||
      this.y > GAME_HEIGHT - 90
    ) {
      this._cardinalPickDir();
      this._cardinalTimer = 1500 + Math.random() * 1000;
      // Push away from edges
      if (this.x < 90) this._cardinalDir = { x: 1, y: 0 };
      else if (this.x > GAME_WIDTH - 90) this._cardinalDir = { x: -1, y: 0 };
      else if (this.y < 90) this._cardinalDir = { x: 0, y: 1 };
      else if (this.y > GAME_HEIGHT - 90) this._cardinalDir = { x: 0, y: -1 };
    }

    body.setVelocity(this._cardinalDir.x * this.speed, this._cardinalDir.y * this.speed);
  }

  private _behaviorExpandContract(px: number, py: number, delta: number): void {
    const body = this.body as Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // Advance phase over attackCooldown period
    this._expandPhase += delta / this.config.attackCooldown;
    if (this._expandPhase >= 1) {
      this._expandPhase = 0;
      // Fire ring at max expansion (phase near 0.5 = peak scale)
      this._attack(px, py);
      this._attackTimer = 0; // prevent double-firing from normal timer
    }

    // Scale pulses 0.5 → 1.5 using sine wave
    const scaleFactor = 0.5 + Math.sin(this._expandPhase * Math.PI) * 1.0;
    this.setScale(scaleFactor);
  }

  private _behaviorZigzag(body: Physics.Arcade.Body, delta: number): void {
    this._zigzagTimer -= delta;
    if (this._zigzagTimer <= 0) {
      // Flip horizontal direction
      this._zigzagDir.x *= -1;
      this._zigzagTimer = 1000 + Math.random() * 1000;
    }

    // Bounce off room edges
    if (this.x < 80) this._zigzagDir.x = 1;
    else if (this.x > GAME_WIDTH - 80) this._zigzagDir.x = -1;
    if (this.y < 80) this._zigzagDir.y = 1;
    else if (this.y > GAME_HEIGHT - 80) this._zigzagDir.y = -1;

    const speed = this.speed * 0.707; // normalize diagonal
    body.setVelocity(this._zigzagDir.x * speed, this._zigzagDir.y * speed);
  }

  private _behaviorScroll(body: Physics.Arcade.Body, _delta: number): void {
    // Move horizontally at constant speed; teleport to opposite side at random Y when reaching edge
    if (this.x < 60) {
      this._scrollDir = 1;
      this.setPosition(GAME_WIDTH - 70, 80 + Math.random() * (GAME_HEIGHT - 160));
    } else if (this.x > GAME_WIDTH - 60) {
      this._scrollDir = -1;
      this.setPosition(70, 80 + Math.random() * (GAME_HEIGHT - 160));
    }

    body.setVelocity(this._scrollDir * this.speed, 0);
  }

  private _behaviorCharge(px: number, py: number, body: Physics.Arcade.Body, delta: number): void {
    if (this._chargePhase === 'idle') {
      this._chargeTimer -= delta;
      // Slow drift toward player during idle
      const angle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
      body.setVelocity(Math.cos(angle) * this.speed * 0.3, Math.sin(angle) * this.speed * 0.3);

      if (this._chargeTimer <= 0) {
        // Begin charge
        this._chargePhase = 'charging';
        const angle2 = Phaser.Math.Angle.Between(this.x, this.y, px, py);
        body.setVelocity(Math.cos(angle2) * this.speed * 2, Math.sin(angle2) * this.speed * 2);

        this.scene.time.delayedCall(500, () => {
          if (!this.active) return;
          this._chargePhase = 'idle';
          this._chargeTimer = 2500 + Math.random() * 1000;
          if (this.body) (this.body as Physics.Arcade.Body).setVelocity(0, 0);
        });
      }
    }
    // If charging, velocity is already set — let physics run
  }

  private _behaviorSwarm(px: number, py: number, body: Physics.Arcade.Body, delta: number): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const orbitRadius = 220;
    const orbitSpeed = this.speed / orbitRadius; // radians per ms → scale by delta below

    if (this._swarmDiving) {
      // Dive toward player
      const angle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
      body.setVelocity(Math.cos(angle) * this.speed * 1.5, Math.sin(angle) * this.speed * 1.5);

      this._swarmDiveTimer -= delta;
      if (this._swarmDiveTimer <= 0) {
        this._swarmDiving = false;
        // Reset orbit angle to current position
        this._swarmAngle = Math.atan2(this.y - centerY, this.x - centerX);
      }
    } else {
      // Orbit center
      this._swarmAngle += (orbitSpeed * delta) / 1000;

      const targetX = centerX + Math.cos(this._swarmAngle) * orbitRadius;
      const targetY = centerY + Math.sin(this._swarmAngle) * orbitRadius;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        body.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
      } else {
        body.setVelocity(0, 0);
      }

      // Dive every 3s
      this._behaviorTimer += 0; // already incremented above in update()
      // Use separate dive cooldown via _swarmDiveTimer as a countdown
      // We repurpose _behaviorTimer as the dive cooldown here
      if (this._behaviorTimer >= 3000) {
        this._behaviorTimer = 0;
        this._swarmDiving = true;
        this._swarmDiveTimer = 800;
      }
    }
  }

  private _behaviorSpawner(px: number, py: number, body: Physics.Arcade.Body, delta: number): void {
    // Slow chase toward player
    const angle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
    body.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);

    // Spawn clone every 8s
    this._spawnerTimer -= delta;
    if (this._spawnerTimer <= 0) {
      this._spawnerTimer = 8000;
      this.scene.events.emit('enemy-spawn-clone', { x: this.x, y: this.y, key: 'dead_pixel' });
    }
  }

  private _behaviorRicochet(body: Physics.Arcade.Body, _delta: number): void {
    // Bounce off walls
    if (this.x < 80) { this._ricochetVx = Math.abs(this._ricochetVx); }
    else if (this.x > GAME_WIDTH - 80) { this._ricochetVx = -Math.abs(this._ricochetVx); }
    if (this.y < 80) { this._ricochetVy = Math.abs(this._ricochetVy); }
    else if (this.y > GAME_HEIGHT - 80) { this._ricochetVy = -Math.abs(this._ricochetVy); }

    body.setVelocity(this._ricochetVx * this.speedMultiplier, this._ricochetVy * this.speedMultiplier);
  }

  private _behaviorBeatDrift(body: Physics.Arcade.Body, delta: number): void {
    // Move only during beat window, otherwise stop
    if (this._beatDriftActive) {
      this._beatDriftTimer -= delta;
      if (this._beatDriftTimer <= 0) {
        this._beatDriftActive = false;
        body.setVelocity(0, 0);
      }
    } else {
      body.setVelocity(0, 0);
    }
  }

  private _behaviorStrobeDash(body: Physics.Arcade.Body, _delta: number): void {
    // Strobe enemies mostly stay still — teleporting handled via beat events
    body.setVelocity(0, 0);
  }

  /** Apply a speed buff (used by rally_buff attack) */
  applySpeedBuff(multiplier: number, duration: number): void {
    this.speedMultiplier = multiplier;
    this._speedBuffTimer = duration;
  }

  // ── Attacks ──

  private _attack(px: number, py: number): void {
    if (!this.active) return;

    switch (this.config.attackType) {
      case 'aimed':
        this._attackAimed(px, py);
        break;
      case 'burst':
        this._attackBurst(px, py);
        break;
      case 'beam':
        this._attackBeam(px, py);
        break;
      case 'ring':
        this._attackRing();
        break;
      case 'quad_aimed':
        this._attackQuadAimed();
        break;
      case 'rgb_sequence':
        this._attackRgbSequence(px, py);
        break;
      case 'tracking_beam':
        this._attackTrackingBeam(px, py);
        break;
      case 'whistle_stun':
        this._attackWhistleStun(px, py);
        break;
      case 'rally_buff':
        this._attackRallyBuff();
        break;
      case 'eq_columns':
        this._attackEqColumns();
        break;
    }
  }

  private _attackAimed(px: number, py: number): void {
    // Lead the target slightly
    const angle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
    this._spawnProjectile(angle);
    playSFX('enemy_shoot');
  }

  private _attackBurst(px: number, py: number): void {
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
    const count = 5;
    const spreadRad = Phaser.Math.DegToRad(60);
    const step = spreadRad / (count - 1);
    const startAngle = baseAngle - spreadRad / 2;

    for (let i = 0; i < count; i++) {
      this._spawnProjectile(startAngle + step * i);
    }
    playSFX('enemy_shoot');
  }

  private _attackBeam(px: number, py: number): void {
    if (this.config.key === 'bar_sentinel') {
      // Sentinel beam is handled in turret behavior as a continuous rotating line
      this._sentinelActive = true;
      this.scene.time.delayedCall(2000, () => {
        this._sentinelActive = false;
      });
    } else {
      // Scanline Crawler: fires a horizontal beam projectile across full width
      const angle = this._strafeDir > 0 ? 0 : Math.PI;
      this._spawnProjectile(angle, this.config.attackSpeed);
      playSFX('enemy_shoot');
    }
  }

  private _attackRing(): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      this._spawnProjectile(angle);
    }
    playSFX('enemy_shoot');
  }

  private _attackQuadAimed(): void {
    // Fire in the 4 cardinal directions simultaneously
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    for (const angle of angles) {
      this._spawnProjectile(angle);
    }
    playSFX('enemy_shoot');
  }

  private _attackRgbSequence(px: number, py: number): void {
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
    // Fire 3 projectiles 100ms apart with small angular offsets
    const offsets = [0, Phaser.Math.DegToRad(-8), Phaser.Math.DegToRad(8)];
    offsets.forEach((offset, i) => {
      this.scene.time.delayedCall(i * 100, () => {
        if (!this.active) return;
        this._spawnProjectile(baseAngle + offset);
      });
    });
    playSFX('enemy_shoot');
  }

  private _attackTrackingBeam(px: number, py: number): void {
    if (!this._trackingBeamGraphics || this._trackingBeamActive) return;

    this._trackingBeamActive = true;
    const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
    this._trackingBeamAngle = targetAngle + Math.PI; // start 180° off, sweep toward target

    const sweepDuration = 1500;
    const fireDuration = 500;
    const gfx = this._trackingBeamGraphics;

    // Sweep phase: gradually rotate angle toward player
    let elapsed = 0;

    const sweepEvent = this.scene.time.addEvent({
      delay: 16,
      repeat: Math.floor(sweepDuration / 16),
      callback: () => {
        if (!this.active || !gfx.active) return;
        elapsed += 16;
        const t = Math.min(elapsed / sweepDuration, 1);
        this._trackingBeamAngle = Phaser.Math.Angle.RotateTo(
          this._trackingBeamAngle,
          targetAngle,
          0.05,
        );

        gfx.clear();
        gfx.lineStyle(3, 0xff6600, 0.5 + t * 0.5);
        gfx.beginPath();
        gfx.moveTo(this.x, this.y);
        gfx.lineTo(
          this.x + Math.cos(this._trackingBeamAngle) * 500,
          this.y + Math.sin(this._trackingBeamAngle) * 500,
        );
        gfx.strokePath();
      },
    });

    // Fire phase: full beam
    this.scene.time.delayedCall(sweepDuration, () => {
      if (!this.active || !gfx.active) return;
      sweepEvent.remove();
      gfx.clear();
      gfx.lineStyle(8, 0xff6600, 1);
      gfx.beginPath();
      gfx.moveTo(this.x, this.y);
      gfx.lineTo(
        this.x + Math.cos(this._trackingBeamAngle) * 500,
        this.y + Math.sin(this._trackingBeamAngle) * 500,
      );
      gfx.strokePath();
      playSFX('enemy_shoot');

      this.scene.time.delayedCall(fireDuration, () => {
        if (gfx.active) gfx.clear();
        this._trackingBeamActive = false;
      });
    });
  }

  private _attackWhistleStun(px: number, py: number): void {
    // Slow ring projectile — player slow handled by GameScene on overlap
    const angle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
    const proj = new EnemyProjectile(this.scene, this.x, this.y, angle, 120, 0, 4000);
    // Tag for GameScene to detect stun projectiles
    (proj as any).isStunProjectile = true;
    this._projectileGroup.add(proj);
    playSFX('whistle');
  }

  private _attackRallyBuff(): void {
    // Buff nearby enemies speed +25% for 5s
    const buffRadius = 200;
    this.scene.events.emit('rally-buff', { x: this.x, y: this.y, radius: buffRadius, multiplier: 1.25, duration: 5000 });
    playSFX('rally');
  }

  private _attackEqColumns(): void {
    // Fire 5 vertical columns of projectiles across arena width with gaps
    const columns = 5;
    const gap = GAME_WIDTH / (columns + 1);
    for (let c = 0; c < columns; c++) {
      const cx = gap * (c + 1);
      // Fire 3 projectiles downward per column
      for (let i = 0; i < 3; i++) {
        const proj = new EnemyProjectile(
          this.scene, cx, 60 + i * 15,
          Math.PI / 2, // straight down
          this.config.attackSpeed, this.config.attackDamage,
        );
        this._projectileGroup.add(proj);
      }
    }
    playSFX('enemy_shoot');
  }

  private _spawnProjectile(angle: number, speedOverride?: number): void {
    // Performance cap: max 200 enemy projectiles
    if (this._projectileGroup.getLength() >= 200) return;

    const proj = new EnemyProjectile(
      this.scene,
      this.x,
      this.y,
      angle,
      speedOverride ?? this.config.attackSpeed,
      this.config.attackDamage,
    );
    this._projectileGroup.add(proj);
  }

  // Check if sentinel beam hits a point
  isSentinelBeamHitting(px: number, py: number): boolean {
    if (!this._sentinelActive || !this.active) return false;

    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 500) return false;

    const angleToPoint = Math.atan2(dy, dx);
    let angleDiff = Math.abs(angleToPoint - this._sentinelAngle);
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

    return angleDiff < 0.06; // ~3.4 degrees tolerance
  }

  private _updateHealthBar(): void {
    this._healthBar.clear();
    if (!this.active) return;

    const barWidth = 24;
    const barHeight = 3;
    const x = this.x - barWidth / 2;
    const y = this.y - this.displayHeight / 2 - 10;

    this._healthBar.fillStyle(0x333333, 0.8);
    this._healthBar.fillRect(x, y, barWidth, barHeight);

    const fillWidth = (this.hp / this.maxHp) * barWidth;
    this._healthBar.fillStyle(this.config.color, 1);
    this._healthBar.fillRect(x, y, fillWidth, barHeight);
  }
}
