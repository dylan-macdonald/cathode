export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  damageMultiplier: number;
  fireRateMultiplier: number;
  projectileCount: number;
  spreadAngle: number;
  piercing: number;
  homing: number;
  speed: number;
  range: number;
  color: number;
  shape: 'circle' | 'line' | 'triple' | 'wave';
}

export const WEAPON_DEFS: Record<string, WeaponDef> = {
  phosphor_beam: {
    id: 'phosphor_beam',
    name: 'Phosphor Beam',
    description: 'Focused phosphor dot. Your default signal.',
    damageMultiplier: 1.0,
    fireRateMultiplier: 1.0,
    projectileCount: 1,
    spreadAngle: 0,
    piercing: 0,
    homing: 0,
    speed: 400,
    range: 500,
    color: 0x33ff33,
    shape: 'circle',
  },

  scan_line: {
    id: 'scan_line',
    name: 'Scan Line',
    description: 'Wide horizontal sweep. Pierces through everything.',
    damageMultiplier: 0.9,
    fireRateMultiplier: 0.5,
    projectileCount: 1,
    spreadAngle: 0,
    piercing: 99,
    homing: 0,
    speed: 350,
    range: 600,
    color: 0x33ff33,
    shape: 'line',
  },

  color_burst: {
    id: 'color_burst',
    name: 'Color Burst',
    description: 'RGB spread. Rapid fire, short range.',
    damageMultiplier: 0.8,
    fireRateMultiplier: 1.3,
    projectileCount: 3,
    spreadAngle: 20,
    piercing: 0,
    homing: 0,
    speed: 350,
    range: 300,
    color: 0xffffff,
    shape: 'triple',
  },

  interference_pattern: {
    id: 'interference_pattern',
    name: 'Interference Pattern',
    description: 'Wavy homing signal. Slow but relentless.',
    damageMultiplier: 1.1,
    fireRateMultiplier: 0.8,
    projectileCount: 1,
    spreadAngle: 0,
    piercing: 0,
    homing: 0.5,
    speed: 280,
    range: 800,
    color: 0xaa33ff,
    shape: 'wave',
  },
};

export const ALL_WEAPONS: WeaponDef[] = Object.values(WEAPON_DEFS);
