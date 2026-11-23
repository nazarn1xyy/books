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
  // Mobile keeps the switcher in the header's "More" sheet; desktop also shows it in the sidebar.
  const sidebarLight = page.getByRole('complementary').getByRole('radio', { name: 'Light' });
  if (await sidebarLight.isVisible()) {
    await sidebarLight.click();
  } else {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('dialog').getByRole('radio', { name: 'Light' }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
