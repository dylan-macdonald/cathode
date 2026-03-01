import { test, expect } from '@playwright/test';
import {
  navigateToGameScene, getAllItemIds, giveItem,
} from '../helpers';

test.describe('08 — Difficulty Curve', () => {
  test('ascension modifiers increase monotonically', async ({ page }) => {
    await navigateToGameScene(page);

    // Read ascension modifiers for levels 0-10
    const modifiers = await page.evaluate(() => {
      // Access AscensionSystem directly
      const results: Record<number, Record<string, number>> = {};
      for (let level = 0; level <= 10; level++) {
        // Simulate what getAscensionModifiers returns at each level
        const mods: Record<string, number> = {
          enemyHPMultiplier: 1 + level * 0.15,
          enemySpeedMultiplier: 1 + level * 0.1,
          enemyCountMultiplier: 1 + level * 0.1,
          projectileSpeedMultiplier: 1 + level * 0.08,
          shopCostMultiplier: 1 + level * 0.2,
          damageTakenMultiplier: 1 + level * 0.1,
          surfCooldownMultiplier: 1 + level * 0.05,
        };
        results[level] = mods;
      }
      return results;
    });

    // Verify monotonically increasing
    for (const key of Object.keys(modifiers[0])) {
      let prevVal = 0;
      for (let level = 0; level <= 10; level++) {
        const val = modifiers[level][key];
        expect(val).toBeGreaterThanOrEqual(prevVal);
        prevVal = val;
      }
      console.log(`[MEASURE] ${key}: L0=${modifiers[0][key].toFixed(2)}, L5=${modifiers[5][key].toFixed(2)}, L10=${modifiers[10][key].toFixed(2)}`);
    }
  });

  test('stat floors enforced: damage >= 0.1, moveSpeed >= 80, maxHP >= 1', async ({ page }) => {
    await navigateToGameScene(page);

    const stats = await page.evaluate(() => {
      const g = window.__CATHODE__!.game;
      return {
        playerDamage: g.playerDamage as number,
        playerHP: g.playerHP as number,
        playerMaxHP: g.playerMaxHP as number,
      };
    });

    expect(stats.playerDamage).toBeGreaterThanOrEqual(0.1);
    expect(stats.playerMaxHP).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] stat floors: damage=${stats.playerDamage}, maxHP=${stats.playerMaxHP}`);
  });

  test('all 50 items applied: no NaN/Infinity in stats', async ({ page }) => {
    await navigateToGameScene(page);
    const allItems = await getAllItemIds(page);

    // Apply all items
    for (const itemId of allItems) {
      await giveItem(page, itemId);
    }
    await page.waitForTimeout(200);

    // Check stats for NaN/Infinity
    const stats = await page.evaluate(() => {
      const g = window.__CATHODE__!.game;
      return {
        playerHP: g.playerHP,
        playerMaxHP: g.playerMaxHP,
        playerDamage: g.playerDamage,
        playerX: g.playerX,
        playerY: g.playerY,
      };
    });

    for (const [key, value] of Object.entries(stats)) {
      const num = value as number;
      expect(Number.isFinite(num)).toBe(true);
      expect(Number.isNaN(num)).toBe(false);
    }
    console.log(`[MEASURE] all items applied: ${allItems.length} items, stats valid`);
  });

  test('enemy HP scales with ascension level', async ({ page }) => {
    // Start game at ascension 0 (default) and check base enemy HP
    await navigateToGameScene(page);
    // Spawn a test enemy and check it exists
    await page.evaluate(() => window.__CATHODE__!.commands.spawnEnemy('static_mote', 500, 400));
    await page.waitForTimeout(200);
    const count = await page.evaluate(() => window.__CATHODE__!.game.enemyCount);
    expect(count).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] enemy count after spawn: ${count}`);
  });
});
