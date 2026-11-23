import { expect, test } from '@playwright/test';
import { register, uniqueNickname } from './helpers';

test('dark theme is the default', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('switching to light theme persists across reloads', async ({ page }) => {
  await register(page, uniqueNickname());
  await page.goto('/my-books');
  await expect(page.getByRole('heading', { name: 'My Books' })).toBeVisible();
  // Mobile keeps the switcher in an "Appearance" sheet; desktop shows it in the sidebar.
  const appearance = page.getByRole('button', { name: 'Appearance' });
  if (await appearance.isVisible()) await appearance.click();
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
