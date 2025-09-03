import { defineConfig } from '@playwright/test';

// Playwright will build and then start the Next.js server for the tests.
// It will wait until the port responds, then run tests, and finally tear down the server.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'bash -c "npm run build && npm run start"',
    url: process.env.BASE_URL || 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: true,
  },
});

