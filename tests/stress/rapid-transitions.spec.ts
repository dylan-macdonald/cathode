import { test, expect } from '@playwright/test';
import { navigateToGameScene, killAllEnemies, setPlayerInvulnerable, getState, snap } from '../helpers';

test.describe('Stress — Rapid Room Transitions', () => {
  test('multiple clear-room cycles: no crash', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);

    // Perform repeated room clears
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.__CATHODE__!.commands.clearRoom());
      await page.waitForTimeout(300);
    }

    // Verify game is still running
    const active = await page.evaluate(() => window.__CATHODE__?.isSceneActive('GameScene'));
    expect(active).toBe(true);

    const state = await getState(page);
    expect(typeof state.playerHP).toBe('number');
    expect(isNaN(state.playerHP as number)).toBe(false);
    await snap(page, 'stress-rapid-transitions', 'stress');
  });
});
