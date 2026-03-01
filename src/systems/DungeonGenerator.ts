import {
  RoomData,
  CellGrid,
  Direction,
  EnemySpawn,
  COMBAT_TEMPLATES,
  ITEM_TEMPLATES,
  BOSS_ROOM,
  SPAWN_ROOM,
  Cell,
  filterDoors,
  getSpawnPoints,
  CELL_SIZE,
} from '../data/rooms';
import { SeededRNG } from './SeededRNG';

export type FloorMap = Map<string, RoomData>;

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

function parseKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

const OPPOSITE: Record<Direction, Direction> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

const DIR_OFFSET: Record<Direction, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
};

const ALL_DIRS: Direction[] = ['north', 'south', 'east', 'west'];

// Enemy types available for spawning, by difficulty tier
const EASY_ENEMIES = ['static_mote'];
const MED_ENEMIES = ['static_mote', 'scanline_crawler', 'tone_drone'];
const HARD_ENEMIES = ['signal_ghost', 'tone_drone', 'scanline_crawler'];
const ELITE_ENEMIES = ['bar_sentinel', 'signal_ghost'];

const ENEMY_COST: Record<string, number> = {
  // CH 2 STATIC
  static_mote: 1,
  scanline_crawler: 2,
  tone_drone: 2,
  signal_ghost: 3,
  bar_sentinel: 4,
  // CH 4 TEST PATTERN
  grid_walker: 2,
  calibration_ring: 2,
  color_bar: 3,
  // CH 11 EMERGENCY
  siren_crawler: 2,
  alert_text: 2,
  tone_spike: 3,
  // CH 7 LATE NIGHT
  pitchman: 2,
  price_tag: 1,
  infomercial_loop: 3,
  // CH 9 CARTOON
  bounce_blob: 2,
  rubber_band: 1,
  anvil: 4,
  ink_blot: 3,
  // CH 13 NATURE DOC
  spore: 1,
  tendril: 3,
  swarm_unit: 1,
  predator: 4,
  // Global
  feedback_loop: 2,
  dead_pixel: 1,
};

function pickRandom<T>(arr: T[], rng?: SeededRNG): T {
  if (rng) return rng.pick(arr);
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffled<T>(arr: T[], rng?: SeededRNG): T[] {
  if (rng) return rng.shuffle(arr);
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function applyRandomTransform(grid: CellGrid, rng?: SeededRNG): CellGrid {
  // Only mirror horizontally — rotation changes 12×8 to 8×12 which breaks the grid
  const shouldMirror = rng ? rng.chance(0.5) : Math.random() < 0.5;
  if (shouldMirror) {
    return grid.map(row => {
      const mirrored = [...row].reverse();
      return mirrored.map(cell => {
        if (cell === Cell.DOOR_E) return Cell.DOOR_W;
        if (cell === Cell.DOOR_W) return Cell.DOOR_E;
        return cell;
      });
    });
  }
  return grid.map(row => [...row]);
}

function distanceBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2); // Manhattan distance
}

function getNeighborDirs(floorMap: FloorMap, x: number, y: number): Direction[] {
  const dirs: Direction[] = [];
  for (const dir of ALL_DIRS) {
    const { dx, dy } = DIR_OFFSET[dir];
    if (floorMap.has(coordKey(x + dx, y + dy))) {
      dirs.push(dir);
    }
  }
  return dirs;
}

function assignEnemies(
  spawnPoints: { col: number; row: number }[],
  budget: number,
  distFromSpawn: number,
  channelEnemyPool?: string[],
  difficultyScale = 1.0,
  rng?: SeededRNG,
): EnemySpawn[] {
  if (spawnPoints.length === 0) return [];

  const enemies: EnemySpawn[] = [];
  let remaining = budget;

  // Choose enemy pool based on distance
  let pool: string[];
  if (channelEnemyPool && channelEnemyPool.length > 0) {
    // Channel-specific enemy pool: scale by distance
    if (distFromSpawn <= 1) {
      // Early rooms: only use first 1-2 enemies from the pool (easiest)
      pool = channelEnemyPool.slice(0, Math.max(1, Math.ceil(channelEnemyPool.length * 0.4)));
    } else if (distFromSpawn <= 3) {
      // Mid rooms: use first 60% of pool
      pool = channelEnemyPool.slice(0, Math.max(2, Math.ceil(channelEnemyPool.length * 0.6)));
    } else {
      // Far rooms: use full pool
      pool = [...channelEnemyPool];
    }
  } else {
    // Fallback to hardcoded CH 2 pools
    if (distFromSpawn <= 1) {
      pool = EASY_ENEMIES;
    } else if (distFromSpawn <= 3) {
      pool = MED_ENEMIES;
    } else {
      pool = [...MED_ENEMIES, ...HARD_ENEMIES];
    }

    // Far rooms can include elites
    const includeElites = rng ? rng.chance(0.4) : Math.random() < 0.4;
    if (distFromSpawn >= 4 && includeElites) {
      pool = [...pool, ...ELITE_ENEMIES];
    }
  }

  // Fill spawn points with enemies within budget
  const shuffledSpawns = shuffled(spawnPoints, rng);
  let spawnIdx = 0;

  while (remaining > 0 && enemies.length < 12) {
    const type = pickRandom(pool, rng);
    const cost = ENEMY_COST[type] ?? 1;
    if (cost > remaining) {
      // Try to fit a cheaper enemy
      const cheap = pool.filter(t => (ENEMY_COST[t] ?? 1) <= remaining);
      if (cheap.length === 0) break;
      const cheapType = pickRandom(cheap, rng);
      const sp = shuffledSpawns[spawnIdx % shuffledSpawns.length];
      enemies.push({
        x: sp.col * CELL_SIZE + CELL_SIZE / 2,
        y: sp.row * CELL_SIZE + CELL_SIZE / 2,
        type: cheapType,
      });
      remaining -= ENEMY_COST[cheapType] ?? 1;
    } else {
      const sp = shuffledSpawns[spawnIdx % shuffledSpawns.length];
      enemies.push({
        x: sp.col * CELL_SIZE + CELL_SIZE / 2,
        y: sp.row * CELL_SIZE + CELL_SIZE / 2,
        type,
      });
      remaining -= cost;
    }
    spawnIdx++;
  }

  return enemies;
}

export function generateFloor(roomCount = 10, channelEnemyPool?: string[], difficultyScale = 1.0, seed?: string): FloorMap {
  const rng = seed ? new SeededRNG(SeededRNG.hashString(seed)) : undefined;
  const floor: FloorMap = new Map();

  // 1. Place spawn room at origin
  const spawnTemplate = SPAWN_ROOM.map(r => [...r]);
  floor.set(coordKey(0, 0), {
    type: 'spawn',
    template: spawnTemplate,
    doors: [],
    enemies: [],
    cleared: true,
    visited: true,
    gridX: 0,
    gridY: 0,
  });

  // 2. Random walk to place rooms
  const placed: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  let cursor = { x: 0, y: 0 };
  let attempts = 0;
  const maxAttempts = 200;

  while (placed.length < roomCount && attempts < maxAttempts) {
    attempts++;
    const dir = pickRandom(ALL_DIRS, rng);
    const { dx, dy } = DIR_OFFSET[dir];
    const nx = cursor.x + dx;
    const ny = cursor.y + dy;

    if (floor.has(coordKey(nx, ny))) {
      // Already placed — move cursor there sometimes for branching
      const shouldBranch = rng ? rng.chance(0.3) : Math.random() < 0.3;
      if (shouldBranch) {
        cursor = { x: nx, y: ny };
      }
      continue;
    }

    // Don't let the map get too spread out
    if (Math.abs(nx) > 4 || Math.abs(ny) > 4) continue;

    // Limit adjacency to avoid a blob — max 2 neighbors for non-spawn rooms
    const neighborCount = ALL_DIRS.filter(d => {
      const { dx: ddx, dy: ddy } = DIR_OFFSET[d];
      return floor.has(coordKey(nx + ddx, ny + ddy));
    }).length;
    if (neighborCount > 2) continue;

    const template = applyRandomTransform(pickRandom(COMBAT_TEMPLATES, rng), rng);
    floor.set(coordKey(nx, ny), {
      type: 'combat',
      template,
      doors: [],
      enemies: [],
      cleared: false,
      visited: false,
      gridX: nx,
      gridY: ny,
    });
    placed.push({ x: nx, y: ny });
    cursor = { x: nx, y: ny };

    // Occasionally branch from a random existing room
    const shouldJump = rng ? rng.chance(0.3) : Math.random() < 0.3;
    if (shouldJump && placed.length > 2) {
      cursor = pickRandom(placed, rng);
    }
  }

  // 3. Assign special rooms
  // Boss = farthest from spawn
  let farthest = placed[0];
  let farthestDist = 0;
  for (const p of placed) {
    const d = distanceBetween(0, 0, p.x, p.y);
    if (d > farthestDist && !(p.x === 0 && p.y === 0)) {
      farthestDist = d;
      farthest = p;
    }
  }
  const bossRoom = floor.get(coordKey(farthest.x, farthest.y))!;
  bossRoom.type = 'boss';
  bossRoom.template = BOSS_ROOM.map(r => [...r]);

  // Item room = pick a non-spawn, non-boss room, preferring mid-distance
  const candidates = placed.filter(
    p => !(p.x === 0 && p.y === 0) &&
         !(p.x === farthest.x && p.y === farthest.y)
  );
  candidates.sort((a, b) => {
    const da = distanceBetween(0, 0, a.x, a.y);
    const db = distanceBetween(0, 0, b.x, b.y);
    return Math.abs(da - 2) - Math.abs(db - 2); // prefer distance ~2
  });

  if (candidates.length >= 2) {
    const itemRoom = floor.get(coordKey(candidates[0].x, candidates[0].y))!;
    itemRoom.type = 'item';
    itemRoom.template = pickRandom(ITEM_TEMPLATES, rng).map(r => [...r]);

    const shopRoom = floor.get(coordKey(candidates[1].x, candidates[1].y))!;
    shopRoom.type = 'shop';
    shopRoom.template = pickRandom(ITEM_TEMPLATES, rng).map(r => [...r]);
  } else if (candidates.length === 1) {
    const itemRoom = floor.get(coordKey(candidates[0].x, candidates[0].y))!;
    itemRoom.type = 'item';
    itemRoom.template = pickRandom(ITEM_TEMPLATES, rng).map(r => [...r]);
  }

  // 4. Compute doors for each room based on adjacency
  for (const [key, room] of floor) {
    const { x, y } = parseKey(key);
    const doors: Direction[] = [];
    for (const dir of ALL_DIRS) {
      const { dx, dy } = DIR_OFFSET[dir];
      if (floor.has(coordKey(x + dx, y + dy))) {
        doors.push(dir);
      }
    }
    room.doors = doors;
    room.template = filterDoors(room.template, doors);
  }

  // 5. Assign enemies to combat rooms
  for (const [key, room] of floor) {
    if (room.type !== 'combat') continue;
    const { x, y } = parseKey(key);
    const dist = distanceBetween(0, 0, x, y);
    const spawnPoints = getSpawnPoints(room.template);

    // Budget scales with distance: base 3 + distance * 2, multiplied by difficulty
    const budget = Math.floor((3 + dist * 2) * difficultyScale);
    room.enemies = assignEnemies(spawnPoints, budget, dist, channelEnemyPool, difficultyScale, rng);
  }

  return floor;
}

export function getAdjacentRoom(
  floor: FloorMap,
  x: number,
  y: number,
  dir: Direction,
): RoomData | undefined {
  const { dx, dy } = DIR_OFFSET[dir];
  return floor.get(coordKey(x + dx, y + dy));
}

export function getRoomAt(floor: FloorMap, x: number, y: number): RoomData | undefined {
  return floor.get(coordKey(x, y));
}

// Export utilities for other modules
export { coordKey, parseKey, DIR_OFFSET, OPPOSITE };
