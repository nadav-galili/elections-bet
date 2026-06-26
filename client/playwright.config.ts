import { defineConfig, devices } from '@playwright/test';

// E2E is the smallest layer (we favor unit/component tests). Run via the
// compound-engineering:playwright-test skill. Requires VITE_CLERK_PUBLISHABLE_KEY
// in client/.env so the app boots.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
