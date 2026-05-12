import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  retries: 0,
  workers: 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-html', open: 'never' }]
  ],
  use: {
    browserName: 'chromium',
    headless: true,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  outputDir: 'reports/test-results',
  globalSetup: './utils/global-setup.ts',
  globalTeardown: './utils/generate-html-report.ts'
});
