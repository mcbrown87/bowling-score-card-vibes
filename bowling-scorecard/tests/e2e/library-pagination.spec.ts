import { expect, test } from '@playwright/test';

const dataUrl =
  'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

const buildPagePayload = (page: number) => ({
  success: true,
  page,
  pageSize: 50,
  totalImages: 75,
  totalPages: 2,
  images: [
    {
      id: `image-${page}`,
      previewUrl: dataUrl,
      originalFileName: `score-${page}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      createdAt: '2026-04-05T12:00:00.000Z',
      games: [
        {
          id: `game-${page}`,
          gameIndex: 0,
          isEstimate: false,
          playerName: `Library Player ${page}`,
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
        }
      ],
      isProcessingEstimate: false,
      lastEstimateError: null
    }
  ]
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/stored-images?*', async (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
    const payload = buildPagePayload(Number.isFinite(requestedPage) ? requestedPage : 1);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload)
    });
  });
});

test('library pagination moves between pages and updates the rendered content', async ({ page }) => {
  await page.goto('/library?e2e=1');

  await expect(page.getByText('Page 1 of 2 · 75 uploads')).toBeVisible();
  await expect(page.getByText('Corrections saved for this game')).toBeVisible();
  await expect(page.getByAltText('Uploaded scorecard score-1.jpg')).toBeVisible();

  await page.getByRole('button', { name: 'Next Page' }).click();

  await expect(page.getByText('Page 2 of 2 · 75 uploads')).toBeVisible();
  await expect(page.getByAltText('Uploaded scorecard score-2.jpg')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous Page' })).toBeEnabled();

  await page.getByRole('button', { name: 'Previous Page' }).click();

  await expect(page.getByText('Page 1 of 2 · 75 uploads')).toBeVisible();
  await expect(page.getByAltText('Uploaded scorecard score-1.jpg')).toBeVisible();
});
