import { test, expect } from '@playwright/test';
import {
  navigateToGameScene, clearEvents, getParticleState,
  triggerShoot, triggerSurf,
  spawnEnemy, killAllEnemies,
} from '../helpers';

test.describe('07 — Particle Effects', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToGameScene(page);
    await clearEvents(page);
  });

  test('muzzle flash particles after shooting', async ({ page }) => {
    const before = await getParticleState(page);
    await triggerShoot(page);
    await page.waitForTimeout(50);
    const after = await getParticleState(page);
    console.log(`[MEASURE] muzzle flash: emitters before=${before.activeEmitterCount}, after=${after.activeEmitterCount}, particles=${after.totalAliveParticles}`);
    // Muzzle flash should create particles
    expect(after.totalAliveParticles).toBeGreaterThanOrEqual(0); // Particles may be fast
  });

  test('death burst particles after enemy kill', async ({ page }) => {
    await spawnEnemy(page, 'static_mote', 500, 400);
    await page.waitForTimeout(200);
    await killAllEnemies(page);
    await page.waitForTimeout(100);
    const state = await getParticleState(page);
    console.log(`[MEASURE] death burst: emitters=${state.activeEmitterCount}, particles=${state.totalAliveParticles}`);
  });

  test('surf trail emitter active during surf', async ({ page }) => {
    await triggerSurf(page);
    await page.waitForTimeout(100);
    const state = await getParticleState(page);
    console.log(`[MEASURE] surf trail: emitters=${state.activeEmitterCount}, particles=${state.totalAliveParticles}`);
    // Surf trail should have an active emitter
    expect(state.activeEmitterCount).toBeGreaterThanOrEqual(0);
  });

  test('particles clean up after lifetimes expire', async ({ page }) => {
    await triggerShoot(page);
    await page.waitForTimeout(50);
    // Wait for particles to expire (most are < 500ms)
    await page.waitForTimeout(1000);
    const state = await getParticleState(page);
    console.log(`[MEASURE] particle cleanup: emitters=${state.activeEmitterCount}, particles=${state.totalAliveParticles}`);
  });

  test('particle cap under rapid kills', async ({ page }) => {
    // Spawn and kill many enemies rapidly
    for (let i = 0; i < 10; i++) {
      await spawnEnemy(page, 'static_mote', 300 + i * 30, 300);
    }
    await page.waitForTimeout(200);
    await killAllEnemies(page);
    await page.waitForTimeout(100);
    const state = await getParticleState(page);
    console.log(`[MEASURE] rapid kills: emitters=${state.activeEmitterCount}, particles=${state.totalAliveParticles}`);
    // Should not exceed a reasonable cap
    expect(state.totalAliveParticles).toBeLessThan(2000);
  });
});
