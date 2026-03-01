// Room templates on a 12x8 grid (each cell = 80x80px to fill 960x640)
// Cell types define what occupies each grid position

export enum Cell {
  EMPTY = 0,
  WALL = 1,
  PIT = 2,
  COVER = 3,
  SPAWN = 4,
  DOOR_N = 5,
  DOOR_S = 6,
  DOOR_E = 7,
  DOOR_W = 8,
}

export type CellGrid = Cell[][];

export type RoomType = 'combat' | 'item' | 'shop' | 'boss' | 'spawn';

export type Direction = 'north' | 'south' | 'east' | 'west';

export interface EnemySpawn {
  x: number;
  y: number;
  type: string; // enemy config key
}

export interface RoomData {
  type: RoomType;
  template: CellGrid;
  doors: Direction[];
  enemies: EnemySpawn[];
  cleared: boolean;
  visited: boolean;
  gridX: number;
  gridY: number;
}

// Grid constants
export const GRID_COLS = 12;
export const GRID_ROWS = 8;
export const CELL_SIZE = 80;

// ── Template Utilities ──────────────────────────────────────────

const C = Cell;

export function rotateTemplate90(grid: CellGrid): CellGrid {
  const rows = grid.length;
  const cols = grid[0].length;
  const rotated: CellGrid = [];
  for (let c = 0; c < cols; c++) {
    const newRow: Cell[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      newRow.push(rotateDoorCell(grid[r][c], 1));
    }
    rotated.push(newRow);
  }
  return rotated;
}

export function rotateTemplate180(grid: CellGrid): CellGrid {
  return rotateTemplate90(rotateTemplate90(grid));
}

export function rotateTemplate270(grid: CellGrid): CellGrid {
  return rotateTemplate90(rotateTemplate180(grid));
}

export function mirrorHorizontal(grid: CellGrid): CellGrid {
  return grid.map(row => {
    const mirrored = [...row].reverse();
    return mirrored.map(cell => mirrorDoorCellH(cell));
  });
}

export function mirrorVertical(grid: CellGrid): CellGrid {
  const flipped = [...grid].reverse();
  return flipped.map(row => row.map(cell => mirrorDoorCellV(cell)));
}

function rotateDoorCell(cell: Cell, quarterTurns: number): Cell {
  if (cell < Cell.DOOR_N) return cell;
  const doorOrder = [Cell.DOOR_N, Cell.DOOR_E, Cell.DOOR_S, Cell.DOOR_W];
  const idx = doorOrder.indexOf(cell);
  if (idx === -1) return cell;
  return doorOrder[(idx + quarterTurns) % 4];
}

function mirrorDoorCellH(cell: Cell): Cell {
  if (cell === Cell.DOOR_E) return Cell.DOOR_W;
  if (cell === Cell.DOOR_W) return Cell.DOOR_E;
  return cell;
}

function mirrorDoorCellV(cell: Cell): Cell {
  if (cell === Cell.DOOR_N) return Cell.DOOR_S;
  if (cell === Cell.DOOR_S) return Cell.DOOR_N;
  return cell;
}

// ── Combat Room Templates (12) ──────────────────────────────────
// 12 cols × 8 rows, doors placed at edges

export const COMBAT_OPEN_ARENA: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,4,0,0,0,0,4,0,0,0],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [0,0,0,4,0,0,0,0,4,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_FOUR_PILLARS: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,0,0,1,1,0,0],
  [8,0,1,1,0,4,4,0,1,1,0,7],
  [8,0,1,1,0,4,4,0,1,1,0,7],
  [0,0,1,1,0,0,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_CORRIDOR_H: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,1,1,1,1,0,0,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [8,0,4,0,0,0,0,0,0,4,0,7],
  [8,0,4,0,0,0,0,0,0,4,0,7],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,0,0,1,1,1,1,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_CROSS_BLOCK: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,4,0,0,1,1,0,0,4,0,0],
  [8,0,0,0,1,1,1,1,0,0,0,7],
  [8,0,0,0,1,1,1,1,0,0,0,7],
  [0,0,4,0,0,1,1,0,0,4,0,0],
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_ZIGZAG: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,1,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,1,1,0],
  [8,0,0,0,1,1,0,0,0,0,0,7],
  [8,0,0,0,0,0,1,1,0,0,0,7],
  [0,1,1,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_RING: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,0,0,0],
  [8,0,0,1,0,4,4,0,1,0,0,7],
  [8,0,0,1,0,4,4,0,1,0,0,7],
  [0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_SCATTERED: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,4,0,0,0,0,0,0],
  [8,0,0,0,1,0,0,1,0,0,0,7],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [0,0,0,4,0,0,4,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,1,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_L_WALLS: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,1,1,1,0,0,0,0,0,0,0,0],
  [0,1,0,0,0,0,0,0,0,4,0,0],
  [8,1,0,0,0,0,0,0,0,0,0,7],
  [8,0,0,0,0,0,0,0,1,0,0,7],
  [0,0,4,0,0,0,0,0,1,0,0,0],
  [0,0,0,0,0,0,0,1,1,1,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_PIT_CROSS: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,0,0,0,2,2,0,0,0,0,0],
  [0,0,4,0,0,0,0,0,0,4,0,0],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [0,0,4,0,0,0,0,0,0,4,0,0],
  [0,0,0,0,0,2,2,0,0,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_CHAMBERS: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,0,0,1,0,0,1,0,0,0,0],
  [0,0,4,0,1,0,0,1,0,4,0,0],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [0,0,4,0,1,0,0,1,0,4,0,0],
  [0,0,0,0,1,0,0,1,0,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_GAUNTLET: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,1,0,1,0,0,0,0,1,0,1,0],
  [0,0,0,0,0,4,0,0,0,0,0,0],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [0,0,0,0,0,0,4,0,0,0,0,0],
  [0,1,0,1,0,0,0,0,1,0,1,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const COMBAT_MAZE: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,1,0,0,0,0,1,0,0,0,0],
  [0,0,1,0,1,1,0,1,0,4,0,0],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [0,0,4,0,1,0,1,1,0,1,0,0],
  [0,0,0,0,1,0,0,0,1,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

// ── Item Room Templates (2) ────────────────────────────────────

export const ITEM_ROOM_CENTER: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

export const ITEM_ROOM_GUARDED: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,0,1,0,0],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [0,0,1,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

// ── Boss Room Template (1) ─────────────────────────────────────

export const BOSS_ROOM: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

// ── Spawn Room Template ────────────────────────────────────────

export const SPAWN_ROOM: CellGrid = [
  [0,0,0,0,0,5,5,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [8,0,0,0,0,0,0,0,0,0,0,7],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,6,6,0,0,0,0,0],
];

// ── Template Collections ───────────────────────────────────────

export const COMBAT_TEMPLATES: CellGrid[] = [
  COMBAT_OPEN_ARENA,
  COMBAT_FOUR_PILLARS,
  COMBAT_CORRIDOR_H,
  COMBAT_CROSS_BLOCK,
  COMBAT_ZIGZAG,
  COMBAT_RING,
  COMBAT_SCATTERED,
  COMBAT_L_WALLS,
  COMBAT_PIT_CROSS,
  COMBAT_CHAMBERS,
  COMBAT_GAUNTLET,
  COMBAT_MAZE,
];

export const ITEM_TEMPLATES: CellGrid[] = [
  ITEM_ROOM_CENTER,
  ITEM_ROOM_GUARDED,
];

export function getRandomCombatTemplate(): CellGrid {
  const base = COMBAT_TEMPLATES[Math.floor(Math.random() * COMBAT_TEMPLATES.length)];
  return applyRandomTransform(base);
}

export function getRandomItemTemplate(): CellGrid {
  return ITEM_TEMPLATES[Math.floor(Math.random() * ITEM_TEMPLATES.length)];
}

function applyRandomTransform(grid: CellGrid): CellGrid {
  const roll = Math.random();
  if (roll < 0.25) return grid;
  if (roll < 0.5) return rotateTemplate180(grid);
  if (roll < 0.75) return mirrorHorizontal(grid);
  return mirrorVertical(grid);
}

// Get spawn point positions from a template
export function getSpawnPoints(grid: CellGrid): { col: number; row: number }[] {
  const points: { col: number; row: number }[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === Cell.SPAWN) {
        points.push({ col: c, row: r });
      }
    }
  }
  return points;
}

// Get door positions from template
export function getDoorDirections(grid: CellGrid): Direction[] {
  const dirs = new Set<Direction>();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell === Cell.DOOR_N) dirs.add('north');
      if (cell === Cell.DOOR_S) dirs.add('south');
      if (cell === Cell.DOOR_E) dirs.add('east');
      if (cell === Cell.DOOR_W) dirs.add('west');
    }
  }
  return Array.from(dirs);
}

// Filter a template to only include doors for specific directions
export function filterDoors(grid: CellGrid, activeDoors: Direction[]): CellGrid {
  return grid.map(row => row.map(cell => {
    if (cell === Cell.DOOR_N && !activeDoors.includes('north')) return Cell.WALL;
    if (cell === Cell.DOOR_S && !activeDoors.includes('south')) return Cell.WALL;
    if (cell === Cell.DOOR_E && !activeDoors.includes('east')) return Cell.WALL;
    if (cell === Cell.DOOR_W && !activeDoors.includes('west')) return Cell.WALL;
    return cell;
  }));
}
