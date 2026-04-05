import { expect, test } from '@playwright/test';

const dataUrl =
  'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

const buildPagePayload = (page: number) => {
  const imageCount = page === 1 ? 50 : 25;

  return ({
  success: true,
  page,
  pageSize: 50,
  totalImages: 75,
  totalPages: 2,
  images: Array.from({ length: imageCount }, (_, index) => ({
      id: `image-page-${page}-${index + 1}`,
      previewUrl: dataUrl,
      originalFileName: `score-page-${page}-${index + 1}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      createdAt: '2026-04-05T12:00:00.000Z',
      games: [
        {
          id: `game-page-${page}-${index + 1}`,
          gameIndex: 0,
          isEstimate: false,
          playerName: `Library Player ${page}-${index + 1}`,
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
    }))
  });
};

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

test('library navigation continues across paginated image batches with one previous and next control', async ({ page }) => {
  await page.goto('/library?e2e=1');

  await expect(page.getByText('Image 1 of 75')).toBeVisible();
  await expect(page.getByText('Corrections saved for this game')).toBeVisible();
  await expect(page.getByAltText('Uploaded scorecard score-page-1-1.jpg')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous Page' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next Page' })).toHaveCount(0);

  for (let index = 0; index < 50; index += 1) {
    await page.getByRole('button', { name: 'Next →' }).click();
  }

  await expect(page.getByText('Image 51 of 75')).toBeVisible();
  await expect(page.getByAltText('Uploaded scorecard score-page-2-1.jpg')).toBeVisible();
  await expect(page.getByRole('button', { name: '← Previous' })).toBeEnabled();

  await page.getByRole('button', { name: '← Previous' }).click();

  await expect(page.getByText('Image 50 of 75')).toBeVisible();
  await expect(page.getByAltText('Uploaded scorecard score-page-1-50.jpg')).toBeVisible();
});
