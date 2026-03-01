import { test } from '@playwright/test';
import {
  navigateToGameScene, snap, waitForBridge, waitForScene,
  giveItem, spawnEnemy, setPlayerInvulnerable,
} from '../helpers';

test.describe('10 — Visual Gallery', () => {
  test('screenshot all channels and game states', async ({ page }) => {
    const category = 'gallery';

    // Boot screenshot
    await page.goto('/');
    await waitForBridge(page);
    await waitForScene(page, 'MenuScene');
    await snap(page, 'menu', category);

    // Navigate to game
    await navigateToGameScene(page);
    await snap(page, 'gameplay-default', category);

    // With enemies
    await spawnEnemy(page, 'static_mote', 400, 300);
    await spawnEnemy(page, 'scanline_crawler', 600, 300);
    await spawnEnemy(page, 'signal_ghost', 500, 200);
    await page.waitForTimeout(500);
    await snap(page, 'gameplay-with-enemies', category);

    // With items
    await setPlayerInvulnerable(page, true);
    const sampleItems = ['signal_amp', 'power_conditioner', 'static_guard', 'degauss_coil'];
    for (const id of sampleItems) {
      await giveItem(page, id);
    }
    await page.waitForTimeout(300);
    await snap(page, 'gameplay-with-items', category);

    // After combat
    await page.evaluate(() => window.__CATHODE__!.commands.killAllEnemies());
    await page.waitForTimeout(500);
    await snap(page, 'gameplay-room-cleared', category);

    console.log('[GALLERY] Screenshots saved to test-results/screenshots/gallery/');
  });
});
