import { expect, test } from '@playwright/test';
import { nicknameField, passwordField, register, uniqueNickname } from './helpers';

test('register, reload stays logged in, logout, login again', async ({ page }) => {
  const nick = uniqueNickname();
  await register(page, nick);
  await page.reload();
  await expect(page).not.toHaveURL(/\/auth/);

  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'libify_sid')?.httpOnly).toBe(true);

  await page.context().clearCookies();
  await page.goto('/');
  await nicknameField(page).fill(nick.toUpperCase());
  await passwordField(page).fill('password123');
  await page.getByRole('button', { name: 'Log in', exact: true }).last().click();
  await expect(page).not.toHaveURL(/\/auth/);
});

test('shows a readable error for a taken nickname', async ({ page }) => {
  const nick = uniqueNickname();
  await register(page, nick);
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/auth');
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await nicknameField(page).fill(nick);
  await passwordField(page).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText(/taken/i);
});
