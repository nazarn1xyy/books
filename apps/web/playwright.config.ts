import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 15'], browserName: 'webkit' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      // High auth limit: every test registers a fresh user from the same IP.
      command: 'AUTH_RATE_LIMIT_PER_MIN=1000 npm run dev -w @libify/api',
      cwd: '../..',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w @libify/web',
      cwd: '../..',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
