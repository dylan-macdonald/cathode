// Display
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;
export const BACKGROUND_COLOR = 0x0a0a0a;

// Colors (hex numbers for Phaser)
export const COLOR_PHOSPHOR_GREEN = 0x33ff33;
export const COLOR_HOT_WHITE = 0xffffff;
export const COLOR_SIGNAL_RED = 0xff3333;
export const COLOR_TEST_BLUE = 0x3333ff;
export const COLOR_WARM_AMBER = 0xffaa33;
export const COLOR_BACKGROUND = 0x0a0a0a;

// Colors (CSS strings)
export const CSS_PHOSPHOR_GREEN = '#33ff33';
export const CSS_HOT_WHITE = '#ffffff';
export const CSS_SIGNAL_RED = '#ff3333';
export const CSS_TEST_BLUE = '#3333ff';
export const CSS_WARM_AMBER = '#ffaa33';
export const CSS_BACKGROUND = '#0a0a0a';

// Player defaults (also base stats)
export const PLAYER_SPEED = 200;
export const PLAYER_ACCELERATION = 1200;
export const PLAYER_DRAG = 800;
export const PLAYER_MAX_HP = 5;
export const PLAYER_SIZE = 16;
export const PLAYER_SHOOT_COOLDOWN = 250; // ms (= 4 shots/sec base)
export const PLAYER_INVULN_DURATION = 1000; // ms after taking damage

// Channel Surf (dodge)
export const CHANNEL_SURF_COOLDOWN = 1500;
export const CHANNEL_SURF_DURATION = 300;
export const CHANNEL_SURF_DISTANCE = 140;
export const CHANNEL_SURF_TRAIL_DAMAGE = 1;

// Projectile defaults
export const PROJECTILE_SPEED = 400;
export const PROJECTILE_DAMAGE = 1;
export const PROJECTILE_SIZE = 4;
export const PROJECTILE_RANGE = 500; // px max distance

// Enemy projectile
export const ENEMY_PROJECTILE_SIZE = 5;

// Room / Arena
export const ROOM_PADDING = 0; // no extra padding — grid fills entire screen
export const CELL_SIZE = 80;
export const GRID_COLS = 12;
export const GRID_ROWS = 8;

// Screen shake
export const SHAKE_INTENSITY = 0.001;
export const SHAKE_DURATION = 50;
export const HIT_SHAKE_INTENSITY = 0.003;
export const HIT_SHAKE_DURATION = 80;

// HUD
export const HUD_MARGIN = 16;
export const HP_DOT_SIZE = 8;
export const HP_DOT_SPACING = 20;

// Minimap
export const MINIMAP_ROOM_SIZE = 10;
export const MINIMAP_PADDING = 2;
export const MINIMAP_X = GAME_WIDTH - 16;
export const MINIMAP_Y = 50;

// Pickups
export const PICKUP_MAGNET_RANGE = 80;
export const PICKUP_BOB_AMPLITUDE = 4;
export const PICKUP_BOB_SPEED = 0.003;

// Physics
export const PHYSICS_FPS = 60;

// Room transition
export const ROOM_TRANSITION_DURATION = 300;

// Door dimensions
export const DOOR_WIDTH = 80;
export const DOOR_HEIGHT = 80;
