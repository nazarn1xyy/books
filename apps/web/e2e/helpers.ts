import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);

export function uniqueNickname(prefix = 'e2e'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 24);
}

/** Pin the UI language so text selectors are stable regardless of the browser locale. */
export async function pinEnglish(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('libify.e2e-language', 'en'));
}

export const nicknameField = (page: Page) => page.getByLabel('Username', { exact: true });
export const passwordField = (page: Page) => page.getByLabel('Password', { exact: true });

export async function register(page: Page, nickname: string, password = 'password123'): Promise<void> {
  await pinEnglish(page);
  await page.goto('/auth');
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await nicknameField(page).fill(nickname);
  await passwordField(page).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'));
}

/** Serves the catalog from fixtures so tests never touch Flibusta. */
export async function mockCatalog(page: Page): Promise<void> {
  const opds = readFileSync(fixture('opds-search.xml'), 'utf8');
  const fb2 = readFileSync(fixture('sample.fb2'));
  await page.route('**/api/catalog/search**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/atom+xml', body: opds }),
  );
  await page.route('**/api/catalog/book/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/octet-stream', body: fb2 }),
  );
}

/** The uploaded sample book's card in My Books. */
export const bookCard = (page: Page) => page.getByRole('link', { name: /E2E Sample Book/ }).first();
