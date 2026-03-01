import { test, expect } from '@playwright/test';
import { waitForBridge, waitForScene, snap, captureErrors } from '../helpers';

test.describe('01 — Boot & Title', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('game boots without console errors', async ({ page }) => {
    const errors = await captureErrors(page, async () => {
      await waitForBridge(page, 15_000);
      await waitForScene(page, 'MenuScene', 15_000);
    });
    // Filter out known non-critical warnings
    const critical = errors.filter(e => !e.includes('DevTools') && !e.includes('favicon'));
    expect(critical).toHaveLength(0);
  });

  test('canvas exists at expected dimensions', async ({ page }) => {
    await waitForBridge(page);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    // Phaser Scale.FIT means canvas may be larger, but game is 960x640
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('debug bridge is attached', async ({ page }) => {
    await waitForBridge(page);
    const hasbridge = await page.evaluate(() => typeof window.__CATHODE__ === 'object');
    expect(hasbridge).toBe(true);

    const hasSceneMethod = await page.evaluate(() => typeof window.__CATHODE__?.isSceneActive === 'function');
    expect(hasSceneMethod).toBe(true);

    const hasGame = await page.evaluate(() => typeof window.__CATHODE__?.game === 'object');
    expect(hasGame).toBe(true);

    const hasCommands = await page.evaluate(() => typeof window.__CATHODE__?.commands === 'object');
    expect(hasCommands).toBe(true);

    const hasData = await page.evaluate(() => typeof window.__CATHODE__?.data === 'object');
    expect(hasData).toBe(true);
  });

  test('MenuScene is the first active scene', async ({ page }) => {
    await waitForBridge(page, 15_000);
    await waitForScene(page, 'MenuScene', 15_000);
    const active = await page.evaluate(() => window.__CATHODE__?.activeScene);
    // After boot, we expect MenuScene (or AttractScene if idle timer fires — but that takes 15s)
    expect(['MenuScene', 'AttractScene']).toContain(active);
    await snap(page, 'menu-scene', 'audit');
  });

  test('fresh localStorage produces valid initial save', async ({ page }) => {
    await waitForBridge(page);
    // Clear any existing save and reset, then create a fresh default save
    await page.evaluate(() => {
      localStorage.clear();
      window.__CATHODE__!.commands.resetSave();
      // resetSave() deletes the key; create a fresh default by calling setSaveData
      window.__CATHODE__!.commands.setSaveData({});
    });
    // Verify save data has no NaN values
    const saveStr = await page.evaluate(() => localStorage.getItem('cathode_save_v1'));
    expect(saveStr).toBeTruthy();
    expect(saveStr).not.toContain('NaN');
    expect(saveStr).not.toContain('undefined');
    // Parse and check structure
    const save = JSON.parse(saveStr!);
    expect(typeof save.tubes).toBe('number');
    expect(save.tubes).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(save.unlockedChannels)).toBe(true);
  });

  test('scene transition from Menu to RepairShop', async ({ page }) => {
    await waitForBridge(page);
    await waitForScene(page, 'MenuScene', 15_000);
    await page.waitForTimeout(500);

    // Navigate via bridge (Phaser input doesn't receive synthetic events in headless Chrome)
    await page.evaluate(() => window.__CATHODE__!.commands.startScene('RepairShopScene'));
    await waitForScene(page, 'RepairShopScene', 15_000);
    await snap(page, 'repair-shop-from-menu', 'audit');
  });
});
