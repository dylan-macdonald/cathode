import { test, expect } from '@playwright/test';
import { navigateToGameScene, getState, snap, killAllEnemies, setPlayerInvulnerable, spawnEnemy } from '../helpers';

test.describe('Gallery — Channels', () => {
  test('screenshot: default channel (static) gameplay', async ({ page }) => {
    await navigateToGameScene(page);
    await setPlayerInvulnerable(page, true);
    await spawnEnemy(page, 'static_mote', 400, 300);
    await spawnEnemy(page, 'scanline_crawler', 550, 250);
    await page.waitForTimeout(500);

    const state = await getState(page);
    expect(state.channelId).toBe('static');
    await snap(page, 'gallery-channel-static', 'gallery');
  });

  test('enumerate channels for gallery', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__CATHODE__ !== undefined, undefined, { timeout: 15_000 });
    const channels = await page.evaluate(() => window.__CATHODE__!.data.allChannelIds as string[]);
    console.log(`Channels for gallery: ${channels.join(', ')}`);
    expect(channels.length).toBeGreaterThan(0);
  });
});
