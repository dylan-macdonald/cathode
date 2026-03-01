import { test, expect } from '@playwright/test';
import { waitForBridge, waitForScene, snap, clickGameAt, setSaveData } from '../helpers';

test.describe('10 — Repair Shop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForBridge(page);

    // Give the player some tubes to spend
    await page.evaluate(() => {
      window.__CATHODE__!.commands.resetSave();
      window.__CATHODE__!.commands.setSaveData({ tubes: 5000 });
    });

    // Navigate to RepairShop via bridge (keyboard doesn't work in headless Chrome)
    await waitForScene(page, 'MenuScene', 15_000);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__CATHODE__!.commands.startScene('RepairShopScene'));
    await waitForScene(page, 'RepairShopScene', 15_000);
    await page.waitForTimeout(500);
  });

  test('THE TV station is clickable and shows overlay', async ({ page }) => {
    // Click THE TV (center at 480, 220)
    await clickGameAt(page, 480, 220);
    await page.waitForTimeout(500);
    await snap(page, 'repair-shop-tv-overlay', 'audit');
  });

  test('ANTENNA ARRAY station is clickable', async ({ page }) => {
    // Click Antenna Array (center at 130, 240)
    await clickGameAt(page, 130, 240);
    await page.waitForTimeout(500);
    await snap(page, 'repair-shop-antenna-overlay', 'audit');
  });

  test('SOLDERING STATION is clickable', async ({ page }) => {
    // Click Soldering Station (center at 610, 440)
    await clickGameAt(page, 610, 440);
    await page.waitForTimeout(500);
    await snap(page, 'repair-shop-soldering-overlay', 'audit');
  });

  test('tube count persists across page reload', async ({ page }) => {
    // Verify initial tubes
    const saveStr = await page.evaluate(() => localStorage.getItem('cathode_save_v1'));
    expect(saveStr).toBeTruthy();
    const save = JSON.parse(saveStr!);
    expect(save.tubes).toBe(5000);

    // Reload and check persistence
    await page.reload();
    await waitForBridge(page);
    const saveAfter = await page.evaluate(() => localStorage.getItem('cathode_save_v1'));
    const parsed = JSON.parse(saveAfter!);
    expect(parsed.tubes).toBe(5000);
  });
});
