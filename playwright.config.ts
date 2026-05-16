import { defineConfig } from '@playwright/test'

const devPort = process.env.VITE_DEV_PORT || '5173'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${devPort}`

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html']],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_DEV_PORT: devPort,
    },
  },
})

