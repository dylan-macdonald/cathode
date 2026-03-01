import { test, expect } from '@playwright/test';
import { navigateToGameScene, giveItem, getState, snap, killAllEnemies } from '../helpers';

test.describe('07 — Synergies', () => {
  test('enumerate all synergies', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__CATHODE__ !== undefined, undefined, { timeout: 15_000 });
    const ids = await page.evaluate(() => window.__CATHODE__!.data.allSynergyIds as string[]);
    expect(ids.length).toBeGreaterThan(0);
    console.log(`Found ${ids.length} synergies: ${ids.join(', ')}`);
  });

  test('synergy activates when required items are given', async ({ page }) => {
    await navigateToGameScene(page);
    await killAllEnemies(page);

    // Get synergy definitions from the bridge to know required items
    const synergies = await page.evaluate(() => {
      // Access synergy defs through the module system
      // We'll test by giving items and checking activeSynergies
      return window.__CATHODE__!.data.allSynergyIds as string[];
    });

    expect(synergies.length).toBeGreaterThan(0);

    // Give all items to activate all possible synergies
    const allItems = await page.evaluate(() => window.__CATHODE__!.data.allItemIds as string[]);
    for (const id of allItems) {
      await giveItem(page, id);
    }
    await page.waitForTimeout(500);

    const state = await getState(page);
    const active = state.activeSynergies as string[];
    console.log(`Active synergies after all items: ${active.join(', ')}`);

    // At least some synergies should activate when all items are held
    expect(active.length).toBeGreaterThan(0);
    await snap(page, 'all-synergies-active', 'audit');
  });

  test('synergy list is a subset of known synergy IDs', async ({ page }) => {
    await navigateToGameScene(page);
    await killAllEnemies(page);

    const allItems = await page.evaluate(() => window.__CATHODE__!.data.allItemIds as string[]);
    for (const id of allItems) {
      await giveItem(page, id);
    }
    await page.waitForTimeout(300);

    const state = await getState(page);
    const active = state.activeSynergies as string[];
    const known = await page.evaluate(() => window.__CATHODE__!.data.allSynergyIds as string[]);

    for (const s of active) {
      expect(known).toContain(s);
    }
  });
});
