import { test, expect } from '@playwright/test';
import { navigateToGameScene, getState, snap } from '../helpers';

test.describe('09 — Channels', () => {
  test('enumerate all channel IDs', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__CATHODE__ !== undefined, undefined, { timeout: 15_000 });
    const ids = await page.evaluate(() => window.__CATHODE__!.data.allChannelIds as string[]);
    expect(ids.length).toBeGreaterThan(0);
    console.log(`Found ${ids.length} channels: ${ids.join(', ')}`);
  });

  test('default run starts in static channel', async ({ page }) => {
    await navigateToGameScene(page);
    const state = await getState(page);
    // Default channel should be 'static' (CH 2) which is always unlocked
    expect(state.channelId).toBe('static');
    await snap(page, 'channel-static', 'audit');
  });

  test('channel ID is a valid registered channel', async ({ page }) => {
    await navigateToGameScene(page);
    const state = await getState(page);
    const allChannels = await page.evaluate(() => window.__CATHODE__!.data.allChannelIds as string[]);
    expect(allChannels).toContain(state.channelId as string);
  });

  test('screenshot: starting channel visual', async ({ page }) => {
    await navigateToGameScene(page);
    await page.waitForTimeout(500);
    await snap(page, 'channel-gameplay', 'audit');
  });
});
