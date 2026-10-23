import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `sh -c '
      PORT=3000 DATABASE_PATH=:memory: npm run start --workspace=@personal-ledger/api & api=$!
      npm run dev --workspace=@personal-ledger/web -- --host 127.0.0.1 & web=$!
      trap "kill $api $web 2>/dev/null || true" EXIT INT TERM

      until curl -sS -o /dev/null http://127.0.0.1:3000/auth/me 2>/dev/null; do
        kill -0 $api 2>/dev/null || exit 1
        sleep 0.2
      done
      until curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; do
        kill -0 $web 2>/dev/null || exit 1
        sleep 0.2
      done

      wait
    '`,
    cwd: "../..",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
