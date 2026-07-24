import { expect, test } from '@playwright/test';

test('library mobile navigation uses bottom tabs and a more drawer without page overflow', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route('**/api/stored-images?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        page: 1,
        pageSize: 50,
        totalImages: 0,
        totalPages: 1,
        canEdit: false,
        images: []
      })
    });
  });

  await page.goto('/library?e2e=1');

  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Library' })).toHaveAttribute(
    'aria-current',
    'page'
  );

  const initialLayout = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));

  expect(initialLayout.scrollWidth).toBeLessThanOrEqual(initialLayout.innerWidth);

  await page.getByRole('button', { name: 'Open more navigation' }).click();

  const drawer = page.getByRole('dialog', { name: 'Navigation menu' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('link', { name: 'Upload' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toBeVisible();

  await page.getByRole('button', { name: 'Close navigation menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation menu' })).toBeHidden();
});
