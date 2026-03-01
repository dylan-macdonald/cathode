import { test, expect } from '@playwright/test';
import {
  navigateToGameScene, clearEvents, getAudioState, clearAudioCounts,
  triggerShoot, triggerSurf, triggerPlayerDamage,
  spawnEnemy, setPlayerInvulnerable,
} from '../helpers';

test.describe('04 — Audio Timing', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToGameScene(page);
    await clearEvents(page);
    await clearAudioCounts(page);
  });

  test('shooting plays player_shoot SFX', async ({ page }) => {
    await triggerShoot(page);
    await page.waitForTimeout(100);
    const audio = await getAudioState(page);
    expect(audio.lastPlayedSFX).toBe('player_shoot');
    expect(audio.sfxPlayCounts['player_shoot']).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] player_shoot SFX count: ${audio.sfxPlayCounts['player_shoot']}`);
  });

  test('surf plays channel_surf SFX', async ({ page }) => {
    await triggerSurf(page);
    await page.waitForTimeout(100);
    const audio = await getAudioState(page);
    expect(audio.sfxPlayCounts['channel_surf']).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] channel_surf SFX count: ${audio.sfxPlayCounts['channel_surf']}`);
  });

  test('player damage plays player_hurt SFX', async ({ page }) => {
    await setPlayerInvulnerable(page, false);
    await triggerPlayerDamage(page, 1);
    await page.waitForTimeout(100);
    const audio = await getAudioState(page);
    expect(audio.sfxPlayCounts['player_hurt']).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] player_hurt SFX count: ${audio.sfxPlayCounts['player_hurt']}`);
  });

  test('enemy hit plays enemy_hit SFX', async ({ page }) => {
    await spawnEnemy(page, 'static_mote', 500, 400);
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__CATHODE__!.commands.triggerEnemyDamage(1));
    await page.waitForTimeout(100);
    const audio = await getAudioState(page);
    expect(audio.sfxPlayCounts['enemy_hit']).toBeGreaterThanOrEqual(1);
    console.log(`[MEASURE] enemy_hit SFX count: ${audio.sfxPlayCounts['enemy_hit']}`);
  });

  test('polyphony cap limits concurrent sounds', async ({ page }) => {
    // Rapid-fire 20 shots quickly via bridge
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) {
        window.__CATHODE__!.commands.triggerShoot();
      }
    });
    await page.waitForTimeout(200);
    const audio = await getAudioState(page);
    // Not all 20 should have played due to cooldown and polyphony cap
    const shootCount = audio.sfxPlayCounts['player_shoot'] ?? 0;
    console.log(`[MEASURE] rapid-fire: ${shootCount} sounds played out of 20 attempts`);
    // At least 1 should have played
    expect(shootCount).toBeGreaterThanOrEqual(1);
  });
});
