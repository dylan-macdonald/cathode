import { test, expect } from '@playwright/test';
import { snap } from '../helpers';

test.describe('Gallery — Bosses', () => {
  test('enumerate boss definitions', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__CATHODE__ !== undefined, undefined, { timeout: 15_000 });
    const bosses = await page.evaluate(() => window.__CATHODE__!.data.allBossIds as string[]);
    console.log(`Boss gallery entries: ${bosses.join(', ')}`);
    expect(bosses.length).toBe(10);
    await snap(page, 'gallery-boss-registry', 'gallery');
  });
});
