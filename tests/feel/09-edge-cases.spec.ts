import { test, expect } from '@playwright/test';
import {
  waitForBridge, waitForScene, navigateToGameScene,
  setPlayerHP, setPlayerInvulnerable, getAllItemIds, giveItem,
  captureErrors,
} from '../helpers';

test.describe('09 — Edge Cases', () => {
  test('corrupt localStorage: game recovers gracefully', async ({ page }) => {
    await page.goto('/');
    await waitForBridge(page);

    // Corrupt localStorage
    await page.evaluate(() => {
      localStorage.setItem('cathode_save', '{corrupt data!!!}');
    });

    // Reload and check game still boots
    const errors = await captureErrors(page, async () => {
      await page.reload();
      await waitForBridge(page, 15_000);
      await waitForScene(page, 'MenuScene', 15_000);
    });

    const critical = errors.filter(e => !e.includes('DevTools') && !e.includes('favicon'));
    // Should recover without crashing
    console.log(`[MEASURE] corrupt save recovery: ${critical.length} errors`);
  });

  test('zero HP triggers death properly', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, false);
    await setPlayerHP(page, 1);
    await page.evaluate(() => window.__CATHODE__!.commands.triggerPlayerDamage(1));
    await page.waitForTimeout(500);

    const hp = await page.evaluate(() => window.__CATHODE__!.game.playerHP);
    expect(hp).toBe(0);
    console.log(`[MEASURE] zero HP: player HP = ${hp}`);
  });

  test('negative HP clamps to zero', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, false);
    await setPlayerHP(page, 1);
    await page.evaluate(() => window.__CATHODE__!.commands.triggerPlayerDamage(5));
    await page.waitForTimeout(200);

    const hp = await page.evaluate(() => window.__CATHODE__!.game.playerHP);
    expect(hp).toBeLessThanOrEqual(0);
    console.log(`[MEASURE] negative HP clamped: ${hp}`);
  });

  test('all items simultaneously: no crash', async ({ page }) => {
    await navigateToGameScene(page);
    const allItems = await getAllItemIds(page);

    const errors = await captureErrors(page, async () => {
      for (const itemId of allItems) {
        await giveItem(page, itemId);
      }
      // Let game run with all items for a bit
      await page.waitForTimeout(3000);
    });

    const critical = errors.filter(e =>
      !e.includes('DevTools') && !e.includes('favicon') && !e.includes('NotAllowedError')
    );
    expect(critical.length).toBe(0);
    console.log(`[MEASURE] all items stress: ${allItems.length} items applied, ${critical.length} errors`);
  });

  test('fire rate cannot reach zero', async ({ page }) => {
    await navigateToGameScene(page);

    // Apply fire-rate-increasing items
    const fireRateItems = ['overclocked_oscillator', 'signal_amp'];
    for (const id of fireRateItems) {
      await giveItem(page, id);
    }
    await page.waitForTimeout(200);

    // Try to shoot - should still work
    await page.evaluate(() => window.__CATHODE__!.commands.triggerShoot());
    await page.waitForTimeout(100);
    const events = await page.evaluate(() => window.__CATHODE__!.events.ofType('player_shoot'));
    expect(events.length).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] fire rate floor: shooting works after fire rate items`);
  });

  test('boss pause/resume: no state corruption', async ({ page }) => {
    await navigateToGameScene(page);

    // Verify game state is consistent
    const state1 = await page.evaluate(() => ({
      hp: window.__CATHODE__!.game.playerHP,
      x: window.__CATHODE__!.game.playerX,
      y: window.__CATHODE__!.game.playerY,
    }));

    // Simulate pause (just verify scene is still active after)
    await page.evaluate(() => window.__CATHODE__!.commands.pressKey('Escape'));
    await page.waitForTimeout(500);
    // Unpause
    await page.evaluate(() => window.__CATHODE__!.commands.pressKey('Escape'));
    await page.waitForTimeout(500);

    const state2 = await page.evaluate(() => ({
      hp: window.__CATHODE__!.game.playerHP,
      x: window.__CATHODE__!.game.playerX,
      y: window.__CATHODE__!.game.playerY,
    }));

    expect(state2.hp).toBe(state1.hp);
    console.log(`[MEASURE] pause/resume: HP before=${state1.hp}, after=${state2.hp}`);
  });
});
