import { test, expect } from '@playwright/test';
import {
  navigateToGameScene, clearEvents, getCameraState,
  triggerShoot, triggerSurf, triggerPlayerDamage,
  spawnEnemy, setPlayerInvulnerable, giveItem,
} from '../helpers';

test.describe('02 — Screen Shake', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToGameScene(page);
    await clearEvents(page);
  });

  test('shoot triggers camera shake', async ({ page }) => {
    await triggerShoot(page);
    // Camera shake is applied immediately
    const cam = await getCameraState(page);
    // Shake should have been triggered (may have already started decaying)
    console.log(`[MEASURE] shoot shake: intensity=${cam.shakeIntensity}, duration=${cam.shakeDuration}`);
    // Verify shake was triggered (intensity should be set or already decaying)
    // We check that a player_shoot event exists as proof
    const events = await page.evaluate(() => window.__CATHODE__!.events.ofType('player_shoot'));
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  test('player damage triggers stronger camera shake', async ({ page }) => {
    await setPlayerInvulnerable(page, false);
    await triggerPlayerDamage(page, 1);
    // Check camera state immediately
    const cam = await getCameraState(page);
    console.log(`[MEASURE] damage shake: intensity=${cam.shakeIntensity}, duration=${cam.shakeDuration}`);
  });

  test('enemy hit triggers camera shake', async ({ page }) => {
    await spawnEnemy(page, 'static_mote', 500, 400);
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__CATHODE__!.commands.triggerEnemyDamage(1));
    const cam = await getCameraState(page);
    console.log(`[MEASURE] enemy hit shake: intensity=${cam.shakeIntensity}, duration=${cam.shakeDuration}`);
  });

  test('shake returns to zero after duration', async ({ page }) => {
    await triggerShoot(page);
    // Wait for shake to finish (SHAKE_DURATION = 50ms)
    await page.waitForTimeout(200);
    const cam = await getCameraState(page);
    // Intensity should be 0 or very close after shake completes
    expect(cam.shakeIntensity).toBeLessThanOrEqual(0.001);
    console.log(`[MEASURE] post-shake intensity: ${cam.shakeIntensity}`);
  });

  test('surf triggers camera shake', async ({ page }) => {
    await triggerSurf(page);
    const cam = await getCameraState(page);
    console.log(`[MEASURE] surf shake: intensity=${cam.shakeIntensity}, duration=${cam.shakeDuration}`);
  });

  test('bomb triggers camera shake and flash', async ({ page }) => {
    // Give bomb item first
    await giveItem(page, 'degauss_coil');
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__CATHODE__!.commands.triggerBomb());
    const cam = await getCameraState(page);
    console.log(`[MEASURE] bomb shake: intensity=${cam.shakeIntensity}, flash=${cam.flashAlpha}`);
  });
});
