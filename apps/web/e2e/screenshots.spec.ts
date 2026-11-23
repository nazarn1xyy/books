import { readFileSync } from 'node:fs';
import { test, type Page } from '@playwright/test';
import { fixture, register, uniqueNickname } from './helpers';

// Report screenshots, not assertions: SHOTS=1 npx playwright test screenshots
// SHOTS_DIR picks a sub-folder (e.g. "before" / "after").
test.skip(!process.env.SHOTS, 'set SHOTS=1 to capture screenshots');

const dir = `e2e/__screenshots__${process.env.SHOTS_DIR ? `/${process.env.SHOTS_DIR}` : ''}`;

const PALETTE = ['#7c2d12', '#1e3a8a', '#14532d', '#581c87', '#9a3412', '#0f766e', '#831843', '#3f3f46', '#a16207', '#155e75'];
const TITLES = [
  'Война и мир', '&amp;laquo;Анна Каренина&amp;raquo;', 'Воскресение', 'Детство', 'Хаджи-Мурат',
  'Крейцерова соната', 'Казаки', 'Смерть Ивана Ильича', 'Севастопольские рассказы', 'Отец Сергий',
];

function coverSvg(i: number): string {
  const c = PALETTE[i % PALETTE.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#111"/></linearGradient></defs>
      <rect width="200" height="300" fill="url(#g)"/><circle cx="100" cy="120" r="${40 + i * 3}" fill="#fff" fill-opacity="0.15"/>
      <rect x="20" y="220" width="160" height="4" fill="#fff" fill-opacity="0.6"/></svg>`;
}

/** A long FB2 with an embedded cover, so started books have covers and measurable progress. */
function richFb2(i: number): string {
  // Keeps the double-escaped `&amp;laquo;` so the FB2 path exercises entity decoding too.
  const title = TITLES[i] ?? 'Book';
  const paragraphs = Array.from({ length: 80 }, (_, n) => `<p>${n === 0 ? 'First paragraph of the sample book.' : `Paragraph ${n} of a long chapter.`}</p>`).join('');
  return `<?xml version="1.0" encoding="utf-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
    <description><title-info><author><first-name>Лев</first-name><last-name>Толстой</last-name></author>
    <book-title>${title}</book-title><coverpage><image l:href="#cover"/></coverpage><lang>ru</lang></title-info></description>
    <body><section>${paragraphs}</section></body>
    <binary id="cover" content-type="image/svg+xml">${Buffer.from(coverSvg(i)).toString('base64')}</binary></FictionBook>`;
}

/** A catalog of ten books with generated covers, so screenshots show real layouts. */
async function mockRichCatalog(page: Page): Promise<void> {
  const entries = TITLES.map(
    (title, i) => `<entry><title>${title}</title><author><name>Лев Толстой</name></author>
      <id>tag:book:${900 + i}</id><link href="/b/${900 + i}/fb2" type="application/fb2+zip"/>
      <link rel="http://opds-spec.org/image" href="/i/${i}/cover.svg" type="image/svg+xml"/></entry>`,
  );
  const opds = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom">${entries.join('')}</feed>`;
  const fb2 = readFileSync(fixture('sample.fb2'));
  await page.route('**/api/catalog/search**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/atom+xml', body: opds }),
  );
  await page.route('**/api/catalog/book/**', (route) => {
    const i = Number(/\/book\/9(\d\d)/.exec(route.request().url())?.[1] ?? -1);
    if (i < 0) return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: fb2 });
    return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: richFb2(i) });
  });
  await page.route('**/api/catalog/image**', (route) => {
    const src = new URL(route.request().url()).searchParams.get('src') ?? '';
    const i = Number(/\/i\/(\d+)\//.exec(src)?.[1] ?? 0);
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: coverSvg(i) });
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`pages in ${theme} theme`, async ({ page }, info) => {
    test.setTimeout(60_000);
    await page.addInitScript((t) => localStorage.setItem('libify.theme', t), theme);
    await mockRichCatalog(page);
    const shot = (name: string) =>
      page.screenshot({ path: `${dir}/${name}-${theme}-${info.project.name}.png` });
    await page.goto('/auth');
    await shot('auth');
    await register(page, uniqueNickname());
    // A few started books: open them in the reader, plus one uploaded file without a cover.
    for (const id of [900, 903, 905]) {
      await page.goto(`/reader/${id}`);
      await page.getByText('First paragraph of the sample book.').waitFor();
      await page.evaluate((dy) => {
        window.scrollBy(0, dy);
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
          if (el.scrollHeight > el.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop += dy;
        }
      }, 1500 + (id - 900) * 400);
      await page.waitForTimeout(1800);
    }
    await page.goto('/my-books');
    await page.locator('input[type=file]').setInputFiles(fixture('sample.fb2'));
    await page.getByRole('link', { name: /E2E Sample Book/ }).first().waitFor();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await shot('home');
    await page.goto('/search?q=test');
    await page.waitForLoadState('networkidle');
    await shot('search');
    await page.goto('/my-books');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await shot('my-books');
    await page.goto('/reader/900');
    await page.getByText(/Paragraph \d+ of a long chapter/).first().waitFor();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.waitForTimeout(400);
    await shot('reader-settings');
  });
}
