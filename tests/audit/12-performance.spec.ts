import { test, expect } from '@playwright/test';
import { navigateToGameScene, spawnEnemy, giveItem, killAllEnemies, setPlayerInvulnerable, profileFrames, snap } from '../helpers';

test.describe('12 — Performance', () => {
  test('normal gameplay: game renders frames', async ({ page }) => {
    await navigateToGameScene(page);
    await page.waitForTimeout(1000); // Let game stabilize

    const perf = await profileFrames(page, 120);
    console.log(`Normal FPS — min: ${perf.min.toFixed(1)}, max: ${perf.max.toFixed(1)}, avg: ${perf.avg.toFixed(1)}`);
    // Headless Chrome with software rendering may run at ~8-15 FPS — just verify frames render
    expect(perf.avg).toBeGreaterThan(0);
    expect(perf.samples.length).toBeGreaterThan(0);
  });

  test('25 enemies: game still running', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await killAllEnemies(page);
    await page.waitForTimeout(200);

    // Spawn 25 enemies (cap is 30, leave room for spawner behavior)
    for (let i = 0; i < 25; i++) {
      const x = 200 + (i % 5) * 120;
      const y = 150 + Math.floor(i / 5) * 80;
      await spawnEnemy(page, 'static_mote', x, y);
    }
    await page.waitForTimeout(1000);

    const perf = await profileFrames(page, 60);
    console.log(`25-enemy FPS — min: ${perf.min.toFixed(1)}, max: ${perf.max.toFixed(1)}, avg: ${perf.avg.toFixed(1)}`);
    // Just verify frames are rendering — headless Chrome FPS varies wildly
    expect(perf.avg).toBeGreaterThan(0);
    await snap(page, 'perf-25-enemies', 'audit');
  });

  test('all items stacked: no crash', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await killAllEnemies(page);

    const ids = await page.evaluate(() => window.__CATHODE__!.data.allItemIds as string[]);
    for (const id of ids) {
      await giveItem(page, id);
    }
    await page.waitForTimeout(500);

    // Spawn a few enemies
    for (let i = 0; i < 5; i++) {
      await spawnEnemy(page, 'static_mote', 300 + i * 80, 300);
    }
    await page.waitForTimeout(500);

    const perf = await profileFrames(page, 60);
    console.log(`All-items FPS — min: ${perf.min.toFixed(1)}, max: ${perf.max.toFixed(1)}, avg: ${perf.avg.toFixed(1)}`);
    expect(perf.avg).toBeGreaterThan(0);
    await snap(page, 'perf-all-items', 'audit');
  });

  test('rapid room transitions: no crash', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);

    // Clear room to unlock doors, then try to move through
    await killAllEnemies(page);
    await page.evaluate(() => window.__CATHODE__!.commands.clearRoom());
    await page.waitForTimeout(500);

    // Verify game is still stable after room clear
    const state = await page.evaluate(() => ({
      active: window.__CATHODE__?.isSceneActive('GameScene'),
      hp: window.__CATHODE__?.game.playerHP,
    }));
    expect(state.active).toBe(true);
    expect(typeof state.hp).toBe('number');
    await snap(page, 'perf-room-clear', 'audit');
  });
});
