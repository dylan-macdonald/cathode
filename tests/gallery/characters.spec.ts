import { test, expect } from '@playwright/test';
import { waitForBridge, waitForScene, snap } from '../helpers';

test.describe('Gallery — Characters', () => {
  test('screenshot: character select screen', async ({ page }) => {
    await page.goto('/');
    await waitForBridge(page);

    await waitForScene(page, 'MenuScene', 15_000);
    await page.waitForTimeout(500);

    // Navigate directly via bridge (keyboard doesn't work in headless Chrome)
    await page.evaluate(() => window.__CATHODE__!.commands.startScene('RepairShopScene'));
    await waitForScene(page, 'RepairShopScene', 15_000);
    await page.waitForTimeout(500);

    // Go to CharacterSelect via bridge
    await page.evaluate(() => window.__CATHODE__!.commands.startScene('CharacterSelectScene'));
    await waitForScene(page, 'CharacterSelectScene', 10_000);
    await page.waitForTimeout(500);
    await snap(page, 'gallery-character-select', 'gallery');
  });
});
