import { test, expect } from '@playwright/test';
import { navigateToGameScene, getState, movePlayer, snap, setPlayerPosition } from '../helpers';

test.describe('03 — Player Movement', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToGameScene(page);
    // Center the player for movement tests
    await setPlayerPosition(page, 480, 320);
    await page.waitForTimeout(100);
  });

  test('W key moves player up (Y decreases)', async ({ page }) => {
    const before = await getState(page);
    await movePlayer(page, 'up', 400);
    const after = await getState(page);
    expect(after.playerY as number).toBeLessThan(before.playerY as number);
  });

  test('S key moves player down (Y increases)', async ({ page }) => {
    const before = await getState(page);
    await movePlayer(page, 'down', 400);
    const after = await getState(page);
    expect(after.playerY as number).toBeGreaterThan(before.playerY as number);
  });

  test('A key moves player left (X decreases)', async ({ page }) => {
    const before = await getState(page);
    await movePlayer(page, 'left', 400);
    const after = await getState(page);
    expect(after.playerX as number).toBeLessThan(before.playerX as number);
  });

  test('D key moves player right (X increases)', async ({ page }) => {
    const before = await getState(page);
    await movePlayer(page, 'right', 400);
    const after = await getState(page);
    expect(after.playerX as number).toBeGreaterThan(before.playerX as number);
  });

  test('diagonal movement (W+D)', async ({ page }) => {
    const before = await getState(page);
    await page.keyboard.down('w');
    await page.keyboard.down('d');
    await page.waitForTimeout(400);
    await page.keyboard.up('w');
    await page.keyboard.up('d');
    const after = await getState(page);
    expect(after.playerX as number).toBeGreaterThan(before.playerX as number);
    expect(after.playerY as number).toBeLessThan(before.playerY as number);
  });

  test('Channel Surf on SPACE', async ({ page }) => {
    await page.keyboard.press('Space');
    // Brief moment where isSurfing should be true
    const surfing = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        // Check multiple frames for surf state
        let checks = 0;
        function check() {
          if (window.__CATHODE__?.game.playerIsSurfing) {
            resolve(true);
            return;
          }
          checks++;
          if (checks > 30) resolve(false);
          else requestAnimationFrame(check);
        }
        check();
      });
    });
    expect(surfing).toBe(true);
    await snap(page, 'player-surfing', 'audit');
  });

  test('player stays within game bounds', async ({ page }) => {
    // Try to move off-screen in each direction
    await setPlayerPosition(page, 40, 40);
    await movePlayer(page, 'up', 1000);
    await movePlayer(page, 'left', 1000);
    const state = await getState(page);
    expect(state.playerX as number).toBeGreaterThanOrEqual(0);
    expect(state.playerY as number).toBeGreaterThanOrEqual(0);
    expect(state.playerX as number).toBeLessThanOrEqual(960);
    expect(state.playerY as number).toBeLessThanOrEqual(640);
  });
});
