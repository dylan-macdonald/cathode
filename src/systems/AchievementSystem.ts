import type { SaveData } from './SaveManager';

export interface RunStats {
  score: number;
  enemiesKilled: number;
  bossHitsTaken: number;
  itemsCollected: number;
  roomsCleared: number;
  roomsNoDamage: number; // rooms cleared without taking damage
  timeSeconds: number;
  channelsCompleted: number;
  victory: boolean;
  weaponUsed: string;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  condition: (stats: RunStats) => boolean;
  reward?: { type: 'unlock_item' | 'unlock_weapon' | 'unlock_channel' | 'unlock_character'; id: string };
}

export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Kill 10 enemies in a single run.',
    condition: (stats: RunStats) => stats.enemiesKilled >= 10,
    reward: { type: 'unlock_item', id: 'tracking_adjust' },
  },
  {
    id: 'channel_surfer',
    name: 'Channel Surfer',
    description: 'Complete a full 3-channel run.',
    condition: (stats: RunStats) => stats.channelsCompleted >= 3,
    reward: { type: 'unlock_channel', id: 'late_night' },
  },
  {
    id: 'speed_run',
    name: 'Speed Runner',
    description: 'Complete CH2 in under 5 minutes.',
    condition: (stats: RunStats) => stats.channelsCompleted >= 1 && stats.timeSeconds < 300,
    reward: { type: 'unlock_weapon', id: 'scan_line' },
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    description: 'Clear 3 rooms without taking damage.',
    condition: (stats: RunStats) => stats.roomsNoDamage >= 3,
    reward: { type: 'unlock_item', id: 'ghost_signal' },
  },
  {
    id: 'hoarder',
    name: 'Hoarder',
    description: 'Collect 10 items in a single run.',
    condition: (stats: RunStats) => stats.itemsCollected >= 10,
    reward: { type: 'unlock_item', id: 'full_spectrum' },
  },
  {
    id: 'boss_slayer',
    name: 'Boss Slayer',
    description: 'Defeat any boss without taking a hit.',
    condition: (stats: RunStats) => stats.bossHitsTaken === 0 && stats.channelsCompleted >= 1,
    reward: { type: 'unlock_weapon', id: 'color_burst' },
  },
  {
    id: 'big_spender',
    name: 'Big Spender',
    description: 'Spend 100 Tubes in shops during a run.',
    condition: (stats: RunStats) => stats.score >= 100,
  },
  {
    id: 'completionist',
    name: 'Completionist',
    description: 'Clear every room in a floor.',
    condition: (stats: RunStats) => stats.roomsCleared >= 30,
    reward: { type: 'unlock_weapon', id: 'interference_pattern' },
  },
  // Phase 4 achievements — character unlocks
  {
    id: 'warm_tubes',
    name: 'Warm Tubes',
    description: 'Complete a 4-channel run.',
    condition: (stats: RunStats) => stats.channelsCompleted >= 4,
    reward: { type: 'unlock_character', id: 'filament' },
  },
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: 'Kill 100 enemies in a single run.',
    condition: (stats: RunStats) => stats.enemiesKilled >= 100,
    reward: { type: 'unlock_character', id: 'cathode_ray' },
  },
  {
    id: 'ghost_run',
    name: 'Ghost Run',
    description: 'Clear 5 rooms without taking damage.',
    condition: (stats: RunStats) => stats.roomsNoDamage >= 5,
    reward: { type: 'unlock_character', id: 'ghost_signal_char' },
  },
  {
    id: 'pixel_perfect',
    name: 'Pixel Perfect',
    description: 'Win a run with 1 HP remaining.',
    condition: (stats: RunStats) => stats.victory && stats.score > 0,
    reward: { type: 'unlock_character', id: 'dead_pixel_char' },
  },
];

export function getAchievementDef(id: string): AchievementDef | undefined {
  return ALL_ACHIEVEMENTS.find((a) => a.id === id);
}

export function checkAchievements(stats: RunStats, save: SaveData): string[] {
  const newlyEarned: string[] = [];

  for (const achievement of ALL_ACHIEVEMENTS) {
    // Skip already earned achievements
    if (save.achievements.includes(achievement.id)) continue;

    // Check if the condition is now met
    if (achievement.condition(stats)) {
      newlyEarned.push(achievement.id);

      // Apply reward to save data if one is defined
      if (achievement.reward) {
        const { type, id } = achievement.reward;
        if (type === 'unlock_item' && !save.unlockedItems.includes(id)) {
          save.unlockedItems.push(id);
        } else if (type === 'unlock_weapon' && !save.unlockedWeapons.includes(id)) {
          save.unlockedWeapons.push(id);
        } else if (type === 'unlock_channel' && !save.unlockedChannels.includes(id)) {
          save.unlockedChannels.push(id);
        } else if (type === 'unlock_character' && !save.unlockedCharacters.includes(id)) {
          save.unlockedCharacters.push(id);
        }
      }
    }
  }

  // Record newly earned achievements in save data
  save.achievements.push(...newlyEarned);

  return newlyEarned;
}
