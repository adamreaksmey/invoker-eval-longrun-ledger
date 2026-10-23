import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const webDirectory = __dirname;
const repositoryDirectory = resolve(webDirectory, "../..");

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    browserName: "chromium",
  },
  webServer: [
    {
      command: "npm --workspace @personal-ledger/api start",
      cwd: repositoryDirectory,
      url: "http://127.0.0.1:3000/auth/me",
      env: {
        PORT: "3000",
        DATABASE_PATH: join(tmpdir(), `personal-ledger-playwright-${process.pid}.sqlite`),
      },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
      cwd: webDirectory,
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
