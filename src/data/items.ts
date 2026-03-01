export interface PlayerStats {
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  projectileSize: number;
  range: number;
  projectileCount: number;
  spreadAngle: number;
  piercing: number;
  homing: number;
  knockback: number;
  moveSpeed: number;
  surfCooldown: number;
  maxHP: number;
  pickupRange: number;
  screenShake: number;
  trailLength: number;
}

export function defaultStats(): PlayerStats {
  return {
    damage: 1.0,
    fireRate: 4,
    projectileSpeed: 400,
    projectileSize: 1.0,
    range: 500,
    projectileCount: 1,
    spreadAngle: 0,
    piercing: 0,
    homing: 0,
    knockback: 50,
    moveSpeed: 200,
    surfCooldown: 1500,
    maxHP: 5,
    pickupRange: 80,
    screenShake: 1.0,
    trailLength: 0,
  };
}

export type Rarity = 'common' | 'uncommon' | 'rare';

/** Context passed to item event hooks */
export interface ItemEventContext {
  scene: unknown; // Phaser.Scene — kept as unknown to avoid circular imports
  playerX: number;
  playerY: number;
  playerHP: number;
  playerMaxHP: number;
  damage: number; // damage dealt or received, depending on event
  enemyX?: number;
  enemyY?: number;
  enemyKey?: string;
}

/** Event hook function signature */
export type ItemEventHook = (ctx: ItemEventContext) => void;

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  statMods: Partial<PlayerStats>;
  // Special effects (non-stat-based)
  special?: 'bombs' | 'afterimage' | 'reveal_map' | 'hp_sacrifice' | 'revive';
  specialValue?: number;
  color: number; // display tint
  // Event hooks (Phase 4)
  onKill?: ItemEventHook;
  onHit?: ItemEventHook;
  onPlayerHurt?: ItemEventHook;
  onRoomClear?: ItemEventHook;
  onShoot?: ItemEventHook;
  onSurf?: ItemEventHook;
}

export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0xcccccc,
  uncommon: 0x33ff33,
  rare: 0xffaa33,
};

export const RARITY_COST: Record<Rarity, number> = {
  common: 15,
  uncommon: 30,
  rare: 50,
};

export const ALL_ITEMS: ItemDef[] = [
  // ── COMMON (12) ──────────────────────────────────────────────
  {
    id: 'brightness_knob',
    name: 'Brightness Knob',
    description: 'Turn it up.',
    rarity: 'common',
    statMods: { damage: 0.15 },
    color: 0xffffff,
  },
  {
    id: 'horizontal_hold',
    name: 'Horizontal Hold',
    description: 'Wider signal.',
    rarity: 'uncommon',
    statMods: { spreadAngle: 15, projectileCount: 1 },
    color: 0x88ff88,
  },
  {
    id: 'fine_tuning',
    name: 'Fine Tuning',
    description: 'Precision reception.',
    rarity: 'common',
    statMods: { projectileSpeed: 100, homing: 0.1 },
    color: 0x8888ff,
  },
  {
    id: 'rabbit_ears',
    name: 'Rabbit Ears',
    description: 'Better reception.',
    rarity: 'common',
    statMods: { pickupRange: 60 },
    color: 0xcccccc,
  },
  {
    id: 'volume_knob',
    name: 'Volume Knob',
    description: 'LOUDER.',
    rarity: 'common',
    statMods: { screenShake: 0.5, knockback: 30 },
    color: 0xff8833,
  },
  {
    id: 'speed_dial',
    name: 'Speed Dial',
    description: 'Faster signal.',
    rarity: 'common',
    statMods: { fireRate: 1.5 },
    color: 0xffff33,
  },
  {
    id: 'extended_warranty',
    name: 'Extended Warranty',
    description: 'Surprisingly useful.',
    rarity: 'common',
    statMods: { maxHP: 1 },
    color: 0xff3333,
  },
  {
    id: 'longer_cable',
    name: 'Longer Cable',
    description: 'Extra reach.',
    rarity: 'common',
    statMods: { range: 200 },
    color: 0x666666,
  },
  {
    id: 'copper_wire',
    name: 'Copper Wire',
    description: 'Basic but effective.',
    rarity: 'common',
    statMods: { damage: 0.1, range: 50 },
    color: 0xcc8833,
  },
  {
    id: 'screen_guard',
    name: 'Screen Guard',
    description: 'Tough glass.',
    rarity: 'common',
    statMods: { maxHP: 0.5, knockback: 10 },
    color: 0x88cccc,
  },
  {
    id: 'quick_tune',
    name: 'Quick Tune',
    description: 'Faster channel surfing.',
    rarity: 'common',
    statMods: { surfCooldown: -300 },
    color: 0x33ccff,
  },
  {
    id: 'signal_boost',
    name: 'Signal Boost',
    description: 'Amplified.',
    rarity: 'common',
    statMods: { damage: 0.08, projectileSize: 0.2 },
    color: 0xddddff,
  },

  // ── UNCOMMON (8) ─────────────────────────────────────────────
  {
    id: 'degauss_coil',
    name: 'Degauss Coil',
    description: 'Clears the field.',
    rarity: 'uncommon',
    statMods: {},
    special: 'bombs',
    specialValue: 2,
    color: 0x33ff33,
  },
  {
    id: 'tracking_adjust',
    name: 'Tracking Adjust',
    description: 'Locks on.',
    rarity: 'uncommon',
    statMods: { homing: 0.35 },
    color: 0xff33ff,
  },
  {
    id: 'color_burst_module',
    name: 'Color Burst Module',
    description: 'RGB overload.',
    rarity: 'uncommon',
    statMods: { projectileCount: 2, spreadAngle: 25, damage: -0.05 },
    color: 0xff3333,
  },
  {
    id: 'ghost_signal',
    name: 'Ghost Signal',
    description: 'Passes through.',
    rarity: 'uncommon',
    statMods: { piercing: 1 },
    color: 0x88ffff,
  },
  {
    id: 'phosphor_burn',
    name: 'Phosphor Burn',
    description: 'Leaves a mark.',
    rarity: 'uncommon',
    statMods: { trailLength: 3 },
    color: 0x33ff33,
  },
  {
    id: 'power_surge',
    name: 'Power Surge',
    description: 'Overwhelming current.',
    rarity: 'uncommon',
    statMods: { damage: 0.4, fireRate: -0.5 },
    color: 0xffff00,
  },
  {
    id: 'afterimage',
    name: 'Afterimage',
    description: 'Echo signal.',
    rarity: 'uncommon',
    statMods: {},
    special: 'afterimage',
    color: 0xaaaaff,
  },
  {
    id: 'overclock',
    name: 'Overclock',
    description: 'Everything faster.',
    rarity: 'uncommon',
    statMods: { moveSpeed: 40, fireRate: 1, surfCooldown: -200 },
    color: 0xff8800,
  },

  // ── RARE (5) ─────────────────────────────────────────────────
  {
    id: 'full_spectrum',
    name: 'Full Spectrum',
    description: 'Every frequency at once.',
    rarity: 'rare',
    statMods: { projectileCount: 4, spreadAngle: 60, damage: 0.15 },
    color: 0xffffff,
  },
  {
    id: 'satellite_dish',
    name: 'Satellite Dish',
    description: 'Never misses.',
    rarity: 'rare',
    statMods: { homing: 0.7, range: 300 },
    color: 0x3333ff,
  },
  {
    id: 'crt_meltdown',
    name: 'CRT Meltdown',
    description: 'Dangerously hot.',
    rarity: 'rare',
    statMods: { damage: 0.5, screenShake: 1.0 },
    special: 'hp_sacrifice',
    specialValue: 0.5,
    color: 0xff3300,
  },
  {
    id: 'signal_splitter',
    name: 'Signal Splitter',
    description: 'Divide and conquer.',
    rarity: 'rare',
    statMods: { damage: -0.15 },
    // Special: doubles projectileCount — handled in applyItem
    special: 'afterimage', // reuse — but we'll handle splitter specially in ItemSystem
    color: 0xffff33,
  },
  {
    id: 'closed_captioning',
    name: 'Closed Captioning',
    description: 'See everything.',
    rarity: 'rare',
    statMods: { pickupRange: 100, damage: 0.1 },
    special: 'reveal_map',
    color: 0xffffff,
  },

  // ── PHASE 4 COMMON (8) ─────────────────────────────────────
  {
    id: 'replacement_fuse',
    name: 'Replacement Fuse',
    description: 'One second chance.',
    rarity: 'common',
    statMods: {},
    special: 'revive',
    specialValue: 1,
    color: 0xffcc33,
  },
  {
    id: 'cathode_coating',
    name: 'Cathode Coating',
    description: 'Damage scales with HP.',
    rarity: 'common',
    statMods: { damage: 0.05 },
    color: 0x88ff88,
    onHit: (ctx) => {
      // Bonus damage when at high HP: +0.2 if HP > 80%
      if (ctx.playerHP / ctx.playerMaxHP > 0.8) {
        ctx.damage += 0.2;
      }
    },
  },
  {
    id: 'warm_capacitor',
    name: 'Warm Capacitor',
    description: 'Fire rate increases over time.',
    rarity: 'common',
    statMods: { fireRate: 0.5 },
    color: 0xff8855,
  },
  {
    id: 'static_charge',
    name: 'Static Charge',
    description: 'Surfing sparks nearby enemies.',
    rarity: 'common',
    statMods: { surfCooldown: -100 },
    color: 0xaaaaff,
    onSurf: () => {
      // Damage is applied by GameScene when it detects this hook exists
    },
  },
  {
    id: 'wide_band',
    name: 'Wide Band',
    description: 'More spread, more coverage.',
    rarity: 'common',
    statMods: { spreadAngle: 20, projectileCount: 1, damage: -0.05 },
    color: 0x55ff55,
  },
  {
    id: 'tinted_glass',
    name: 'Tinted Glass',
    description: 'Slight protection, slight style.',
    rarity: 'common',
    statMods: { maxHP: 0.5 },
    color: 0x8888aa,
  },
  {
    id: 'signal_amplifier',
    name: 'Signal Amplifier',
    description: 'Bigger projectiles.',
    rarity: 'common',
    statMods: { projectileSize: 0.4, knockback: 15 },
    color: 0xddffdd,
  },
  {
    id: 'grounding_wire',
    name: 'Grounding Wire',
    description: 'Steady hands, steady aim.',
    rarity: 'common',
    statMods: { homing: 0.08, screenShake: -0.3 },
    color: 0x888888,
  },

  // ── PHASE 4 UNCOMMON (10) ──────────────────────────────────
  {
    id: 'static_guard',
    name: 'Static Guard',
    description: 'Retaliatory ring on damage.',
    rarity: 'uncommon',
    statMods: {},
    color: 0x33ccff,
    onPlayerHurt: () => {
      // GameScene fires a ring of 8 projectiles from player position
    },
  },
  {
    id: 'picture_in_picture',
    name: 'Picture-in-Picture',
    description: 'Auto-aim nearest enemy.',
    rarity: 'uncommon',
    statMods: { homing: 0.25 },
    color: 0xffaaff,
    onShoot: () => {
      // Enhances homing — handled by stat mod
    },
  },
  {
    id: 'signal_cascade',
    name: 'Signal Cascade',
    description: 'Kills chain to nearby.',
    rarity: 'uncommon',
    statMods: { damage: 0.1 },
    color: 0xff33ff,
    onKill: () => {
      // GameScene deals 1 damage to enemies within 80px of killed enemy
    },
  },
  {
    id: 'burn_in',
    name: 'Burn-In',
    description: 'Lingering damage zones.',
    rarity: 'uncommon',
    statMods: { trailLength: 2, damage: 0.05 },
    color: 0xffaa33,
  },
  {
    id: 'power_conditioner',
    name: 'Power Conditioner',
    description: 'Heal on room clear.',
    rarity: 'uncommon',
    statMods: {},
    color: 0x33ff33,
    onRoomClear: () => {
      // GameScene heals player 1 HP
    },
  },
  {
    id: 'scan_converter',
    name: 'Scan Converter',
    description: 'Convert speed to damage.',
    rarity: 'uncommon',
    statMods: { damage: 0.3, moveSpeed: -30 },
    color: 0xcc33ff,
  },
  {
    id: 'tube_magnet',
    name: 'Tube Magnet',
    description: 'Double tube drops.',
    rarity: 'uncommon',
    statMods: { pickupRange: 40 },
    color: 0xffcc00,
    onKill: () => {
      // GameScene doubles tube pickup chance from killed enemy
    },
  },
  {
    id: 'ghost_frame',
    name: 'Ghost Frame',
    description: 'Brief invulnerability on kill.',
    rarity: 'uncommon',
    statMods: {},
    color: 0xaaffff,
    onKill: () => {
      // GameScene grants 200ms invulnerability
    },
  },
  {
    id: 'refresh_rate',
    name: 'Refresh Rate',
    description: 'Fire rate after surf.',
    rarity: 'uncommon',
    statMods: { fireRate: 0.3 },
    color: 0x55ccff,
    onSurf: () => {
      // GameScene applies 3s fire rate boost
    },
  },
  {
    id: 'vertical_sync',
    name: 'Vertical Sync',
    description: 'Projectiles pierce one more.',
    rarity: 'uncommon',
    statMods: { piercing: 1, projectileSpeed: -30 },
    color: 0x33ffaa,
  },

  // ── PHASE 4 RARE (7) ───────────────────────────────────────
  {
    id: 'time_base_corrector',
    name: 'Time Base Corrector',
    description: 'Bullet-time on low HP.',
    rarity: 'rare',
    statMods: { damage: 0.15 },
    color: 0xffff00,
    onPlayerHurt: () => {
      // GameScene slows enemy speed when HP < 30%
    },
  },
  {
    id: 'broadcast_tower',
    name: 'Broadcast Tower',
    description: 'Massive range, massive presence.',
    rarity: 'rare',
    statMods: { range: 400, projectileSize: 0.3, projectileSpeed: 80 },
    color: 0xff3333,
  },
  {
    id: 'emergency_channel',
    name: 'Emergency Channel',
    description: 'Bomb on death.',
    rarity: 'rare',
    statMods: { maxHP: 1 },
    color: 0xff0000,
    onPlayerHurt: () => {
      // GameScene triggers bomb if HP reaches 0 (before death)
    },
  },
  {
    id: 'noise_floor',
    name: 'Noise Floor',
    description: 'Damage aura in cleared rooms.',
    rarity: 'rare',
    statMods: { damage: 0.2 },
    color: 0xaaaaaa,
    onRoomClear: () => {
      // GameScene grants persistent damage aura for next room
    },
  },
  {
    id: 'cross_talk',
    name: 'Cross-Talk',
    description: 'Enemies hurt each other.',
    rarity: 'rare',
    statMods: {},
    color: 0xff88ff,
    onHit: () => {
      // GameScene causes 30% of hit damage to splash to nearby enemies
    },
  },
  {
    id: 'antenna_array',
    name: 'Antenna Array',
    description: 'Triple shot + homing.',
    rarity: 'rare',
    statMods: { projectileCount: 2, homing: 0.3, spreadAngle: 30 },
    color: 0x33ff33,
  },
  {
    id: 'overclocked_crt',
    name: 'Overclocked CRT',
    description: 'Everything cranked to 11.',
    rarity: 'rare',
    statMods: { damage: 0.4, fireRate: 1.5, moveSpeed: 30, screenShake: 1.5 },
    special: 'hp_sacrifice',
    specialValue: 1,
    color: 0xffffff,
  },
];

export function getItemsByRarity(rarity: Rarity): ItemDef[] {
  return ALL_ITEMS.filter(item => item.rarity === rarity);
}

export function getRandomItem(exclude: string[] = [], unlockedIds?: string[]): ItemDef {
  let available = ALL_ITEMS.filter(item => !exclude.includes(item.id));
  // If unlock filter is provided, restrict to unlocked items only
  if (unlockedIds && unlockedIds.length > 0) {
    const filtered = available.filter(item => unlockedIds.includes(item.id));
    if (filtered.length > 0) available = filtered;
    // If no unlocked items available, fall through to full pool as safety net
  }
  if (available.length === 0) return ALL_ITEMS[0]; // fallback

  // Weighted by rarity: common 60%, uncommon 30%, rare 10%
  const roll = Math.random();
  let pool: ItemDef[];
  if (roll < 0.1) {
    pool = available.filter(i => i.rarity === 'rare');
  } else if (roll < 0.4) {
    pool = available.filter(i => i.rarity === 'uncommon');
  } else {
    pool = available.filter(i => i.rarity === 'common');
  }
  if (pool.length === 0) pool = available;

  return pool[Math.floor(Math.random() * pool.length)];
}
