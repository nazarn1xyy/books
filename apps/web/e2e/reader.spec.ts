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

test('in page mode, Escape closes the table of contents without leaving the book', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'libify.reader-settings',
      JSON.stringify({ state: { fontSize: 18, brightness: 100, theme: 'dark', fontFamily: 'sans', readerMode: 'page' }, version: 0 }),
    ),
  );
  await register(page, uniqueNickname());
  await page.goto('/my-books');
  await page.locator('input[type=file]').setInputFiles(fixture('sample.fb2'));
  await bookCard(page).click();
  await expect(page.getByText('First paragraph of the sample book.')).toBeVisible();
  const readerUrl = page.url();

  await page.getByRole('button', { name: 'Table of Contents', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).toBeHidden();
  expect(page.url()).toBe(readerUrl);
  await expect(page.getByText('First paragraph of the sample book.')).toBeVisible();
});
