import { test, expect } from '@playwright/test';
import {
  navigateToGameScene, clearEvents, getEventsOfType,
  triggerShoot, triggerSurf, triggerPlayerDamage,
  spawnEnemy, setPlayerInvulnerable, giveItem,
} from '../helpers';

test.describe('01 — Input Latency', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToGameScene(page);
    await clearEvents(page);
  });

  test('shoot trigger produces player_shoot event', async ({ page }) => {
    await triggerShoot(page);
    await page.waitForTimeout(100);
    const events = await getEventsOfType(page, 'player_shoot');
    expect(events.length).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] player_shoot events: ${events.length}`);
  });

  test('surf trigger produces player_surf event', async ({ page }) => {
    await triggerSurf(page);
    await page.waitForTimeout(100);
    const events = await getEventsOfType(page, 'player_surf');
    expect(events.length).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] player_surf events: ${events.length}`);
  });

  test('damage trigger produces player_take_damage event', async ({ page }) => {
    await setPlayerInvulnerable(page, false);
    await triggerPlayerDamage(page, 1);
    await page.waitForTimeout(100);
    const events = await getEventsOfType(page, 'player_take_damage');
    expect(events.length).toBeGreaterThanOrEqual(1);
    const last = events[events.length - 1];
    expect(last.data?.amount).toBe(1);
    console.log(`[MEASURE] player_take_damage: amount=${last.data?.amount}, hpAfter=${last.data?.hpAfter}`);
  });

  test('enemy hit produces enemy_hit event', async ({ page }) => {
    await spawnEnemy(page, 'static_mote', 500, 400);
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__CATHODE__!.commands.triggerEnemyDamage(1));
    await page.waitForTimeout(100);
    const events = await getEventsOfType(page, 'enemy_hit');
    expect(events.length).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] enemy_hit events: ${events.length}`);
  });
});
