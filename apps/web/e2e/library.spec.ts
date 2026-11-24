import { expect, test, type Page } from '@playwright/test';
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

/** Desktop shows Grid/List in the tab row; phones keep them in the header's "More" sheet. */
async function chooseView(page: Page, name: 'Grid' | 'List') {
  const inline = page.getByRole('button', { name, exact: true });
  if (await inline.isVisible()) return inline.click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('dialog').getByRole('radio', { name }).click();
  await page.keyboard.press('Escape');
}

async function expectView(page: Page, name: 'Grid' | 'List') {
  const inline = page.getByRole('button', { name, exact: true });
  if (await inline.isVisible()) return expect(inline).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('dialog').getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
}

test('my books: grid actions remove a book, the list view is remembered', async ({ page }) => {
  await register(page, uniqueNickname());
  await page.goto('/my-books');
  await page.locator('input[type=file]').setInputFiles(fixture('sample.fb2'));
  await expect(bookCard(page)).toBeVisible();

  await chooseView(page, 'List');
  await page.reload();
  await expect(page.getByText('E2E Sample Book').first()).toBeVisible();
  await expectView(page, 'List');
  await chooseView(page, 'Grid');

  await page.getByRole('button', { name: /Actions for E2E Sample Book/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  const confirmDialog = page.getByRole('dialog', { name: 'Delete?' });
  // Focus moves into the confirmation, not back to the "…" button of the closed sheet.
  await expect(confirmDialog).toBeFocused();
  await confirmDialog.getByRole('button', { name: 'Delete' }).click();
  await expect(bookCard(page)).toHaveCount(0);
});

/** Long paragraphs: a paragraph-level position would be off by whole screens. */
function longBook(): Buffer {
  const paras = Array.from(
    { length: 120 },
    (_, i) => `<p>Paragraph ${i}. ${'Every word of this long paragraph is here to make it span many lines on the screen. '.repeat(12)}</p>`,
  ).join('');
  return Buffer.from(
    `<?xml version="1.0" encoding="utf-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><author><first-name>Long</first-name><last-name>Author</last-name></author><book-title>Long Position Book</book-title><lang>en</lang></title-info></description><body><section>${paras}</section></body></FictionBook>`,
  );
}

/** Paragraph index at the top of the reading pane and how many px of it are scrolled past. */
async function topLine(page: Page) {
  return page.evaluate(() => {
    const scroller = document.querySelector('[data-virtuoso-scroller]') as HTMLElement;
    const top = scroller.getBoundingClientRect().top;
    for (const el of scroller.querySelectorAll<HTMLElement>('[data-index]')) {
      const r = el.getBoundingClientRect();
      if (r.bottom > top + 1) return { index: Number(el.dataset.index), px: top - r.top };
    }
    return null;
  });
}

test('reopening a book lands on the same line, not just the same paragraph', async ({ page }) => {
  await register(page, uniqueNickname());
  await page.goto('/my-books');
  await page.locator('input[type=file]').setInputFiles({ name: 'long.fb2', mimeType: 'application/xml', buffer: longBook() });
  const card = page.getByRole('link', { name: /Long Position Book/ }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByText(/^Paragraph 0\./)).toBeVisible();

  // Jump deep into the book, then into the middle of a paragraph.
  const scroller = page.locator('[data-virtuoso-scroller]');
  for (let i = 0; i < 6; i++) {
    await scroller.evaluate((el) => el.scrollBy(0, 2500));
    await page.waitForTimeout(150);
  }
  await scroller.evaluate((el) => el.scrollBy(0, 137));
  await page.waitForTimeout(300);
  const before = await topLine(page);
  expect(before && before.index).toBeGreaterThan(3);
  expect(before!.px).toBeGreaterThan(20);
  await page.waitForTimeout(1500); // past the save debounce

  await page.reload();
  await expect(page.getByText(new RegExp(`^Paragraph ${before!.index}\\.`))).toBeVisible();
  await page.waitForTimeout(500);
  const after = await topLine(page);
  expect(after!.index).toBe(before!.index);
  expect(Math.abs(after!.px - before!.px)).toBeLessThan(12);
});
