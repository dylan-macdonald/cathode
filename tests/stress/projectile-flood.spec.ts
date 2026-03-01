import { test, expect } from '@playwright/test';
import { navigateToGameScene, setPlayerInvulnerable, killAllEnemies, spawnEnemy, profileFrames, snap } from '../helpers';

test.describe('Stress — Projectile Flood', () => {
  test('many enemies shooting: maintains stability', async ({ page }) => {
    test.setTimeout(120_000);
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await killAllEnemies(page);
    await page.waitForTimeout(200);

    // Spawn enemies that will shoot back
    for (let i = 0; i < 10; i++) {
      await spawnEnemy(page, 'tone_drone', 300 + (i % 5) * 80, 200 + Math.floor(i / 5) * 100);
    }
    // Let enemies fire for a while
    await page.waitForTimeout(3000);

    const perf = await profileFrames(page, 60);
    console.log(`Projectile flood FPS — avg: ${perf.avg.toFixed(1)}, min: ${perf.min.toFixed(1)}`);

    // Game should still be running
    const active = await page.evaluate(() => window.__CATHODE__?.isSceneActive('GameScene'));
    expect(active).toBe(true);
    expect(perf.avg).toBeGreaterThan(0);
    await snap(page, 'stress-projectile-flood', 'stress');
  });
});
