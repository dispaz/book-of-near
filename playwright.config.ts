import { defineConfig, devices } from "@playwright/test";

// Each worktree can pick its own port (E2E_PORT) so parallel agents never test each other's build.
const port = Number(process.env.E2E_PORT ?? 4173);
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
