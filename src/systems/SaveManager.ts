const SAVE_KEY = 'cathode_save_v1';

export interface RunHistoryEntry {
  date: string;
  score: number;
  channelsCleared: number;
  enemiesKilled: number;
  timeSeconds: number;
  victory: boolean;
  weapon: string;
  character: string;
  ascension: number;
}

export interface DailyRunData {
  date: string; // YYYY-MM-DD
  completed: boolean;
  score: number;
  seed: string;
}

export interface WeeklyChallengeData {
  weekSeed: number;
  completed: boolean;
  score: number;
}

export interface SaveData {
  tubes: number;
  totalRuns: number;
  bestFloor: number;
  totalKills: number;
  unlockedChannels: string[];
  unlockedItems: string[];
  unlockedWeapons: string[];
  unlockedCharacters: string[];
  purchasedUpgrades: Record<string, number>;
  achievements: string[];
  ascensionLevel: number;
  maxAscensionReached: number;
  bossesBeaten: string[]; // boss IDs beaten at least once
  runHistory: RunHistoryEntry[];
  dailyRun: DailyRunData | null;
  discoveredItems: string[]; // all item IDs ever picked up
  totalTubesSpent: number;
  favoriteWeapon: string;
  favoriteCharacter: string;
  bestEndlessFloor: number;
  weeklyChallenge: WeeklyChallengeData | null;
}

export function getDefaultSave(): SaveData {
  return {
    tubes: 0,
    totalRuns: 0,
    bestFloor: 0,
    totalKills: 0,
    unlockedChannels: ['static'],
    unlockedItems: [
      'brightness_knob',
      'horizontal_hold',
      'fine_tuning',
      'rabbit_ears',
      'volume_knob',
      'speed_dial',
      'extended_warranty',
      'longer_cable',
      'degauss_coil',
      'tracking_adjust',
    ],
    unlockedWeapons: ['phosphor_beam'],
    unlockedCharacters: ['standard'],
    purchasedUpgrades: {},
    achievements: [],
    ascensionLevel: 0,
    maxAscensionReached: 0,
    bossesBeaten: [],
    runHistory: [],
    dailyRun: null,
    discoveredItems: [],
    totalTubesSpent: 0,
    favoriteWeapon: 'phosphor_beam',
    favoriteCharacter: 'standard',
    bestEndlessFloor: 0,
    weeklyChallenge: null,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return getDefaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    // Merge with defaults so new fields are always present
    const defaults = getDefaultSave();
    return { ...defaults, ...parsed } as SaveData;
  } catch {
    return getDefaultSave();
  }
}

export function saveToCurrent(save: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function resetSave(): SaveData {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
  return getDefaultSave();
}
