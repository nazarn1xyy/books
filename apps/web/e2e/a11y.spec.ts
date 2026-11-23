import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockCatalog, pinEnglish, register, uniqueNickname } from './helpers';

const audit = async (page: Page) => {
  // Contrast is measured on the final frame, not mid fade-in.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => n.target.join(' ')),
  }));
};

for (const theme of ['dark', 'light'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('libify.theme', t), theme);
      await mockCatalog(page);
    });

    test('auth page has no WCAG A/AA violations', async ({ page }) => {
      await pinEnglish(page);
      await page.goto('/auth');
      await expect(page.getByRole('tab', { name: 'Sign up' })).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });

    test('signed-in pages have no WCAG A/AA violations', async ({ page }) => {
      await register(page, uniqueNickname());
      for (const path of ['/', '/search?q=test', '/my-books']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        expect({ path, violations: await audit(page) }).toEqual({ path, violations: [] });
      }
    });
  });
}
