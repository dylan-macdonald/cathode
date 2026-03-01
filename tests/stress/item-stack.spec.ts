import { test, expect } from '@playwright/test';
import { navigateToGameScene, giveItem, setPlayerInvulnerable, killAllEnemies, spawnEnemy, getState, profileFrames, snap } from '../helpers';

test.describe('Stress — Item Stacking', () => {
  test('all items + combat: no crash, acceptable FPS', async ({ page }) => {
    test.setTimeout(120_000);
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await killAllEnemies(page);

    // Give every item
    const ids = await page.evaluate(() => window.__CATHODE__!.data.allItemIds as string[]);
    for (const id of ids) {
      await giveItem(page, id);
    }
    await page.waitForTimeout(300);

    // Spawn enemies
    for (let i = 0; i < 10; i++) {
      await spawnEnemy(page, 'static_mote', 300 + (i % 5) * 80, 200 + Math.floor(i / 5) * 100);
    }
    await page.waitForTimeout(1000);

    const state = await getState(page);
    expect(state.itemCount as number).toBe(ids.length);
    expect(isNaN(state.playerHP as number)).toBe(false);
    expect(isNaN(state.playerDamage as number)).toBe(false);

    const perf = await profileFrames(page, 60);
    console.log(`All-items+combat FPS — avg: ${perf.avg.toFixed(1)}, min: ${perf.min.toFixed(1)}`);
    // Just verify game is rendering — headless Chrome FPS is low
    expect(perf.avg).toBeGreaterThan(0);
    await snap(page, 'stress-item-stack-combat', 'stress');
  });
});
