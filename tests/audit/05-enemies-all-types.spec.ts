import { test, expect } from '@playwright/test';
import { navigateToGameScene, spawnEnemy, killAllEnemies, getState, snap, setPlayerInvulnerable, setPlayerPosition } from '../helpers';

test.describe('05 — All Enemy Types', () => {
  // This test iterates all enemy types — needs extra time
  test.setTimeout(120_000);

  test('enumerate all enemy types from registry', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__CATHODE__ !== undefined, undefined, { timeout: 15_000 });
    const types = await page.evaluate(() => window.__CATHODE__!.data.allEnemyTypes as string[]);
    expect(types.length).toBeGreaterThan(0);
    console.log(`Found ${types.length} enemy types: ${types.join(', ')}`);
  });

  test('spawn and verify each enemy type', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await setPlayerPosition(page, 100, 320);

    const types = await page.evaluate(() => window.__CATHODE__!.data.allEnemyTypes as string[]);
    const spawned: string[] = [];
    const failedSpawn: string[] = [];

    for (const type of types) {
      await killAllEnemies(page);
      await page.waitForTimeout(100);

      // Spawn the enemy
      await spawnEnemy(page, type, 600, 320);
      await page.waitForTimeout(200);

      const afterSpawn = await getState(page);
      if ((afterSpawn.enemyCount as number) >= 1) {
        spawned.push(type);
      } else {
        failedSpawn.push(type);
      }
    }

    console.log(`Successfully spawned: ${spawned.length}/${types.length}`);
    if (failedSpawn.length > 0) {
      console.log(`Could not spawn (may require special conditions): ${failedSpawn.join(', ')}`);
    }
    // All enemy types should be spawnable via the bridge
    expect(failedSpawn.length).toBe(0);
  });

  test('kill spawnable enemy types via bridge', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await setPlayerPosition(page, 100, 320);

    const types = await page.evaluate(() => window.__CATHODE__!.data.allEnemyTypes as string[]);
    const killed: string[] = [];
    const failedKill: string[] = [];

    for (const type of types) {
      await killAllEnemies(page);
      await page.waitForTimeout(100);

      await spawnEnemy(page, type, 600, 320);
      await page.waitForTimeout(200);

      const before = await getState(page);
      if ((before.enemyCount as number) < 1) continue; // Skip non-spawnable types

      // Kill via bridge (handles split-on-death enemies internally)
      await killAllEnemies(page);
      await page.waitForTimeout(300);

      const after = await getState(page);
      if ((after.enemyCount as number) === 0) {
        killed.push(type);
      } else {
        failedKill.push(type);
      }
    }

    console.log(`Successfully killed: ${killed.length} types`);
    if (failedKill.length > 0) {
      console.log(`Survived killAllEnemies (may split on death): ${failedKill.join(', ')}`);
    }
    // All spawnable enemies should be killable (bridge handles split-on-death)
    expect(failedKill.length).toBe(0);
  });

  test('screenshot: enemy gallery (first 6 types)', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await setPlayerPosition(page, 100, 320);

    const types = await page.evaluate(() => window.__CATHODE__!.data.allEnemyTypes as string[]);
    const batch = types.slice(0, 6);

    for (let i = 0; i < batch.length; i++) {
      await spawnEnemy(page, batch[i], 300 + (i % 3) * 150, 200 + Math.floor(i / 3) * 200);
    }
    await page.waitForTimeout(500);
    await snap(page, 'enemy-gallery-batch1', 'audit');
  });
});
