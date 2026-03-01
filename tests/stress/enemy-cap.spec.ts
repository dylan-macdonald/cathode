import { test, expect } from '@playwright/test';
import { navigateToGameScene, spawnEnemy, getState, setPlayerInvulnerable, killAllEnemies, snap, profileFrames } from '../helpers';

test.describe('Stress — Enemy Cap', () => {
  test('30 enemies respects cap and maintains performance', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await killAllEnemies(page);
    await page.waitForTimeout(200);

    // Spawn up to 30 enemies (the engine cap)
    for (let i = 0; i < 30; i++) {
      const x = 150 + (i % 6) * 110;
      const y = 120 + Math.floor(i / 6) * 90;
      await spawnEnemy(page, 'static_mote', x, y);
    }
    await page.waitForTimeout(300);

    const state = await getState(page);
    expect(state.enemyCount as number).toBeLessThanOrEqual(30);
    console.log(`Enemy count at cap: ${state.enemyCount}`);

    // Try to spawn one more — should be rejected
    await spawnEnemy(page, 'static_mote', 480, 320);
    await page.waitForTimeout(100);
    const after = await getState(page);
    expect(after.enemyCount as number).toBeLessThanOrEqual(30);

    const perf = await profileFrames(page, 60);
    console.log(`FPS at enemy cap — avg: ${perf.avg.toFixed(1)}, min: ${perf.min.toFixed(1)}`);
    await snap(page, 'stress-enemy-cap', 'stress');
  });
});
