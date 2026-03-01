// ── Legacy interface (Phase 2 backward compatibility) ─────────────────────────

export interface ChannelData {
  key: string;
  name: string;
  number: number;
  palette: number[];
  description: string;
}

export const CHANNEL_STATIC: ChannelData = {
  key: 'static',
  name: 'STATIC',
  number: 2,
  palette: [0xffffff, 0xcccccc, 0x999999, 0x666666],
  description: 'White noise. Signal-loss hazard zones.',
};

export const CHANNEL_TEST_PATTERN: ChannelData = {
  key: 'test_pattern',
  name: 'TEST PATTERN',
  number: 4,
  palette: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff],
  description: 'Color bars. Geometric enemies. Rotating beam hazards.',
};

export const CHANNEL_EMERGENCY: ChannelData = {
  key: 'emergency',
  name: 'EMERGENCY',
  number: 11,
  palette: [0xff3333, 0xff0000, 0xcc0000, 0xff6666],
  description: 'Red alert. Siren enemies. Scrolling text walls.',
};

export const CHANNELS = [CHANNEL_STATIC, CHANNEL_TEST_PATTERN, CHANNEL_EMERGENCY];

// ── Phase 3 channel system ────────────────────────────────────────────────────

export interface ChannelPalette {
  bg: number;
  primary: number;
  secondary: number;
  accent: number;
  enemy: number;
}

export interface ChannelDef {
  id: string;
  name: string;
  number: number;
  palette: ChannelPalette;
  enemyPool: string[];
  hazardType: string;
  roomCount: { min: number; max: number };
  bossId: string;
  flavorText: string;
}

export const CHANNEL_REGISTRY: Record<string, ChannelDef> = {
  static: {
    id: 'static',
    name: 'CH 2 STATIC',
    number: 2,
    palette: {
      bg: 0x0a0a0a,
      primary: 0xffffff,
      secondary: 0xcccccc,
      accent: 0x33ff33,
      enemy: 0xcccccc,
    },
    enemyPool: [
      'static_mote',
      'scanline_crawler',
      'signal_ghost',
      'tone_drone',
      'bar_sentinel',
    ],
    hazardType: 'signal_loss',
    roomCount: { min: 9, max: 11 },
    bossId: 'dead_channel',
    flavorText: 'White noise at the edge of reception.',
  },

  test_pattern: {
    id: 'test_pattern',
    name: 'CH 4 TEST PATTERN',
    number: 4,
    palette: {
      bg: 0x0a0a14,
      primary: 0xff0000,
      secondary: 0x00ff00,
      accent: 0x0000ff,
      enemy: 0xffff00,
    },
    enemyPool: [
      'grid_walker',
      'calibration_ring',
      'color_bar',
      'feedback_loop',
      'dead_pixel',
    ],
    hazardType: 'beam_grid',
    roomCount: { min: 10, max: 12 },
    bossId: 'smpte',
    flavorText: 'A broadcast frozen in time. Perfect geometry. Perfect hostility.',
  },

  emergency: {
    id: 'emergency',
    name: 'CH 11 EMERGENCY',
    number: 11,
    palette: {
      bg: 0x1a0000,
      primary: 0xff3333,
      secondary: 0xff0000,
      accent: 0xffaa00,
      enemy: 0xff6633,
    },
    enemyPool: [
      'siren_crawler',
      'alert_text',
      'tone_spike',
      'feedback_loop',
      'dead_pixel',
    ],
    hazardType: 'scrolling_text',
    roomCount: { min: 8, max: 10 },
    bossId: 'the_tone',
    flavorText: 'THIS IS NOT A TEST. THIS IS NOT A TEST.',
  },

  late_night: {
    id: 'late_night',
    name: 'CH 7 LATE NIGHT',
    number: 7,
    palette: {
      bg: 0x0a0a00,
      primary: 0xffcc33,
      secondary: 0xff8800,
      accent: 0x33ff33,
      enemy: 0xffaa33,
    },
    enemyPool: [
      'pitchman',
      'price_tag',
      'infomercial_loop',
      'dead_pixel',
    ],
    hazardType: 'price_ticker',
    roomCount: { min: 10, max: 14 },
    bossId: 'the_offer',
    flavorText: 'But wait — there\'s more.',
  },

  channel_9: {
    id: 'channel_9',
    name: 'CH 9 CARTOON',
    number: 9,
    palette: {
      bg: 0x14001a,
      primary: 0xff66aa,
      secondary: 0xffff33,
      accent: 0x66ffff,
      enemy: 0xff66aa,
    },
    enemyPool: ['bounce_blob', 'rubber_band', 'anvil', 'ink_blot', 'feedback_loop'],
    hazardType: 'painted_tunnels',
    roomCount: { min: 10, max: 13 },
    bossId: 'laugh_track',
    flavorText: 'Saturday morning never ended.',
  },

  channel_13: {
    id: 'channel_13',
    name: 'CH 13 NATURE DOC',
    number: 13,
    palette: {
      bg: 0x001a0a,
      primary: 0x33cc33,
      secondary: 0x88cc33,
      accent: 0xcccc33,
      enemy: 0x33aa33,
    },
    enemyPool: ['spore', 'tendril', 'swarm_unit', 'predator', 'dead_pixel'],
    hazardType: 'overgrowth',
    roomCount: { min: 9, max: 12 },
    bossId: 'the_narrator',
    flavorText: 'Nature always finds a way. To kill you.',
  },
  sports: {
    id: 'sports',
    name: 'CH 3 SPORTS',
    number: 3,
    palette: {
      bg: 0x001a00,
      primary: 0x33cc33,
      secondary: 0xffffff,
      accent: 0xffff00,
      enemy: 0x33ff33,
    },
    enemyPool: ['linebacker', 'puck', 'referee', 'cheerleader', 'mascot'],
    hazardType: 'field_lines',
    roomCount: { min: 9, max: 12 },
    bossId: 'halftime',
    flavorText: 'The final quarter. No timeouts remain.',
  },

  news: {
    id: 'news',
    name: 'CH 5 NEWS',
    number: 5,
    palette: {
      bg: 0x000a1a,
      primary: 0x3366ff,
      secondary: 0xffffff,
      accent: 0xff3333,
      enemy: 0x6699ff,
    },
    enemyPool: ['talking_head', 'ticker', 'camera_drone', 'spin_doctor', 'breaking_news'],
    hazardType: 'headline_scroll',
    roomCount: { min: 10, max: 13 },
    bossId: 'the_anchor',
    flavorText: 'Breaking: You are not expected to survive.',
  },

  music_video: {
    id: 'music_video',
    name: 'CH 6 MUSIC VIDEO',
    number: 6,
    palette: {
      bg: 0x0a001a,
      primary: 0xff33ff,
      secondary: 0x33ffff,
      accent: 0xffff33,
      enemy: 0xff33ff,
    },
    enemyPool: ['bass_drop', 'synth_wave', 'strobe', 'vinyl', 'equalizer'],
    hazardType: 'beat_pulse',
    roomCount: { min: 8, max: 11 },
    bossId: 'the_remix',
    flavorText: 'Drop the beat. Drop your guard.',
  },

  off_air: {
    id: 'off_air',
    name: 'CH 0 OFF AIR',
    number: 0,
    palette: {
      bg: 0x020202,
      primary: 0x333333,
      secondary: 0x111111,
      accent: 0xff0000,
      enemy: 0x444444,
    },
    enemyPool: [
      'static_mote',
      'signal_ghost',
      'bar_sentinel',
      'dead_pixel',
    ],
    hazardType: 'void',
    roomCount: { min: 5, max: 5 }, // gauntlet corridor — exactly 5 arenas
    bossId: 'signal_zero',
    flavorText: 'Beyond the last channel. Nothing remains.',
  },
};

export function getUnlockedChannels(unlockedIds: string[]): ChannelDef[] {
  return unlockedIds
    .filter(id => id in CHANNEL_REGISTRY)
    .map(id => CHANNEL_REGISTRY[id]);
}
