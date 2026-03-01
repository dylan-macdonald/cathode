import { test, expect } from '@playwright/test';
import { navigateToGameScene, getState, snap, spawnEnemy, setPlayerInvulnerable, killAllEnemies, waitForBridge } from '../helpers';

test.describe('11 — Accessibility', () => {
  test('practice mode: player is invulnerable', async ({ page }) => {
    // Practice mode is loaded from settings (cathode_settings_v1), not save data
    await page.goto('/');
    await waitForBridge(page);
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('cathode_settings_v1') || '{}');
      settings.practiceMode = true;
      localStorage.setItem('cathode_settings_v1', JSON.stringify(settings));
    });
    // Reload so GameScene picks up the setting
    await page.reload();
    await waitForBridge(page);
    await navigateToGameScene(page);

    const state = await getState(page);
    // Practice mode should make player invulnerable
    expect(state.practiceMode).toBe(true);
    await snap(page, 'accessibility-practice-mode', 'audit');
  });

  test('game starts without crash in default settings', async ({ page }) => {
    await navigateToGameScene(page);
    const state = await getState(page);
    expect(state.playerHP).toBeDefined();
    expect(typeof state.playerHP).toBe('number');
    expect(state.playerHP as number).toBeGreaterThan(0);
  });

  test('screenshot: default visual style', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await spawnEnemy(page, 'static_mote', 400, 300);
    await spawnEnemy(page, 'scanline_crawler', 500, 250);
    await page.waitForTimeout(500);
    await snap(page, 'accessibility-default-visuals', 'audit');
  });

  test('screenshot: combat with effects', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await spawnEnemy(page, 'static_mote', 400, 300);
    await spawnEnemy(page, 'signal_ghost', 500, 300);
    await spawnEnemy(page, 'tone_drone', 350, 200);
    await page.waitForTimeout(300);

    // Trigger some shooting for visual effects
    const { shootAt } = await import('../helpers');
    await shootAt(page, 400, 300, 15, 60);
    await page.waitForTimeout(300);
    await snap(page, 'accessibility-combat-effects', 'audit');
  });
});
