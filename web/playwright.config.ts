import { defineConfig } from '@playwright/test'

// BASE_URL=https://turnover-map.pages.dev npm run test:e2e  runs the suite against the live site.
const live = process.env.BASE_URL

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: live ?? 'http://localhost:4173',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1300, height: 900 } } },
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: live
    ? undefined
    : { command: 'npm run build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: false },
})
