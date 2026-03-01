import { test, expect } from '@playwright/test';
import { navigateToGameScene, spawnEnemy, killAllEnemies, setPlayerInvulnerable, setPlayerPosition, snap } from '../helpers';

test.describe('Gallery — Enemies', () => {
  test('screenshot: enemy type batches', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await setPlayerPosition(page, 80, 320);

    const types = await page.evaluate(() => window.__CATHODE__!.data.allEnemyTypes as string[]);
    const batchSize = 6;

    for (let batch = 0; batch * batchSize < types.length; batch++) {
      await killAllEnemies(page);
      await page.waitForTimeout(200);

      const slice = types.slice(batch * batchSize, (batch + 1) * batchSize);
      for (let i = 0; i < slice.length; i++) {
        const x = 250 + (i % 3) * 180;
        const y = 180 + Math.floor(i / 3) * 220;
        await spawnEnemy(page, slice[i], x, y);
      }
      await page.waitForTimeout(600);
      await snap(page, `gallery-enemies-batch-${batch}`, 'gallery');
    }
  });
});
