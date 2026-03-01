export type ColorblindMode = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';

export interface GameSettings {
  screenShakeIntensity: number;
  sfxVolume: number;
  musicVolume: number;
  highContrast: boolean;
  reduceMotion: boolean;
  colorblindMode: ColorblindMode;
  gamepadEnabled: boolean;
  autoFire: boolean;
  practiceMode: boolean;
}

export const SETTINGS_KEY = 'cathode_settings_v1';

export function getDefaultSettings(): GameSettings {
  return {
    screenShakeIntensity: 1.0,
    sfxVolume: 0.8,
    musicVolume: 0.5,
    highContrast: false,
    reduceMotion: false,
    colorblindMode: 'none',
    gamepadEnabled: false,
    autoFire: false,
    practiceMode: false,
  };
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      const defaults = getDefaultSettings();
      return { ...defaults, ...parsed };
    }
  } catch {
    // Corrupted or unavailable localStorage — fall through to defaults
  }
  return getDefaultSettings();
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage may be full or unavailable — silently fail
  }
}

export class SettingsManager {
  private static _instance: SettingsManager | null = null;

  settings!: GameSettings;

  constructor() {
    if (SettingsManager._instance) {
      return SettingsManager._instance;
    }
    this.settings = loadSettings();
    SettingsManager._instance = this;
  }

  save(): void {
    saveSettings(this.settings);
  }

  reset(): void {
    this.settings = getDefaultSettings();
    this.save();
  }

  get screenShake(): number {
    return this.settings.screenShakeIntensity;
  }

  get sfxVolume(): number {
    return this.settings.sfxVolume;
  }

  get musicVolume(): number {
    return this.settings.musicVolume;
  }
}
