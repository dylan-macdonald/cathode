import { PlayerStats } from '../data/items';

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  passiveId: string;
  statMods: Partial<PlayerStats>;
  color: number;
  unlockCondition: string;
  unlocked: boolean;
}

export const ALL_CHARACTERS: CharacterDef[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'The default signal.',
    passiveId: 'none',
    statMods: {},
    color: 0xffffff,
    unlockCondition: 'Available from the start.',
    unlocked: true,
  },

  {
    id: 'filament',
    name: 'Filament',
    description: 'Warm tubes from the start.',
    passiveId: 'warm_start',
    statMods: { maxHP: 1, moveSpeed: -15 },
    color: 0xffaa33,
    unlockCondition: 'Clear CH 2 STATIC without taking damage in the boss fight.',
    unlocked: false,
  },

  {
    id: 'cathode_ray',
    name: 'Cathode Ray',
    description: 'Burns bright, burns fast.',
    passiveId: 'overdrive',
    statMods: { damage: 0.3, fireRate: 1, maxHP: -1 },
    color: 0x33ffff,
    unlockCondition: 'Defeat The Dead Channel in under 60 seconds.',
    unlocked: false,
  },

  {
    id: 'ghost_signal_char',
    name: 'Ghost Signal',
    description: 'Hard to pin down.',
    passiveId: 'phase_shift',
    statMods: { moveSpeed: 40, damage: -0.15 },
    color: 0xaaccff,
    unlockCondition: 'Complete a run using Channel Surf at least 50 times.',
    unlocked: false,
  },

  {
    id: 'dead_pixel_char',
    name: 'Dead Pixel',
    description: 'Broken but dangerous.',
    passiveId: 'static_cling',
    statMods: { screenShake: 0.5, damage: 0.1 },
    color: 0x888888,
    unlockCondition: 'Die 10 times.',
    unlocked: false,
  },
];

export function getCharacterDef(id: string): CharacterDef | undefined {
  return ALL_CHARACTERS.find((c) => c.id === id);
}
