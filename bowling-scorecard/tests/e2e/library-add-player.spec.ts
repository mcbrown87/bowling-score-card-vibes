import { expect, test } from '@playwright/test';

const dataUrl =
  'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

const createGame = (playerName: string, firstFrameTotal = 2, gameIndex = 0) => ({
  id: `game-${gameIndex}`,
  gameIndex,
  isEstimate: false,
  playerName,
  totalScore: firstFrameTotal,
  frames: Array.from({ length: 9 }, (_, index) => ({
    rolls: index === 0 ? [{ pins: 1 }, { pins: 1 }] : [{ pins: 0 }, { pins: 0 }],
    isStrike: false,
    isSpare: false,
    score: index === 0 ? firstFrameTotal : firstFrameTotal
  })),
  tenthFrame: {
    rolls: [{ pins: 0 }, { pins: 0 }],
    isStrike: false,
    isSpare: false,
    score: firstFrameTotal
  }
});

test('library can add a missing player score and persist it after refresh', async ({ page }) => {
  const imagePayload = {
    id: 'image-1',
    previewUrl: dataUrl,
    originalFileName: 'league-night.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    createdAt: '2026-04-05T12:00:00.000Z',
    games: [createGame('Existing Player', 2, 0)],
    isProcessingEstimate: false,
    lastEstimateError: null
  };

  await page.route('**/api/stored-images?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        page: 1,
        pageSize: 50,
        totalImages: 1,
        totalPages: 1,
        images: [imagePayload]
      })
    });
  });

  await page.route('**/api/stored-images/image-1/scores/*', async (route) => {
    const gameIndex = Number.parseInt(route.request().url().split('/').pop() ?? '0', 10);
    const body = JSON.parse(route.request().postData() ?? '{}');
    const game = body.game ?? body;
    const savedGame = {
      id: `saved-${gameIndex}`,
      gameIndex,
      isEstimate: false,
      ...game
    };
    const existingIndex = imagePayload.games.findIndex((entry) => entry.gameIndex === gameIndex);
    if (existingIndex === -1) {
      imagePayload.games.push(savedGame);
    } else {
      imagePayload.games[existingIndex] = savedGame;
    }
    imagePayload.games.sort((left, right) => left.gameIndex - right.gameIndex);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        game: savedGame
      })
    });
  });

  await page.goto('/library?e2e=1');

  await expect(page.getByRole('button', { name: 'Edit player name' })).toContainText(
    'Existing Player'
  );

  await page.getByRole('button', { name: 'Add player score' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit player name' })).toBeVisible();

  await page.getByPlaceholder('Player name').fill('Added Player');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Game 2 of 2')).toBeVisible();
  await expect(page.getByText('Added Player')).toBeVisible();

  const frameSaveRequest = page.waitForRequest((request) => {
    if (
      request.method() !== 'PUT' ||
      !request.url().includes('/api/stored-images/image-1/scores/1')
    ) {
      return false;
    }

    const body = JSON.parse(request.postData() ?? '{}');
    return body.game?.frames?.[0]?.score === 9;
  });

  await page.getByRole('button', { name: 'Edit frame 1', exact: true }).click();
  await page.getByTestId('scorecard-root').press('5');
  await page.getByTestId('scorecard-root').press('4');
  await frameSaveRequest;

  await expect(page.getByTestId('frame-score-1')).toHaveText('9');

  await page.reload();

  await expect(page.getByText('Game 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Show next game' }).click();
  await expect(page.getByText('Game 2 of 2')).toBeVisible();
  await expect(page.getByText('Added Player')).toBeVisible();
  await expect(page.getByTestId('frame-score-1')).toHaveText('9');
});
