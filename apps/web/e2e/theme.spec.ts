import { expect, test } from '@playwright/test';

test('the app is always dark', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('a light theme stored by an older version is ignored', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('libify.theme', 'light'));
  await page.goto('/auth');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('a language stored by an older version is ignored (Ukrainian UI)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('libify_language', 'en'));
  await page.goto('/auth');
  await expect(page.getByRole('tab', { name: 'Вхід' })).toBeVisible();
});
