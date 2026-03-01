export interface BossDef {
  id: string;
  name: string;
  channelId: string;
  hp: number;
  phases: number;
  displaySize: { width: number; height: number };
  flavorText: string;
}

export const BOSS_DEFS: Record<string, BossDef> = {
  dead_channel: {
    id: 'dead_channel',
    name: 'THE DEAD CHANNEL',
    channelId: 'static',
    hp: 100,
    phases: 3,
    displaySize: { width: 200, height: 150 },
    flavorText: 'Nothing but noise.',
  },
  smpte: {
    id: 'smpte',
    name: 'SMPTE',
    channelId: 'test_pattern',
    hp: 120,
    phases: 3,
    displaySize: { width: 280, height: 80 },
    flavorText: 'Please stand by.',
  },
  the_tone: {
    id: 'the_tone',
    name: 'THE TONE',
    channelId: 'emergency',
    hp: 110,
    phases: 3,
    displaySize: { width: 160, height: 160 },
    flavorText: 'This is a test.',
  },
  the_offer: {
    id: 'the_offer',
    name: 'THE OFFER',
    channelId: 'late_night',
    hp: 100,
    phases: 3,
    displaySize: { width: 180, height: 120 },
    flavorText: "But wait, there's more!",
  },
  laugh_track: {
    id: 'laugh_track',
    name: 'THE LAUGH TRACK',
    channelId: 'channel_9',
    hp: 130,
    phases: 3,
    displaySize: { width: 200, height: 200 },
    flavorText: 'Ha ha ha ha ha.',
  },
  the_narrator: {
    id: 'the_narrator',
    name: 'THE NARRATOR',
    channelId: 'channel_13',
    hp: 140,
    phases: 3,
    displaySize: { width: 220, height: 180 },
    flavorText: 'And then, the subject perished.',
  },
  halftime: {
    id: 'halftime',
    name: 'THE HALFTIME SHOW',
    channelId: 'sports',
    hp: 120,
    phases: 3,
    displaySize: { width: 240, height: 160 },
    flavorText: 'The crowd goes wild.',
  },
  the_anchor: {
    id: 'the_anchor',
    name: 'THE ANCHOR',
    channelId: 'news',
    hp: 150,
    phases: 3,
    displaySize: { width: 260, height: 140 },
    flavorText: 'And now, the final broadcast.',
  },
  the_remix: {
    id: 'the_remix',
    name: 'THE REMIX',
    channelId: 'music_video',
    hp: 180,
    phases: 3,
    displaySize: { width: 200, height: 200 },
    flavorText: 'Feel the bass. Fear the drop.',
  },
  signal_zero: {
    id: 'signal_zero',
    name: 'SIGNAL ZERO',
    channelId: 'off_air',
    hp: 200,
    phases: 3,
    displaySize: { width: 240, height: 240 },
    flavorText: 'The void at the end of all signals.',
  },
};
