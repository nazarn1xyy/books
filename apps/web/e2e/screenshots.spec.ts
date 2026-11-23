import { test } from '@playwright/test';
import { mockCatalog, register, uniqueNickname } from './helpers';

// Report screenshots, not assertions: SHOTS=1 npx playwright test screenshots
test.skip(!process.env.SHOTS, 'set SHOTS=1 to capture screenshots');

const dir = 'e2e/__screenshots__';

for (const theme of ['dark', 'light'] as const) {
  test(`pages in ${theme} theme`, async ({ page }, info) => {
    await page.addInitScript((t) => localStorage.setItem('libify.theme', t), theme);
    await mockCatalog(page);
    const shot = (name: string) =>
      page.screenshot({ path: `${dir}/${name}-${theme}-${info.project.name}.png` });
    await page.goto('/auth');
    await shot('auth');
    await register(page, uniqueNickname());
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await shot('home');
    await page.goto('/search?q=test');
    await page.waitForLoadState('networkidle');
    await shot('search');
    await page.goto('/my-books');
    await page.waitForLoadState('networkidle');
    await shot('my-books');
    // Reader with the settings sheet open (the reader body keeps its own themes)
    await page.goto('/search?q=mock');
    await page.getByRole('link', { name: /Mocked Catalog Book/ }).first().click();
    await page.getByText('First paragraph of the sample book.').waitFor();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.waitForTimeout(400);
    await shot('reader-settings');
  });
}
