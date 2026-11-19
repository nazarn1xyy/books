import { defineConfig, devices } from '@playwright/test';

// Own ports, so a running dev API/web (with dev settings such as the 5/min auth limit) is never reused.
const API_PORT = 3100;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 15'], browserName: 'webkit' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      // High auth limit: every test registers a fresh user from the same IP.
      command: `PORT=${API_PORT} APP_ORIGIN=http://localhost:${WEB_PORT} AUTH_RATE_LIMIT_PER_MIN=1000 npm run dev -w @libify/api`,
      cwd: '../..',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `LIBIFY_API_URL=http://localhost:${API_PORT} npm run dev -w @libify/web -- --port ${WEB_PORT} --strictPort`,
      cwd: '../..',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
