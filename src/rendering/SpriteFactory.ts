import { Scene } from 'phaser';
import {
  PLAYER_SIZE,
  PROJECTILE_SIZE,
  CSS_PHOSPHOR_GREEN,
  CSS_HOT_WHITE,
  CSS_SIGNAL_RED,
} from '../utils/constants';
import { ENEMY_CONFIGS } from '../data/enemies';

function createGlowCircle(
  size: number,
  coreColor: string,
  glowColor: string,
  glowRadius: number,
): HTMLCanvasElement {
  const padding = glowRadius;
  const canvasSize = (size + padding) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  const outerGrad = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size + padding);
  outerGrad.addColorStop(0, glowColor);
  outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = outerGrad;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
  coreGrad.addColorStop(0, coreColor);
  coreGrad.addColorStop(0.7, coreColor);
  coreGrad.addColorStop(1, glowColor);
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();

  return canvas;
}

function createRect(w: number, h: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

function hexToCSS(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

function createDiamond(size: number, color: string, glowColor: string): HTMLCanvasElement {
  const padding = size;
  const canvasSize = (size + padding) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  // Glow
  const grad = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size + padding * 0.6);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Diamond shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  return canvas;
}

function createTriangle(size: number, color: string, glowColor: string): HTMLCanvasElement {
  const padding = size;
  const canvasSize = (size + padding) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  // Glow
  const grad = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size + padding * 0.6);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Triangle shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy + size * 0.7);
  ctx.lineTo(cx - size, cy + size * 0.7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  return canvas;
}

function createHexagon(size: number, color: string, glowColor: string): HTMLCanvasElement {
  const padding = size;
  const canvasSize = (size + padding) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  // Glow
  const grad = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size + padding * 0.6);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Hexagon shape (6 sides)
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const px = cx + Math.cos(angle) * size;
    const py = cy + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  return canvas;
}

function createSquare(size: number, color: string, glowColor: string): HTMLCanvasElement {
  const padding = size;
  const canvasSize = (size + padding) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  // Glow
  const grad = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size + padding * 0.6);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Square shape
  ctx.fillStyle = color;
  ctx.fillRect(cx - size, cy - size, size * 2, size * 2);

  return canvas;
}

function createGlowRect(
  w: number,
  h: number,
  color: string,
  glowColor: string,
): HTMLCanvasElement {
  const padding = Math.max(w, h) * 0.6;
  const canvasW = w + padding * 2;
  const canvasH = h + padding * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  // Glow
  const grad = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) + padding * 0.4);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Rectangle
  ctx.fillStyle = color;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

  return canvas;
}

function createPentagon(size: number, color: string, glowColor: string): HTMLCanvasElement {
  const padding = size;
  const canvasSize = (size + padding) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  const grad = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size + padding * 0.6);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = cx + Math.cos(angle) * size;
    const py = cy + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  return canvas;
}

function createOctagon(size: number, color: string, glowColor: string): HTMLCanvasElement {
  const padding = size;
  const canvasSize = (size + padding) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  const grad = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size + padding * 0.6);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
    const px = cx + Math.cos(angle) * size;
    const py = cy + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  return canvas;
}

function createWaveShape(size: number, color: string, glowColor: string): HTMLCanvasElement {
  const padding = size;
  const canvasW = (size * 3 + padding) * 2;
  const canvasH = (size + padding) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  const grad = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size * 2);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const wx = cx - size * 1.5 + t * size * 3;
    const wy = cy + Math.sin(t * Math.PI * 3) * size * 0.8;
    if (i === 0) ctx.moveTo(wx, wy);
    else ctx.lineTo(wx, wy);
  }
  ctx.stroke();

  return canvas;
}

function generateEnemyTexture(
  scene: Scene,
  key: string,
  shape: string,
  color: number,
  glowColor: string,
  size: number,
): void {
  const colorCSS = hexToCSS(color);

  let canvas: HTMLCanvasElement;
  switch (shape) {
    case 'circle':
      canvas = createGlowCircle(size, colorCSS, glowColor, size * 0.8);
      break;
    case 'diamond':
      canvas = createDiamond(size, colorCSS, glowColor);
      break;
    case 'triangle':
      canvas = createTriangle(size, colorCSS, glowColor);
      break;
    case 'wide_rectangle':
      canvas = createGlowRect(size * 3, size, colorCSS, glowColor);
      break;
    case 'tall_rectangle':
      canvas = createGlowRect(size, size * 2.5, colorCSS, glowColor);
      break;
    case 'hexagon':
      canvas = createHexagon(size, colorCSS, glowColor);
      break;
    case 'square':
      canvas = createSquare(size, colorCSS, glowColor);
      break;
    case 'pentagon':
      canvas = createPentagon(size, colorCSS, glowColor);
      break;
    case 'octagon':
      canvas = createOctagon(size, colorCSS, glowColor);
      break;
    case 'wave':
      canvas = createWaveShape(size, colorCSS, glowColor);
      break;
    case 'rectangle':
    default:
      canvas = createGlowRect(size * 2, size * 2, colorCSS, glowColor);
      break;
  }

  scene.textures.addCanvas(`enemy_${key}`, canvas);
}

export function generateTextures(scene: Scene): void {
  // Player
  const playerCanvas = createGlowCircle(PLAYER_SIZE, CSS_HOT_WHITE, CSS_PHOSPHOR_GREEN, PLAYER_SIZE);
  scene.textures.addCanvas('player', playerCanvas);

  // All enemy types
  for (const config of Object.values(ENEMY_CONFIGS)) {
    generateEnemyTexture(scene, config.key, config.shape, config.color, config.glowColor, config.size);
  }

  // Player projectile
  const projCanvas = createGlowCircle(PROJECTILE_SIZE, CSS_HOT_WHITE, CSS_PHOSPHOR_GREEN, PROJECTILE_SIZE * 2);
  scene.textures.addCanvas('projectile', projCanvas);

  // Scan-line projectile — wide horizontal rect with green glow
  const scanlineCanvas = createGlowRect(20, 4, CSS_PHOSPHOR_GREEN, '#33ff3388');
  scene.textures.addCanvas('projectile_scanline', scanlineCanvas);

  // Enemy projectile (red/orange)
  const enemyProjCanvas = createGlowCircle(5, '#ff6633', '#ff330066', 6);
  scene.textures.addCanvas('enemy_projectile', enemyProjCanvas);

  // Enemy beam segment
  const beamCanvas = createRect(80, 6, '#ff3333');
  scene.textures.addCanvas('enemy_beam', beamCanvas);

  // Beam telegraph (dim preview line)
  const telegraphCanvas = createRect(80, 2, '#ff333333');
  scene.textures.addCanvas('beam_telegraph', telegraphCanvas);

  // Muzzle flash
  const flashCanvas = createGlowCircle(3, CSS_HOT_WHITE, '#ffffff88', 6);
  scene.textures.addCanvas('muzzle_flash', flashCanvas);

  // Static particle
  const staticCanvas = createRect(4, 4, CSS_HOT_WHITE);
  scene.textures.addCanvas('static_particle', staticCanvas);

  // Wall segment
  const wallCanvas = createRect(32, 32, '#111122');
  scene.textures.addCanvas('wall', wallCanvas);

  // HP dots
  const hpCanvas = createGlowCircle(6, CSS_PHOSPHOR_GREEN, '#33ff3366', 4);
  scene.textures.addCanvas('hp_dot', hpCanvas);
  const hpEmptyCanvas = createGlowCircle(6, '#333333', '#33333333', 4);
  scene.textures.addCanvas('hp_dot_empty', hpEmptyCanvas);

  // Channel Surf trail
  const trailCanvas = createGlowCircle(3, '#aaaaff', '#6666ff66', 4);
  scene.textures.addCanvas('surf_trail', trailCanvas);

  // Pit hazard tile
  const pitCanvas = createRect(80, 80, '#0a0a14');
  const pctx = pitCanvas.getContext('2d')!;
  // Static noise pattern on pit
  for (let i = 0; i < 40; i++) {
    pctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
    pctx.fillRect(Math.random() * 80, Math.random() * 80, 2, 2);
  }
  scene.textures.addCanvas('pit', pitCanvas);

  // Cover block
  const coverCanvas = createRect(80, 80, '#1a1a30');
  const cctx = coverCanvas.getContext('2d')!;
  cctx.strokeStyle = '#2a2a50';
  cctx.lineWidth = 2;
  cctx.strokeRect(1, 1, 78, 78);
  scene.textures.addCanvas('cover', coverCanvas);

  // Door textures
  const doorLockedCanvas = createRect(80, 80, '#1a0000');
  const dlctx = doorLockedCanvas.getContext('2d')!;
  dlctx.strokeStyle = '#ff3333';
  dlctx.lineWidth = 2;
  dlctx.strokeRect(2, 2, 76, 76);
  // Static fill
  for (let i = 0; i < 30; i++) {
    dlctx.fillStyle = `rgba(255,50,50,${Math.random() * 0.2})`;
    dlctx.fillRect(Math.random() * 76 + 2, Math.random() * 76 + 2, 3, 3);
  }
  scene.textures.addCanvas('door_locked', doorLockedCanvas);

  const doorOpenCanvas = createRect(80, 80, '#001a00');
  const doctx = doorOpenCanvas.getContext('2d')!;
  doctx.strokeStyle = '#33ff33';
  doctx.lineWidth = 2;
  doctx.strokeRect(2, 2, 76, 76);
  scene.textures.addCanvas('door_open', doorOpenCanvas);

  // Pickup textures
  // HP shard - green cross
  const hpShardCanvas = document.createElement('canvas');
  hpShardCanvas.width = 20;
  hpShardCanvas.height = 20;
  const hsctx = hpShardCanvas.getContext('2d')!;
  hsctx.fillStyle = '#33ff33';
  hsctx.fillRect(7, 2, 6, 16);
  hsctx.fillRect(2, 7, 16, 6);
  scene.textures.addCanvas('pickup_hp', hpShardCanvas);

  // Tube - golden circle
  const tubeCanvas = createGlowCircle(6, '#ffcc33', '#ffcc3366', 5);
  scene.textures.addCanvas('pickup_tube', tubeCanvas);

  // Signal fragment - blue diamond
  const fragCanvas = createDiamond(6, '#3366ff', '#3366ff44');
  scene.textures.addCanvas('pickup_fragment', fragCanvas);

  // Item pedestal
  const pedestalCanvas = createGlowCircle(20, '#333344', '#33ff3322', 15);
  scene.textures.addCanvas('pedestal', pedestalCanvas);

  // Item icon (generic glowing orb — will be tinted per rarity)
  const itemCanvas = createGlowCircle(10, '#ffffff', '#ffffff66', 8);
  scene.textures.addCanvas('item_orb', itemCanvas);

  // Boss HP bar background
  const bossBarBg = createRect(400, 8, '#1a1a1a');
  scene.textures.addCanvas('boss_bar_bg', bossBarBg);
}
