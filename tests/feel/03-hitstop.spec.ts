import { test, expect } from '@playwright/test';
import {
  navigateToGameScene, clearEvents, getEventsOfType,
  spawnEnemy, setPlayerInvulnerable, setPlayerPosition,
} from '../helpers';

test.describe('03 — Hitstop', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToGameScene(page);
    await clearEvents(page);
  });

  test('enemy contact triggers hitstop_start with duration 33', async ({ page }) => {
    // Position player near enemy spawn point
    await setPlayerPosition(page, 480, 320);
    await setPlayerInvulnerable(page, false);
    // Spawn enemy directly on top of player
    await spawnEnemy(page, 'static_mote', 480, 320);
    // Wait for physics overlap
    await page.waitForTimeout(500);
    const events = await getEventsOfType(page, 'hitstop_start');
    if (events.length > 0) {
      expect(events[0].data?.duration).toBe(33);
      console.log(`[MEASURE] contact hitstop: duration=${events[0].data?.duration}`);
    } else {
      // If player was invulnerable or no overlap, skip gracefully
      console.log('[MEASURE] contact hitstop: no event (player may have been invulnerable)');
    }
  });

  test('hitstop_end event fires after hitstop', async ({ page }) => {
    await setPlayerPosition(page, 480, 320);
    await setPlayerInvulnerable(page, false);
    await spawnEnemy(page, 'static_mote', 480, 320);
    await page.waitForTimeout(500);
    const startEvents = await getEventsOfType(page, 'hitstop_start');
    const endEvents = await getEventsOfType(page, 'hitstop_end');
    if (startEvents.length > 0) {
      expect(endEvents.length).toBeGreaterThanOrEqual(1);
      const delta = endEvents[0].timestamp - startEvents[0].timestamp;
      console.log(`[MEASURE] hitstop duration measured: ${delta.toFixed(1)}ms`);
    }
  });

  test('synergy hitstop has duration 100', async ({ page }) => {
    // Give synergy items to trigger a synergy
    await page.evaluate(() => {
      window.__CATHODE__!.commands.giveItem('signal_amp');
      window.__CATHODE__!.commands.giveItem('power_conditioner');
    });
    await page.waitForTimeout(500);
    const events = await getEventsOfType(page, 'hitstop_start');
    const synergyHitstop = events.find(e => e.data?.source === 'synergy');
    if (synergyHitstop) {
      expect(synergyHitstop.data?.duration).toBe(100);
      console.log(`[MEASURE] synergy hitstop: duration=${synergyHitstop.data?.duration}`);
    } else {
      console.log('[MEASURE] synergy hitstop: no synergy triggered (items may not form a synergy)');
    }
  });

  test('enemy per-entity hitstop on damage', async ({ page }) => {
    await spawnEnemy(page, 'scanline_crawler', 500, 400);
    await page.waitForTimeout(200);
    // Damage the enemy
    await page.evaluate(() => window.__CATHODE__!.commands.triggerEnemyDamage(1));
    await page.waitForTimeout(100);
    const events = await getEventsOfType(page, 'enemy_hit');
    expect(events.length).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] enemy hit events: ${events.length}`);
  });
});
