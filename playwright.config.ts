import { defineConfig } from "@playwright/test";

// QA suite for the M-Park dashboards, login, and backend APIs.
// Runs against the dev server on http://localhost:3000 with the SQLite
// database from `npx prisma migrate dev` and `npm run seed`.
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // One worker: SQLite allows one writer at a time, and the tests share
  // one database, so serial execution keeps results deterministic.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "public", testMatch: /public\.spec\.ts/ },
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      use: { storageState: ".auth/admin.json" },
    },
    {
      name: "customer",
      testMatch: /customer\.spec\.ts/,
      use: { storageState: ".auth/customer.json" },
    },
    {
      name: "concurrency",
      testMatch: /concurrency\.spec\.ts/,
      use: { storageState: ".auth/admin.json" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
