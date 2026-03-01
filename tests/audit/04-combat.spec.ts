import { test, expect } from '@playwright/test';
import { navigateToGameScene, getState, spawnEnemy, killAllEnemies, shootAt, snap, setPlayerPosition, setPlayerInvulnerable } from '../helpers';

test.describe('04 — Combat', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToGameScene(page);
    // Clear any existing enemies and center player
    await killAllEnemies(page);
    await page.waitForTimeout(200);
  });

  test('spawning an enemy increments enemy count', async ({ page }) => {
    const before = await getState(page);
    const initialCount = before.enemyCount as number;

    await spawnEnemy(page, 'static_mote', 480, 200);
    await page.waitForTimeout(100);

    const after = await getState(page);
    expect(after.enemyCount as number).toBe(initialCount + 1);
  });

  test('killing an enemy increments kill count and clears enemies', async ({ page }) => {
    await spawnEnemy(page, 'static_mote', 500, 320);
    await page.waitForTimeout(200);

    const before = await getState(page);
    expect(before.enemyCount as number).toBeGreaterThanOrEqual(1);

    // Kill via bridge (Phaser doesn't receive mouse clicks in headless Chrome)
    await killAllEnemies(page);
    await page.waitForTimeout(500);

    const after = await getState(page);
    expect(after.enemyCount as number).toBe(0);
    expect(after.enemiesKilled as number).toBeGreaterThan(before.enemiesKilled as number);
  });

  test('enemy contact damages player', async ({ page }) => {
    await setPlayerInvulnerable(page, false);
    const before = await getState(page);
    const initialHP = before.playerHP as number;

    // Spawn enemy directly on player
    const px = before.playerX as number;
    const py = before.playerY as number;
    await spawnEnemy(page, 'static_mote', px, py);

    // Wait for contact damage
    await page.waitForFunction(
      (hp) => (window.__CATHODE__?.game.playerHP as number) < hp,
      initialHP,
      { timeout: 5_000 },
    );

    const after = await getState(page);
    expect(after.playerHP as number).toBeLessThan(initialHP);
  });

  test('room clears when all enemies die', async ({ page }) => {
    // First ensure room is not cleared
    await spawnEnemy(page, 'static_mote', 480, 320);
    await page.waitForTimeout(200);

    // Kill all enemies
    await killAllEnemies(page);
    await page.waitForTimeout(500);

    const state = await getState(page);
    expect(state.roomCleared).toBe(true);
  });

  test('screenshot: combat in action', async ({ page }) => {
    await setPlayerInvulnerable(page, true);
    // Spawn several enemies for a visual combat scene
    await spawnEnemy(page, 'static_mote', 300, 200);
    await spawnEnemy(page, 'scanline_crawler', 500, 200);
    await spawnEnemy(page, 'signal_ghost', 400, 400);
    await page.waitForTimeout(200);

    // Shoot toward enemies
    await shootAt(page, 400, 300, 10, 50);
    await page.waitForTimeout(300);

    await snap(page, 'combat-in-action', 'audit');
  });
});
