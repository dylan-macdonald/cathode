import { PlayerStats, defaultStats, ItemDef, ItemEventHook, ItemEventContext } from '../data/items';

export class ItemSystem {
  stats: PlayerStats;
  collectedItems: ItemDef[] = [];
  bombs = 0;
  hasAfterimage = false;
  hasRevealMap = false;
  hasRevive = false;
  tubes = 0;
  private _tempDamageBoost = 0;
  private _tempDamageTimer = 0;
  private _tempFireRateBoost = 0;
  private _tempFireRateTimer = 0;

  constructor() {
    this.stats = defaultStats();
  }

  applyItem(item: ItemDef): void {
    this.collectedItems.push(item);

    // Apply stat modifications (additive)
    for (const [key, value] of Object.entries(item.statMods)) {
      const statKey = key as keyof PlayerStats;
      if (statKey in this.stats && typeof value === 'number') {
        (this.stats[statKey] as number) += value;
      }
    }

    // Special: Signal Splitter doubles projectileCount
    if (item.id === 'signal_splitter') {
      this.stats.projectileCount = Math.min(this.stats.projectileCount * 2, 8);
    }

    // Handle special effects
    if (item.special === 'bombs') {
      this.bombs += item.specialValue ?? 2;
    }
    if (item.special === 'afterimage' && item.id === 'afterimage') {
      this.hasAfterimage = true;
    }
    if (item.special === 'reveal_map') {
      this.hasRevealMap = true;
    }
    if (item.special === 'revive') {
      this.hasRevive = true;
    }

    // Clamp stats to sane values
    this.stats.damage = Math.max(0.1, this.stats.damage);
    this.stats.fireRate = Math.max(0.5, this.stats.fireRate);
    // Diminishing returns above 6 shots/sec
    if (this.stats.fireRate > 6) {
      this.stats.fireRate = 6 + (this.stats.fireRate - 6) * 0.5;
    }
    this.stats.projectileSpeed = Math.max(100, this.stats.projectileSpeed);
    this.stats.projectileSize = Math.max(0.3, this.stats.projectileSize);
    this.stats.range = Math.max(100, this.stats.range);
    this.stats.projectileCount = Math.max(1, Math.floor(this.stats.projectileCount));
    this.stats.spreadAngle = Math.max(0, this.stats.spreadAngle);
    this.stats.piercing = Math.max(0, Math.floor(this.stats.piercing));
    this.stats.homing = Math.min(1, Math.max(0, this.stats.homing));
    this.stats.moveSpeed = Math.max(80, this.stats.moveSpeed);
    this.stats.surfCooldown = Math.max(300, this.stats.surfCooldown);
    this.stats.maxHP = Math.max(1, this.stats.maxHP);
    this.stats.pickupRange = Math.max(20, this.stats.pickupRange);
    this.stats.screenShake = Math.max(0, this.stats.screenShake);
    this.stats.trailLength = Math.max(0, Math.floor(this.stats.trailLength));
  }

  applyTemporaryDamageBoost(amount: number, durationMs: number): void {
    this._tempDamageBoost = amount;
    this._tempDamageTimer = durationMs;
  }

  getEffectiveDamage(): number {
    return this.stats.damage + this._tempDamageBoost;
  }

  getFireCooldown(): number {
    const effectiveRate = this.stats.fireRate + this._tempFireRateBoost;
    return 1000 / effectiveRate;
  }

  applyTemporaryFireRateBoost(amount: number, durationMs: number): void {
    this._tempFireRateBoost = amount;
    this._tempFireRateTimer = durationMs;
  }

  update(delta: number): void {
    if (this._tempDamageTimer > 0) {
      this._tempDamageTimer -= delta;
      if (this._tempDamageTimer <= 0) {
        this._tempDamageBoost = 0;
        this._tempDamageTimer = 0;
      }
    }
    if (this._tempFireRateTimer > 0) {
      this._tempFireRateTimer -= delta;
      if (this._tempFireRateTimer <= 0) {
        this._tempFireRateBoost = 0;
        this._tempFireRateTimer = 0;
      }
    }
  }

  /** Fire all onKill hooks */
  fireOnKill(ctx: ItemEventContext): void {
    for (const item of this.collectedItems) {
      if (item.onKill) item.onKill(ctx);
    }
  }

  /** Fire all onHit hooks */
  fireOnHit(ctx: ItemEventContext): void {
    for (const item of this.collectedItems) {
      if (item.onHit) item.onHit(ctx);
    }
  }

  /** Fire all onPlayerHurt hooks */
  fireOnPlayerHurt(ctx: ItemEventContext): void {
    for (const item of this.collectedItems) {
      if (item.onPlayerHurt) item.onPlayerHurt(ctx);
    }
  }

  /** Fire all onRoomClear hooks */
  fireOnRoomClear(ctx: ItemEventContext): void {
    for (const item of this.collectedItems) {
      if (item.onRoomClear) item.onRoomClear(ctx);
    }
  }

  /** Fire all onShoot hooks */
  fireOnShoot(ctx: ItemEventContext): void {
    for (const item of this.collectedItems) {
      if (item.onShoot) item.onShoot(ctx);
    }
  }

  /** Fire all onSurf hooks */
  fireOnSurf(ctx: ItemEventContext): void {
    for (const item of this.collectedItems) {
      if (item.onSurf) item.onSurf(ctx);
    }
  }

  /** Check if any collected item has a specific hook */
  hasHook(hookName: 'onKill' | 'onHit' | 'onPlayerHurt' | 'onRoomClear' | 'onShoot' | 'onSurf'): boolean {
    return this.collectedItems.some(item => item[hookName] != null);
  }

  /** Check if a specific item ID is collected */
  hasItem(id: string): boolean {
    return this.collectedItems.some(item => item.id === id);
  }

  canAfford(cost: number): boolean {
    return this.tubes >= cost;
  }

  spend(cost: number): boolean {
    if (this.tubes < cost) return false;
    this.tubes -= cost;
    return true;
  }

  useBomb(): boolean {
    if (this.bombs <= 0) return false;
    this.bombs--;
    return true;
  }
}
