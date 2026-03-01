import { Page, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 640;

// ---------------------------------------------------------------------------
// Bridge Waiters
// ---------------------------------------------------------------------------

/** Wait for the debug bridge to be attached to the page. */
export async function waitForBridge(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForFunction(() => window.__CATHODE__ !== undefined, undefined, { timeout });
}

/** Wait until a specific scene is active. */
export async function waitForScene(page: Page, sceneKey: string, timeout = 10_000): Promise<void> {
  await page.waitForFunction(
    (key) => window.__CATHODE__?.isSceneActive(key) === true,
    sceneKey,
    { timeout },
  );
}

/** Wait until GameScene reports transitioning === false. */
export async function waitForTransitionEnd(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForFunction(
    () => window.__CATHODE__?.game.transitioning === false,
    undefined,
    { timeout },
  );
}

// ---------------------------------------------------------------------------
// State Reading
// ---------------------------------------------------------------------------

/** Return a snapshot of all game state from the bridge. */
export async function getState(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const g = window.__CATHODE__?.game;
    if (!g) return {};
    return {
      transitioning: g.transitioning,
      playerHP: g.playerHP,
      playerMaxHP: g.playerMaxHP,
      playerX: g.playerX,
      playerY: g.playerY,
      playerIsInvulnerable: g.playerIsInvulnerable,
      playerIsSurfing: g.playerIsSurfing,
      playerDamage: g.playerDamage,
      playerWeaponType: g.playerWeaponType,
      score: g.score,
      tubes: g.tubes,
      bombs: g.bombs,
      enemyCount: g.enemyCount,
      enemiesKilled: g.enemiesKilled,
      roomsCleared: g.roomsCleared,
      roomCleared: g.roomCleared,
      channelId: g.channelId,
      bossAlive: g.bossAlive,
      bossHP: g.bossHP,
      bossMaxHP: g.bossMaxHP,
      itemCount: g.itemCount,
      collectedItemIds: g.collectedItemIds,
      currentRoomX: g.currentRoomX,
      currentRoomY: g.currentRoomY,
      ascensionLevel: g.ascensionLevel,
      activeSynergies: g.activeSynergies,
      floorRoomCount: g.floorRoomCount,
      fps: g.fps,
      practiceMode: g.practiceMode,
      reduceMotion: g.reduceMotion,
    };
  });
}

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

/** Take a categorized screenshot. */
export async function snap(page: Page, name: string, category = 'general'): Promise<void> {
  const dir = path.join('test-results', 'screenshots', category);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

// ---------------------------------------------------------------------------
// Canvas Coordinate Mapping
// ---------------------------------------------------------------------------

/**
 * Maps game coordinates to page coordinates, accounting for Phaser Scale.FIT + CENTER_BOTH.
 */
async function gameToPageCoords(page: Page, gameX: number, gameY: number): Promise<{ x: number; y: number }> {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  const scaleX = box.width / GAME_WIDTH;
  const scaleY = box.height / GAME_HEIGHT;
  const scale = Math.min(scaleX, scaleY);

  const renderedW = GAME_WIDTH * scale;
  const renderedH = GAME_HEIGHT * scale;
  const offsetX = box.x + (box.width - renderedW) / 2;
  const offsetY = box.y + (box.height - renderedH) / 2;

  return {
    x: offsetX + gameX * scale,
    y: offsetY + gameY * scale,
  };
}

/** Click at a specific game coordinate on the canvas. */
export async function clickGameAt(page: Page, gameX: number, gameY: number): Promise<void> {
  const { x, y } = await gameToPageCoords(page, gameX, gameY);
  await page.mouse.click(x, y);
}

/** Move mouse to a game coordinate (without clicking). */
export async function moveMouseTo(page: Page, gameX: number, gameY: number): Promise<void> {
  const { x, y } = await gameToPageCoords(page, gameX, gameY);
  await page.mouse.move(x, y);
}

// ---------------------------------------------------------------------------
// Player Input Helpers
// ---------------------------------------------------------------------------

const DIRECTION_KEYS: Record<string, string> = {
  up: 'w',
  down: 's',
  left: 'a',
  right: 'd',
};

/** Press a movement key for a duration. */
export async function movePlayer(page: Page, direction: string, durationMs = 300): Promise<void> {
  const key = DIRECTION_KEYS[direction];
  if (!key) throw new Error(`Invalid direction: ${direction}`);
  await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(key);
}

/** Move mouse to game coordinate and click to shoot. */
export async function shootAt(page: Page, gameX: number, gameY: number, shots = 1, intervalMs = 100): Promise<void> {
  const { x, y } = await gameToPageCoords(page, gameX, gameY);
  await page.mouse.move(x, y);
  for (let i = 0; i < shots; i++) {
    await page.mouse.click(x, y);
    if (i < shots - 1) await page.waitForTimeout(intervalMs);
  }
}

// ---------------------------------------------------------------------------
// Full Navigation
// ---------------------------------------------------------------------------

export interface NavigateOptions {
  saveData?: Record<string, unknown>;
}

/**
 * Navigate from fresh page load all the way to GameScene.
 * Handles: Menu -> RepairShop -> CharacterSelect -> WeaponSelect -> GameScene.
 */
export async function navigateToGameScene(page: Page, options: NavigateOptions = {}): Promise<void> {
  await page.goto('/');
  await waitForBridge(page);

  // Reset save to ensure clean state, then apply overrides
  await page.evaluate(() => window.__CATHODE__!.commands.resetSave());
  if (options.saveData) {
    await page.evaluate((data) => window.__CATHODE__!.commands.setSaveData(data), options.saveData);
  }

  // Wait for MenuScene
  await waitForScene(page, 'MenuScene');
  await page.waitForTimeout(500);

  // Navigate directly via bridge — bypasses input issues in headless Chrome
  await page.evaluate(() => window.__CATHODE__!.commands.startScene('RepairShopScene'));
  await waitForScene(page, 'RepairShopScene', 15_000);
  await page.waitForTimeout(500);

  // Navigate to CharacterSelect via bridge click on THE TV, then start
  // Use bridge clickCanvas to trigger Phaser's pointer handler
  await page.evaluate(() => window.__CATHODE__!.commands.clickCanvas(480, 220));
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__CATHODE__!.commands.clickCanvas(480, 360));

  // Wait for CharacterSelectScene — if click didn't work, force start
  try {
    await waitForScene(page, 'CharacterSelectScene', 5_000);
  } catch {
    // Fallback: direct scene start
    await page.evaluate(() => window.__CATHODE__!.commands.startScene('CharacterSelectScene'));
    await waitForScene(page, 'CharacterSelectScene', 5_000);
  }
  await page.waitForTimeout(300);

  // CharacterSelect → WeaponSelect
  await page.evaluate(() => window.__CATHODE__!.commands.pressKey('Enter'));
  try {
    await waitForScene(page, 'WeaponSelectScene', 5_000);
  } catch {
    await page.evaluate(() => window.__CATHODE__!.commands.startScene('WeaponSelectScene'));
    await waitForScene(page, 'WeaponSelectScene', 5_000);
  }
  await page.waitForTimeout(300);

  // WeaponSelect → GameScene
  await page.evaluate(() => window.__CATHODE__!.commands.pressKey('Enter'));
  try {
    await waitForScene(page, 'GameScene', 5_000);
  } catch {
    // Force-start GameScene with default config
    await page.evaluate(() => {
      window.__CATHODE__!.commands.startScene('GameScene', {
        channelId: 'static',
        weaponType: 'phosphor_beam',
        characterId: 'standard',
      });
    });
    await waitForScene(page, 'GameScene', 10_000);
  }

  // Wait for power-on cinematic to finish (can be slow in headless Chrome)
  await waitForTransitionEnd(page, 30_000);
}

// ---------------------------------------------------------------------------
// Bridge Command Wrappers
// ---------------------------------------------------------------------------

export async function spawnEnemy(page: Page, type: string, x: number, y: number): Promise<void> {
  await page.evaluate(({ type, x, y }) => window.__CATHODE__!.commands.spawnEnemy(type, x, y), { type, x, y });
}

export async function giveItem(page: Page, itemId: string): Promise<void> {
  await page.evaluate((id) => window.__CATHODE__!.commands.giveItem(id), itemId);
}

export async function killAllEnemies(page: Page): Promise<void> {
  await page.evaluate(() => window.__CATHODE__!.commands.killAllEnemies());
}

export async function clearRoom(page: Page): Promise<void> {
  await page.evaluate(() => window.__CATHODE__!.commands.clearRoom());
}

export async function setPlayerHP(page: Page, hp: number): Promise<void> {
  await page.evaluate((hp) => window.__CATHODE__!.commands.setPlayerHP(hp), hp);
}

export async function setPlayerPosition(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(({ x, y }) => window.__CATHODE__!.commands.setPlayerPosition(x, y), { x, y });
}

export async function setPlayerInvulnerable(page: Page, v: boolean): Promise<void> {
  await page.evaluate((v) => window.__CATHODE__!.commands.setPlayerInvulnerable(v), v);
}

export async function giveTubes(page: Page, n: number): Promise<void> {
  await page.evaluate((n) => window.__CATHODE__!.commands.giveTubes(n), n);
}

export async function setSaveData(page: Page, data: Record<string, unknown>): Promise<void> {
  await page.evaluate((d) => window.__CATHODE__!.commands.setSaveData(d), data);
}

// ---------------------------------------------------------------------------
// Data Getters
// ---------------------------------------------------------------------------

export async function getAllEnemyTypes(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__CATHODE__!.data.allEnemyTypes as string[]);
}

export async function getAllItemIds(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__CATHODE__!.data.allItemIds as string[]);
}

export async function getAllChannelIds(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__CATHODE__!.data.allChannelIds as string[]);
}

export async function getAllBossIds(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__CATHODE__!.data.allBossIds as string[]);
}

export async function getAllSynergyIds(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__CATHODE__!.data.allSynergyIds as string[]);
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

/** Collect FPS samples over N animation frames. */
export async function profileFrames(page: Page, count = 300): Promise<{ min: number; max: number; avg: number; samples: number[] }> {
  const samples = await page.evaluate((n) => {
    return new Promise<number[]>((resolve) => {
      const fps: number[] = [];
      let i = 0;
      function tick() {
        fps.push(window.__CATHODE__?.perf.fps as number ?? 0);
        i++;
        if (i >= n) resolve(fps);
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, count);

  const valid = samples.filter(f => f > 0);
  return {
    min: Math.min(...valid),
    max: Math.max(...valid),
    avg: valid.reduce((a, b) => a + b, 0) / valid.length,
    samples,
  };
}

/** Listen for console errors during a callback. */
export async function captureErrors(page: Page, callback: () => Promise<void>): Promise<string[]> {
  const errors: string[] = [];
  const handler = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') errors.push(msg.text());
  };
  page.on('console', handler);
  await callback();
  page.off('console', handler);
  return errors;
}

// ---------------------------------------------------------------------------
// Phase 7: Event Log Helpers
// ---------------------------------------------------------------------------

export interface GameEventSnapshot {
  type: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

/** Get a copy of the event log from the bridge. */
export async function getEventLog(page: Page): Promise<GameEventSnapshot[]> {
  return page.evaluate(() => {
    const events = window.__CATHODE__?.events;
    if (!events) return [];
    return [...events.log] as { type: string; timestamp: number; data?: Record<string, unknown> }[];
  });
}

/** Clear the event log. */
export async function clearEvents(page: Page): Promise<void> {
  await page.evaluate(() => window.__CATHODE__?.events.clear());
}

/** Wait for a specific event type to appear in the log. */
export async function waitForEvent(page: Page, type: string, timeout = 5_000): Promise<GameEventSnapshot> {
  return page.waitForFunction(
    (t) => {
      const events = window.__CATHODE__?.events;
      if (!events) return null;
      const found = events.ofType(t);
      return found.length > 0 ? found[found.length - 1] : null;
    },
    type,
    { timeout },
  ) as unknown as Promise<GameEventSnapshot>;
}

/** Get events of a specific type. */
export async function getEventsOfType(page: Page, type: string): Promise<GameEventSnapshot[]> {
  return page.evaluate((t) => {
    const events = window.__CATHODE__?.events;
    if (!events) return [];
    return events.ofType(t) as { type: string; timestamp: number; data?: Record<string, unknown> }[];
  }, type);
}

/** Measure time delta between first occurrence of startType and first occurrence of endType. */
export async function measureEventDelta(page: Page, startType: string, endType: string): Promise<number | null> {
  return page.evaluate(({ s, e }) => {
    const events = window.__CATHODE__?.events;
    if (!events) return null;
    const startEvents = events.ofType(s);
    const endEvents = events.ofType(e);
    if (startEvents.length === 0 || endEvents.length === 0) return null;
    return endEvents[endEvents.length - 1].timestamp - startEvents[startEvents.length - 1].timestamp;
  }, { s: startType, e: endType });
}

// ---------------------------------------------------------------------------
// Phase 7: Camera State
// ---------------------------------------------------------------------------

export interface CameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  shakeIntensity: number;
  shakeDuration: number;
  flashAlpha: number;
}

export async function getCameraState(page: Page): Promise<CameraState> {
  return page.evaluate(() => {
    const cam = window.__CATHODE__?.camera;
    if (!cam) return { scrollX: 0, scrollY: 0, zoom: 1, shakeIntensity: 0, shakeDuration: 0, flashAlpha: 0 };
    return {
      scrollX: cam.scrollX as number ?? 0,
      scrollY: cam.scrollY as number ?? 0,
      zoom: cam.zoom as number ?? 1,
      shakeIntensity: cam.shakeIntensity as number ?? 0,
      shakeDuration: cam.shakeDuration as number ?? 0,
      flashAlpha: cam.flashAlpha as number ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Phase 7: Audio State
// ---------------------------------------------------------------------------

export interface AudioState {
  lastPlayedSFX: string | null;
  sfxPlayCounts: Record<string, number>;
}

export async function getAudioState(page: Page): Promise<AudioState> {
  return page.evaluate(() => {
    const audio = window.__CATHODE__?.audio;
    if (!audio) return { lastPlayedSFX: null, sfxPlayCounts: {} };
    return {
      lastPlayedSFX: audio.lastPlayedSFX,
      sfxPlayCounts: audio.sfxPlayCounts,
    };
  });
}

export async function clearAudioCounts(page: Page): Promise<void> {
  await page.evaluate(() => window.__CATHODE__?.audio.clearCounts());
}

// ---------------------------------------------------------------------------
// Phase 7: Particle State
// ---------------------------------------------------------------------------

export interface ParticleState {
  activeEmitterCount: number;
  totalAliveParticles: number;
}

export async function getParticleState(page: Page): Promise<ParticleState> {
  return page.evaluate(() => {
    const p = window.__CATHODE__?.particles;
    if (!p) return { activeEmitterCount: 0, totalAliveParticles: 0 };
    return {
      activeEmitterCount: p.activeEmitterCount as number ?? 0,
      totalAliveParticles: p.totalAliveParticles as number ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Phase 7: Trigger Helpers
// ---------------------------------------------------------------------------

export async function triggerShoot(page: Page): Promise<void> {
  await page.evaluate(() => window.__CATHODE__!.commands.triggerShoot());
}

export async function triggerSurf(page: Page): Promise<void> {
  await page.evaluate(() => window.__CATHODE__!.commands.triggerSurf());
}

export async function triggerBomb(page: Page): Promise<void> {
  await page.evaluate(() => window.__CATHODE__!.commands.triggerBomb());
}

export async function triggerPlayerDamage(page: Page, amount: number): Promise<void> {
  await page.evaluate((a) => window.__CATHODE__!.commands.triggerPlayerDamage(a), amount);
}

export async function triggerEnemyDamage(page: Page, amount: number): Promise<void> {
  await page.evaluate((a) => window.__CATHODE__!.commands.triggerEnemyDamage(a), amount);
}

export async function getHitStopTimer(page: Page): Promise<number> {
  return page.evaluate(() => window.__CATHODE__!.commands.getHitStopTimer() as number);
}
