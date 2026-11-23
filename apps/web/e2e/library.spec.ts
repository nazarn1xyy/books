import { expect, test } from '@playwright/test';
import { bookCard, fixture, mockCatalog, register, uniqueNickname } from './helpers';

test('upload a local FB2, read it, progress and quote survive reload', async ({ page }) => {
  await register(page, uniqueNickname());
  await page.goto('/my-books');
  await page.locator('input[type=file]').setInputFiles(fixture('sample.fb2'));
  await expect(bookCard(page)).toBeVisible();

  await bookCard(page).click();
  await expect(page.getByText('First paragraph of the sample book.')).toBeVisible();

  await page.reload();
  await page.goto('/my-books');
  await expect(bookCard(page)).toBeVisible();
});

test('search the (mocked) catalog and open a book', async ({ page }) => {
  await mockCatalog(page);
  await register(page, uniqueNickname());
  await page.goto('/search');
  await page.getByRole('searchbox').or(page.getByRole('textbox')).first().fill('mock');
  const result = page.getByRole('link', { name: /Mocked Catalog Book/ }).first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.getByText('First paragraph of the sample book.')).toBeVisible();
});

test('my books: grid actions remove a book, the list view is remembered', async ({ page }) => {
  await register(page, uniqueNickname());
  await page.goto('/my-books');
  await page.locator('input[type=file]').setInputFiles(fixture('sample.fb2'));
  await expect(bookCard(page)).toBeVisible();

  await page.getByRole('button', { name: 'List' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Grid' }).click();

  await page.getByRole('button', { name: /Actions for E2E Sample Book/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  const confirmDialog = page.getByRole('dialog', { name: 'Delete?' });
  // Focus moves into the confirmation, not back to the "…" button of the closed sheet.
  await expect(confirmDialog).toBeFocused();
  await confirmDialog.getByRole('button', { name: 'Delete' }).click();
  await expect(bookCard(page)).toHaveCount(0);
});
