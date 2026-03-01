export interface AscensionModifiers {
  enemyHPMultiplier: number;
  enemySpeedMultiplier: number;
  enemyCountMultiplier: number;
  projSpeedMultiplier: number;
  shopCostMultiplier: number;
  itemRoomReduction: number;
  playerDamageMultiplier: number;
  surfCooldownMultiplier: number;
  bossExtraPhase: boolean;
  forceSignalZero: boolean;
}

function baseModifiers(): AscensionModifiers {
  return {
    enemyHPMultiplier: 1,
    enemySpeedMultiplier: 1,
    enemyCountMultiplier: 1,
    projSpeedMultiplier: 1,
    shopCostMultiplier: 1,
    itemRoomReduction: 0,
    playerDamageMultiplier: 1,
    surfCooldownMultiplier: 1,
    bossExtraPhase: false,
    forceSignalZero: false,
  };
}

export const ASCENSION_LEVELS: AscensionModifiers[] = [
  // Level 1
  {
    ...baseModifiers(),
    enemyHPMultiplier: 1.15,
    projSpeedMultiplier: 1.1,
    shopCostMultiplier: 1.25,
  },
  // Level 2
  {
    ...baseModifiers(),
    enemyHPMultiplier: 1.15,
    projSpeedMultiplier: 1.1,
    shopCostMultiplier: 1.25,
    enemyCountMultiplier: 1.2,
  },
  // Level 3
  {
    ...baseModifiers(),
    enemyHPMultiplier: 1.15,
    projSpeedMultiplier: 1.1,
    shopCostMultiplier: 1.25,
    enemyCountMultiplier: 1.2,
    playerDamageMultiplier: 1.5,
  },
  // Level 4
  {
    ...baseModifiers(),
    enemyHPMultiplier: 1.15,
    projSpeedMultiplier: 1.1,
    shopCostMultiplier: 1.25,
    enemyCountMultiplier: 1.2,
    playerDamageMultiplier: 1.5,
    surfCooldownMultiplier: 1.25,
    itemRoomReduction: 0.2,
  },
  // Level 5
  {
    ...baseModifiers(),
    enemyHPMultiplier: 1.3,
    enemySpeedMultiplier: 1.1,
    projSpeedMultiplier: 1.1,
    shopCostMultiplier: 1.25,
    enemyCountMultiplier: 1.2,
    playerDamageMultiplier: 1.5,
    surfCooldownMultiplier: 1.25,
    itemRoomReduction: 0.2,
  },
  // Level 6
  {
    ...baseModifiers(),
    enemyHPMultiplier: 1.3,
    enemySpeedMultiplier: 1.1,
    projSpeedMultiplier: 1.1,
    shopCostMultiplier: 1.5,
    enemyCountMultiplier: 1.2,
    playerDamageMultiplier: 2.0,
    surfCooldownMultiplier: 1.25,
    itemRoomReduction: 0.2,
  },
  // Level 7
  {
    ...baseModifiers(),
    enemyHPMultiplier: 1.3,
    enemySpeedMultiplier: 1.1,
    projSpeedMultiplier: 1.1,
    shopCostMultiplier: 1.5,
    enemyCountMultiplier: 1.4,
    playerDamageMultiplier: 2.0,
    surfCooldownMultiplier: 1.5,
    itemRoomReduction: 0.2,
  },
  // Level 8
  {
    ...baseModifiers(),
    enemyHPMultiplier: 1.5,
    enemySpeedMultiplier: 1.1,
    projSpeedMultiplier: 1.1,
    shopCostMultiplier: 1.5,
    enemyCountMultiplier: 1.4,
    playerDamageMultiplier: 2.0,
    surfCooldownMultiplier: 1.5,
    itemRoomReduction: 0.4,
  },
  // Level 9
  {
    ...baseModifiers(),
    enemyHPMultiplier: 1.5,
    enemySpeedMultiplier: 1.2,
    projSpeedMultiplier: 1.1,
    shopCostMultiplier: 1.5,
    enemyCountMultiplier: 1.4,
    playerDamageMultiplier: 2.0,
    surfCooldownMultiplier: 1.5,
    itemRoomReduction: 0.4,
    bossExtraPhase: true,
  },
  // Level 10
  {
    enemyHPMultiplier: 2.0,
    enemySpeedMultiplier: 1.5,
    enemyCountMultiplier: 1.5,
    projSpeedMultiplier: 1.5,
    shopCostMultiplier: 2.0,
    itemRoomReduction: 0.5,
    playerDamageMultiplier: 2.5,
    surfCooldownMultiplier: 2.0,
    bossExtraPhase: true,
    forceSignalZero: true,
  },
];

export const MAX_ASCENSION = 10;

export function getAscensionModifiers(level: number): AscensionModifiers {
  if (level <= 0) {
    return baseModifiers();
  }
  const clamped = Math.min(level, MAX_ASCENSION);
  return { ...ASCENSION_LEVELS[clamped - 1] };
}

export function getAscensionTubeBonus(level: number): number {
  return 1 + level * 0.15;
}
