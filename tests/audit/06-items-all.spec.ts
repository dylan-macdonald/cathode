import { test, expect } from '@playwright/test';
import { navigateToGameScene, giveItem, getState, snap, killAllEnemies, setPlayerInvulnerable } from '../helpers';

test.describe('06 — All Items', () => {
  test('enumerate all items from registry', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__CATHODE__ !== undefined, undefined, { timeout: 15_000 });
    const ids = await page.evaluate(() => window.__CATHODE__!.data.allItemIds as string[]);
    expect(ids.length).toBeGreaterThan(0);
    console.log(`Found ${ids.length} items: ${ids.join(', ')}`);
  });

  test('each item applies without NaN', async ({ page }) => {
    await navigateToGameScene(page);
    await killAllEnemies(page);

    const ids = await page.evaluate(() => window.__CATHODE__!.data.allItemIds as string[]);
    const problems: string[] = [];

    for (const id of ids) {
      // Give the item
      await giveItem(page, id);
      await page.waitForTimeout(50);

      // Check for NaN in key stats
      const state = await getState(page);
      const checks = [
        ['playerHP', state.playerHP],
        ['playerMaxHP', state.playerMaxHP],
        ['playerDamage', state.playerDamage],
        ['score', state.score],
        ['tubes', state.tubes],
        ['bombs', state.bombs],
      ];

      for (const [name, val] of checks) {
        if (typeof val === 'number' && isNaN(val)) {
          problems.push(`${id}: ${name} is NaN`);
        }
      }
    }

    if (problems.length > 0) {
      console.error('NaN problems:', problems);
    }
    expect(problems).toHaveLength(0);
  });

  test('all items simultaneously: no crash', async ({ page }) => {
    await navigateToGameScene(page);
    await killAllEnemies(page);
    await setPlayerInvulnerable(page, true);

    const ids = await page.evaluate(() => window.__CATHODE__!.data.allItemIds as string[]);

    // Give all items at once
    for (const id of ids) {
      await giveItem(page, id);
    }
    await page.waitForTimeout(500);

    // Verify game is still running
    const state = await getState(page);
    expect(state.playerHP).toBeDefined();
    expect(typeof state.playerHP).toBe('number');
    expect(isNaN(state.playerHP as number)).toBe(false);

    // Verify item count
    expect(state.itemCount as number).toBe(ids.length);

    await snap(page, 'all-items-stacked', 'audit');
  });

  test('collected item IDs match what was given', async ({ page }) => {
    await navigateToGameScene(page);
    await killAllEnemies(page);

    const testItems = ['signal_boost', 'static_guard', 'phosphor_burn'];
    for (const id of testItems) {
      await giveItem(page, id);
    }
    await page.waitForTimeout(100);

    const state = await getState(page);
    const collected = state.collectedItemIds as string[];
    for (const id of testItems) {
      expect(collected).toContain(id);
    }
  });
});
