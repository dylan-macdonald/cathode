import { PlayerStats } from '../data/items';

export interface ChallengeDef {
  id: string;
  name: string;
  description: string;
  /** Partial stat overrides applied at run start */
  statMods: Partial<PlayerStats>;
  /** Extra modifiers (enemy HP, speed, etc.) */
  enemyHPMultiplier: number;
  enemySpeedMultiplier: number;
  /** Channels override (null = use default) */
  channelCount: number | null;
  /** Difficulty scale override (null = use default) */
  difficultyScale: number | null;
  weekSeed: number;
}

/** 8 challenge templates that rotate weekly. */
const CHALLENGE_TEMPLATES: Omit<ChallengeDef, 'weekSeed'>[] = [
  {
    id: 'glass_cannon',
    name: 'GLASS CANNON',
    description: '1 HP, 3x damage. One hit and you\'re done.',
    statMods: { maxHP: -4, damage: 2.0 },
    enemyHPMultiplier: 1,
    enemySpeedMultiplier: 1,
    channelCount: null,
    difficultyScale: null,
  },
  {
    id: 'speed_run',
    name: 'SPEED RUN',
    description: 'Everything moves 2x faster. Including you.',
    statMods: { moveSpeed: 200 },
    enemyHPMultiplier: 1,
    enemySpeedMultiplier: 2,
    channelCount: null,
    difficultyScale: null,
  },
  {
    id: 'pacifist_start',
    name: 'PACIFIST START',
    description: 'No weapon for the first 3 rooms. Dodge only.',
    statMods: { damage: -0.9 }, // Near-zero damage to start
    enemyHPMultiplier: 0.7,
    enemySpeedMultiplier: 1,
    channelCount: null,
    difficultyScale: null,
  },
  {
    id: 'bounty_hunter',
    name: 'BOUNTY HUNTER',
    description: 'Only bosses drop items. Regular enemies drop nothing.',
    statMods: { damage: 0.3 },
    enemyHPMultiplier: 1,
    enemySpeedMultiplier: 1,
    channelCount: null,
    difficultyScale: null,
  },
  {
    id: 'minimalist',
    name: 'MINIMALIST',
    description: 'No item pickups allowed. Pure skill.',
    statMods: { damage: 0.2, moveSpeed: 20 },
    enemyHPMultiplier: 0.8,
    enemySpeedMultiplier: 1,
    channelCount: null,
    difficultyScale: null,
  },
  {
    id: 'titan_mode',
    name: 'TITAN MODE',
    description: 'Enemies have 3x HP. Bring patience.',
    statMods: { damage: 0.15 },
    enemyHPMultiplier: 3,
    enemySpeedMultiplier: 0.8,
    channelCount: null,
    difficultyScale: null,
  },
  {
    id: 'ricochet_run',
    name: 'RICOCHET RUN',
    description: 'All projectiles bounce off walls.',
    statMods: { piercing: 2 },
    enemyHPMultiplier: 1,
    enemySpeedMultiplier: 1,
    channelCount: null,
    difficultyScale: null,
  },
  {
    id: 'marathon',
    name: 'MARATHON',
    description: '12 channels, half difficulty. An endurance test.',
    statMods: { maxHP: 2 },
    enemyHPMultiplier: 0.5,
    enemySpeedMultiplier: 1,
    channelCount: 12,
    difficultyScale: 0.5,
  },
];

/** Get the current week number (integer, deterministic). */
export function getCurrentWeekSeed(): number {
  return Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
}

/** Get the challenge for a given week seed. */
export function getWeeklyChallenge(weekSeed?: number): ChallengeDef {
  const seed = weekSeed ?? getCurrentWeekSeed();
  const index = seed % CHALLENGE_TEMPLATES.length;
  return { ...CHALLENGE_TEMPLATES[index], weekSeed: seed };
}

/** Check if the player has already completed this week's challenge. */
export function hasCompletedWeekly(
  savedWeekSeed: number | undefined,
  savedCompleted: boolean | undefined,
): boolean {
  if (savedWeekSeed == null || savedCompleted == null) return false;
  return savedWeekSeed === getCurrentWeekSeed() && savedCompleted;
}
