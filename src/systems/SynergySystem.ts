import { PlayerStats } from '../data/items';

export interface SynergyDef {
  id: string;
  name: string;
  itemIds: string[];
  effect: string;
  statMods: Partial<PlayerStats>;
}

/** 10 named synergy combos. Each requires specific item IDs to be held. */
export const SYNERGY_DEFS: SynergyDef[] = [
  {
    id: 'overclocked',
    name: 'OVERCLOCKED',
    itemIds: ['signal_amplifier', 'speed_dial'],
    effect: '+30% fire rate',
    statMods: { fireRate: 2.0 },
  },
  {
    id: 'full_spectrum_combo',
    name: 'FULL SPECTRUM',
    itemIds: ['color_burst_module', 'full_spectrum'],
    effect: '+2 projectiles',
    statMods: { projectileCount: 2 },
  },
  {
    id: 'ghost_in_the_machine',
    name: 'GHOST IN THE MACHINE',
    itemIds: ['ghost_signal', 'ghost_frame'],
    effect: '+1 piercing, +50% homing',
    statMods: { piercing: 1, homing: 0.5 },
  },
  {
    id: 'crt_overload',
    name: 'CRT OVERLOAD',
    itemIds: ['volume_knob', 'degauss_coil'],
    effect: 'Extra bomb damage + stun',
    statMods: { screenShake: 0.5, knockback: 40 },
  },
  {
    id: 'signal_cascade_combo',
    name: 'SIGNAL CASCADE',
    itemIds: ['signal_amplifier', 'signal_cascade'],
    effect: 'Chain lightning on kill',
    statMods: { damage: 0.2, range: 100 },
  },
  {
    id: 'deep_scan',
    name: 'DEEP SCAN',
    itemIds: ['closed_captioning', 'rabbit_ears'],
    effect: 'Full map + all pickups magnetize',
    statMods: { pickupRange: 120 },
  },
  {
    id: 'retro_fitted',
    name: 'RETRO FITTED',
    itemIds: ['brightness_knob', 'copper_wire', 'screen_guard'],
    effect: 'Common items +50% effectiveness',
    statMods: { damage: 0.15, maxHP: 1 },
  },
  {
    id: 'broadcast_power',
    name: 'BROADCAST POWER',
    itemIds: ['broadcast_tower', 'longer_cable'],
    effect: '+40% range + piercing',
    statMods: { range: 200, piercing: 1 },
  },
  {
    id: 'static_cling',
    name: 'STATIC CLING',
    itemIds: ['static_guard', 'static_charge'],
    effect: 'Retaliatory ring +3 damage',
    statMods: { damage: 0.3, knockback: 20 },
  },
  {
    id: 'picture_perfect',
    name: 'PICTURE PERFECT',
    itemIds: ['picture_in_picture', 'tracking_adjust'],
    effect: 'Full auto-aim + fire rate',
    statMods: { homing: 0.3, fireRate: 1.5 },
  },
];

/**
 * Check which synergies are newly completed given the current item IDs.
 * Returns only synergies not already in the activeSynergies set.
 */
export function checkSynergies(
  heldItemIds: string[],
  activeSynergies: Set<string>,
): SynergyDef[] {
  const newSynergies: SynergyDef[] = [];

  for (const syn of SYNERGY_DEFS) {
    if (activeSynergies.has(syn.id)) continue;
    const allPresent = syn.itemIds.every(id => heldItemIds.includes(id));
    if (allPresent) {
      newSynergies.push(syn);
    }
  }

  return newSynergies;
}
