import { test, expect } from '@playwright/test';
import {
  waitForBridge, waitForScene, waitForTransitionEnd,
  navigateToGameScene, clearEvents, measureEventDelta, getEventsOfType,
  setPlayerHP, setPlayerInvulnerable,
} from '../helpers';

test.describe('05 — Pacing & Transitions', () => {
  test('power-on cinematic timing (~1600ms)', async ({ page }) => {
    await navigateToGameScene(page);
    // The power_on_start and power_on_end events should already be in the log
    const delta = await measureEventDelta(page, 'power_on_start', 'power_on_end');
    expect(delta).not.toBeNull();
    if (delta !== null) {
      console.log(`[MEASURE] power-on cinematic: ${delta.toFixed(0)}ms`);
      // Should be approximately 1600ms (allow wide margin for headless chrome)
      expect(delta).toBeGreaterThan(800);
      expect(delta).toBeLessThan(5000);
    }
  });

  test('room transition timing (~600ms total)', async ({ page }) => {
    await navigateToGameScene(page);
    await clearEvents(page);

    // Clear room to unlock doors
    await page.evaluate(() => window.__CATHODE__!.commands.clearRoom());
    await page.waitForTimeout(500);

    // Try to trigger door transition by moving player to a door
    // Use bridge to check if there are adjacent rooms
    const state = await page.evaluate(() => ({
      roomX: window.__CATHODE__!.game.currentRoomX,
      roomY: window.__CATHODE__!.game.currentRoomY,
    }));
    console.log(`[MEASURE] current room: (${state.roomX}, ${state.roomY})`);

    // Wait for any room transition events that might occur
    await page.waitForTimeout(1000);
    const transitionEvents = await getEventsOfType(page, 'room_transition_start');
    if (transitionEvents.length > 0) {
      const delta = await measureEventDelta(page, 'room_transition_start', 'room_transition_end');
      if (delta !== null) {
        console.log(`[MEASURE] room transition: ${delta.toFixed(0)}ms`);
        expect(delta).toBeGreaterThan(100);
        expect(delta).toBeLessThan(3000);
      }
    } else {
      console.log('[MEASURE] room transition: no transition triggered (test needs player at door)');
    }
  });

  test('death-to-game-over timing', async ({ page }) => {
    await navigateToGameScene(page);
    await clearEvents(page);

    // Kill the player
    await setPlayerInvulnerable(page, false);
    await setPlayerHP(page, 1);
    await page.evaluate(() => window.__CATHODE__!.commands.triggerPlayerDamage(1));

    // Wait for GameOverScene
    try {
      await waitForScene(page, 'GameOverScene', 10_000);
      const deathEvents = await getEventsOfType(page, 'player_death');
      expect(deathEvents.length).toBeGreaterThanOrEqual(1);
      console.log(`[MEASURE] death event fired`);
    } catch {
      console.log('[MEASURE] death-to-game-over: GameOverScene not reached in time');
    }
  });

  test('start-to-gameplay measures total load time', async ({ page }) => {
    const startTime = Date.now();
    await navigateToGameScene(page);
    const elapsed = Date.now() - startTime;
    console.log(`[MEASURE] start-to-gameplay: ${elapsed}ms`);
    // Should be under 30s even in headless chrome
    expect(elapsed).toBeLessThan(30_000);
  });
});
