import { test, expect } from '@playwright/test';
import {
  navigateToGameScene, getCameraState, triggerShoot,
} from '../helpers';

test.describe('06 — Camera Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToGameScene(page);
  });

  test('camera stays at scroll 0,0 during normal gameplay', async ({ page }) => {
    const cam = await getCameraState(page);
    expect(cam.scrollX).toBe(0);
    expect(cam.scrollY).toBe(0);
    console.log(`[MEASURE] camera scroll: (${cam.scrollX}, ${cam.scrollY})`);
  });

  test('camera zoom stays at 1.0', async ({ page }) => {
    const cam = await getCameraState(page);
    expect(cam.zoom).toBe(1);
    console.log(`[MEASURE] camera zoom: ${cam.zoom}`);
  });

  test('shake intensity returns to 0 after duration', async ({ page }) => {
    await triggerShoot(page);
    // Wait for shake to fully decay (50ms shake + margin)
    await page.waitForTimeout(300);
    const cam = await getCameraState(page);
    expect(cam.shakeIntensity).toBeLessThanOrEqual(0.001);
    console.log(`[MEASURE] post-shake intensity: ${cam.shakeIntensity}`);
  });

  test('camera state is consistent across frames', async ({ page }) => {
    // Sample camera state multiple times to ensure consistency
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const cam = await getCameraState(page);
      samples.push(cam.zoom);
      await page.waitForTimeout(100);
    }
    // All zoom values should be 1.0
    for (const z of samples) {
      expect(z).toBe(1);
    }
    console.log(`[MEASURE] zoom stability: ${samples.join(', ')}`);
  });
});
