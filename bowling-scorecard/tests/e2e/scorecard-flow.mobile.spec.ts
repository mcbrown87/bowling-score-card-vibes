import path from 'node:path';

import { devices, expect, test } from '@playwright/test';

const { defaultBrowserType: _defaultBrowserType, ...iPhone13 } = devices['iPhone 13'];

test.use(iPhone13);

const uploadFixturePath = path.resolve(__dirname, '../../TestImages/blah.jpg');

const sampleGames = [
  {
    playerName: 'Player One',
    totalScore: 20,
    frames: Array.from({ length: 9 }, () => ({
      rolls: [{ pins: 1 }, { pins: 1 }],
      isStrike: false,
      isSpare: false,
      score: 2
    })),
    tenthFrame: {
      rolls: [{ pins: 1 }, { pins: 1 }, { pins: 0 }],
      isStrike: false,
      isSpare: false,
      score: 20
    }
  },
  {
    playerName: 'Player Two',
    totalScore: 30,
    frames: Array.from({ length: 9 }, () => ({
      rolls: [{ pins: 2 }, { pins: 1 }],
      isStrike: false,
      isSpare: false,
      score: 3
    })),
    tenthFrame: {
      rolls: [{ pins: 2 }, { pins: 1 }, { pins: 0 }],
      isStrike: false,
      isSpare: false,
      score: 30
    }
  }
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/stored-images', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, images: [] })
    });
  });

  await page.route('**/api/extract-scores', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        games: sampleGames
      })
    });
  });
});

test('uploading an image keeps the existing modal correction flow', async ({ page }) => {
  await page.goto('/dev/e2e');

  await page.getByLabel('Upload scorecard').setInputFiles(uploadFixturePath);

  await expect(page.getByRole('button', { name: 'Player Two', exact: true })).toBeVisible();
  await expect(page.getByTestId('frame-score-1')).toHaveText('2');
  await expect(page.getByTestId('frame-score-10')).toHaveText('20');

  await page.getByRole('button', { name: 'Edit frame 1', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Correct Frame 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Set roll1 to 9 pins' }).click();
  await page.getByRole('button', { name: 'Set roll2 to 0 pins' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByRole('dialog', { name: 'Correct Frame 1' })).toBeHidden();
  await expect(page.getByTestId('frame-roll-1-1')).toHaveText('9');
  await expect(page.getByTestId('frame-roll-1-2')).toHaveText('-');
  await expect(page.getByTestId('frame-score-1')).toHaveText('9');
  await expect(page.getByTestId('frame-score-10')).toHaveText('27');
});
