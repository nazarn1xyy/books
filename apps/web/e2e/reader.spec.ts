import { expect, test } from '@playwright/test';
import { bookCard, fixture, register, uniqueNickname } from './helpers';

test('a quote saved offline is synced when back online', async ({ page, context }) => {
  await register(page, uniqueNickname());
  await page.goto('/my-books');
  await page.locator('input[type=file]').setInputFiles(fixture('sample.fb2'));
  await bookCard(page).click();
  const paragraph = page.getByText('Second paragraph with a quotable sentence.');
  await expect(paragraph).toBeVisible();

  await context.setOffline(true);
  await paragraph.selectText();
  await page.dispatchEvent('body', 'mouseup');
  await page.getByRole('button', { name: /сохранить цитату|save quote/i }).click();

  const pushed = page.waitForRequest((r) => r.url().includes('/api/sync/push') && r.method() === 'POST');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await pushed;
});
