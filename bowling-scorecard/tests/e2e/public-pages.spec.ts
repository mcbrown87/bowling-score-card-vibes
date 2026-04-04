import { expect, test } from '@playwright/test';

test('anonymous users see the landing page and auth links', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome to Bowling Scorecard Vibes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
});

test('login page renders credential and Google sign-in options', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('signup page enforces the minimum password length in the browser', async ({ page }) => {
  await page.goto('/signup');

  await page.getByLabel('Name').fill('E2E Bowler');
  await page.getByLabel('Email').fill('e2e@example.com');
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Sign Up' }).click();

  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel('Password')).toHaveJSProperty('validationMessage', 'Please lengthen this text to 8 characters or more (you are currently using 5 characters).');
});
