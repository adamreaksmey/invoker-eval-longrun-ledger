import { expect, test, type Page } from "@playwright/test";

const password = "endurance-test-password";

function uniqueUsername() {
  return `e2e_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

async function register(page: Page, username: string) {
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
}

test("register creates an isolated user and opens their ledger", async ({ page }) => {
  const username = uniqueUsername();
  await page.goto("/");
  await register(page, username);

  await expect(page.getByRole("heading", { name: `Good to see you, ${username}.` })).toBeVisible();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
});

test("login accepts a registered user and logout returns to sign in", async ({ page }) => {
  const username = uniqueUsername();
  await page.goto("/");
  await register(page, username);
  await expect(page.getByRole("heading", { name: `Good to see you, ${username}.` })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: `Good to see you, ${username}.` })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  const currentUser = await page.request.get("/api/auth/me");
  expect(currentUser.status()).toBe(401);
});

test("protected ledger API rejects an unauthenticated browser", async ({ page }) => {
  await page.goto("/");
  const accounts = await page.request.get("/api/accounts");

  expect(accounts.status()).toBe(401);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});
