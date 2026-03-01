import { test, expect } from '@playwright/test';
import { navigateToGameScene, getState, snap, setPlayerInvulnerable, killAllEnemies } from '../helpers';

test.describe('08 — Bosses', () => {
  test('enumerate all boss IDs', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__CATHODE__ !== undefined, undefined, { timeout: 15_000 });
    const ids = await page.evaluate(() => window.__CATHODE__!.data.allBossIds as string[]);
    expect(ids.length).toBeGreaterThan(0);
    console.log(`Found ${ids.length} bosses: ${ids.join(', ')}`);
  });

  test('boss state is accessible when no boss is active', async ({ page }) => {
    await navigateToGameScene(page);
    await killAllEnemies(page);

    const state = await getState(page);
    expect(state.bossAlive).toBe(false);
    expect(state.bossHP).toBe(0);
    expect(state.bossMaxHP).toBe(0);
  });

  test('screenshot: initial game room (no boss)', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await killAllEnemies(page);
    await page.waitForTimeout(300);
    await snap(page, 'boss-no-boss-room', 'audit');
  });

  // NOTE: Spawning bosses directly requires extending the bridge with a spawnBoss command
  // or navigating through rooms to reach boss rooms. For now we verify the data registry
  // and state accessibility.

  test('boss definitions match expected count', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__CATHODE__ !== undefined, undefined, { timeout: 15_000 });
    const ids = await page.evaluate(() => window.__CATHODE__!.data.allBossIds as string[]);
    // Should have 10 bosses based on BOSS_DEFS
    expect(ids.length).toBe(10);
  });
});
