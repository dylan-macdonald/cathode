import { sfxr } from 'jsfxr';
import * as presets from './presets';

/** Convert a 24-element slider array to the named Params object jsfxr 1.4 expects. */
const PARAM_KEYS = [
  'wave_type', 'p_env_attack', 'p_env_sustain', 'p_env_punch', 'p_env_decay',
  'p_base_freq', 'p_freq_limit', 'p_freq_ramp', 'p_freq_dramp',
  'p_vib_strength', 'p_vib_speed', 'p_arp_mod', 'p_arp_speed',
  'p_duty', 'p_duty_ramp', 'p_repeat_speed',
  'p_pha_offset', 'p_pha_ramp',
  'p_lpf_freq', 'p_lpf_ramp', 'p_lpf_resonance',
  'p_hpf_freq', 'p_hpf_ramp', 'sound_vol',
] as const;

function arrayToParams(arr: number[]): Record<string, number> {
  const obj: Record<string, number> = {};
  for (let i = 0; i < PARAM_KEYS.length && i < arr.length; i++) {
    obj[PARAM_KEYS[i]] = arr[i];
  }
  return obj;
}

export type SFXKey =
  | 'player_shoot'
  | 'enemy_hit'
  | 'enemy_death_small'
  | 'enemy_death_medium'
  | 'enemy_death_large'
  | 'player_hurt'
  | 'channel_surf'
  | 'menu_select'
  | 'enemy_shoot'
  | 'pickup'
  | 'item_pickup'
  | 'door_unlock'
  | 'room_transition'
  | 'boss_hit'
  | 'boss_phase'
  | 'boss_death'
  | 'wave_clear'
  | 'bomb'
  | 'teleport'
  | 'scan_line_fire'
  | 'color_burst_fire'
  | 'interference_fire'
  | 'channel_change'
  | 'victory'
  | 'boss_bwaaaam'
  | 'shop_purchase'
  | 'achievement'
  | 'whistle'
  | 'rally'
  | 'bass_drop'
  | 'beat_hit'
  | 'synergy'
  | 'challenge_start'
  | 'endless_cycle';

const PRESET_MAP: Record<SFXKey, number[]> = {
  player_shoot: presets.SFX_PLAYER_SHOOT,
  enemy_hit: presets.SFX_ENEMY_HIT,
  enemy_death_small: presets.SFX_ENEMY_DEATH_SMALL,
  enemy_death_medium: presets.SFX_ENEMY_DEATH_MEDIUM,
  enemy_death_large: presets.SFX_ENEMY_DEATH_LARGE,
  player_hurt: presets.SFX_PLAYER_HURT,
  channel_surf: presets.SFX_CHANNEL_SURF,
  menu_select: presets.SFX_MENU_SELECT,
  enemy_shoot: presets.SFX_ENEMY_SHOOT,
  pickup: presets.SFX_PICKUP,
  item_pickup: presets.SFX_ITEM_PICKUP,
  door_unlock: presets.SFX_DOOR_UNLOCK,
  room_transition: presets.SFX_ROOM_TRANSITION,
  boss_hit: presets.SFX_BOSS_HIT,
  boss_phase: presets.SFX_BOSS_PHASE,
  boss_death: presets.SFX_BOSS_DEATH,
  wave_clear: presets.SFX_WAVE_CLEAR,
  bomb: presets.SFX_BOMB,
  teleport: presets.SFX_TELEPORT,
  scan_line_fire: presets.SFX_SCAN_LINE_FIRE,
  color_burst_fire: presets.SFX_COLOR_BURST_FIRE,
  interference_fire: presets.SFX_INTERFERENCE_FIRE,
  channel_change: presets.SFX_CHANNEL_CHANGE,
  victory: presets.SFX_VICTORY,
  boss_bwaaaam: presets.SFX_BOSS_BWAAAAM,
  shop_purchase: presets.SFX_SHOP_PURCHASE,
  achievement: presets.SFX_ACHIEVEMENT,
  whistle: presets.SFX_WHISTLE,
  rally: presets.SFX_RALLY,
  bass_drop: presets.SFX_BASS_DROP,
  beat_hit: presets.SFX_BEAT_HIT,
  synergy: presets.SFX_SYNERGY,
  challenge_start: presets.SFX_CHALLENGE_START,
  endless_cycle: presets.SFX_ENDLESS_CYCLE,
};

const audioCache = new Map<SFXKey, HTMLAudioElement>();

// Polyphony tracking: max concurrent plays per SFX key
const MAX_POLYPHONY = 4;
const _activeSounds = new Map<SFXKey, number>();

// Exported for DebugBridge to read
export const _sfxPlayCounts = new Map<SFXKey, number>();
export let _lastPlayedKey: SFXKey | null = null;

export function generateAllSFX(): void {
  for (const [key, params] of Object.entries(PRESET_MAP)) {
    const url = sfxr.toWave(arrayToParams(params)).dataURI;
    const audio = new Audio(url);
    audio.volume = 0.4;
    audioCache.set(key as SFXKey, audio);
  }
}

export function playSFX(key: SFXKey): void {
  const cached = audioCache.get(key);
  if (!cached) return;

  // Polyphony cap: skip if already at max concurrent plays for this key
  const active = _activeSounds.get(key) ?? 0;
  if (active >= MAX_POLYPHONY) return;

  const sound = cached.cloneNode() as HTMLAudioElement;
  sound.volume = cached.volume;

  // Pitch randomization: ±5%
  sound.playbackRate = 0.95 + Math.random() * 0.1;

  // Track active count
  _activeSounds.set(key, active + 1);
  sound.addEventListener('ended', () => {
    const cur = _activeSounds.get(key) ?? 1;
    _activeSounds.set(key, Math.max(0, cur - 1));
  });

  // Track play counts for debug bridge
  _sfxPlayCounts.set(key, (_sfxPlayCounts.get(key) ?? 0) + 1);
  _lastPlayedKey = key;

  sound.play().catch(() => {});
}
