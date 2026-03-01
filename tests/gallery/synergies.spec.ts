import { test, expect } from '@playwright/test';
import { navigateToGameScene, giveItem, getState, snap, killAllEnemies } from '../helpers';

test.describe('Gallery — Synergies', () => {
  test('screenshot: all synergies active', async ({ page }) => {
    await navigateToGameScene(page);
    await killAllEnemies(page);

    // Give all items to activate all synergies
    const ids = await page.evaluate(() => window.__CATHODE__!.data.allItemIds as string[]);
    for (const id of ids) {
      await giveItem(page, id);
    }
    await page.waitForTimeout(500);

    const state = await getState(page);
    const synergies = state.activeSynergies as string[];
    console.log(`Active synergies: ${synergies.join(', ')}`);

    await snap(page, 'gallery-synergies-all-active', 'gallery');
  });
});
