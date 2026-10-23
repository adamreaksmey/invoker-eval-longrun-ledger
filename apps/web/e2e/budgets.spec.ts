import { expect, test, type Page } from "@playwright/test";

const password = "endurance-test-password";

function uniqueUsername() {
  return `e2e_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

async function register(page: Page) {
  const username = uniqueUsername();
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Good to see you, ${username}.` })).toBeVisible();
}

async function budgetsApi(page: Page, path: string, method = "GET", data?: unknown) {
  const cookies = await page.context().cookies();
  return page.request.fetch(`http://127.0.0.1:3000/api/budgets${path}`, {
    method,
    headers: { Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ") },
    data,
  });
}

test("create and edit a monthly budget", async ({ page }) => {
  await register(page);
  await page.getByRole("button", { name: "Budgets" }).click();
  await expect(page.getByRole("heading", { name: "Your budgets" })).toBeVisible();
  const month = new Date().toISOString().slice(0, 7);
  const created = await budgetsApi(page, "", "POST", { categoryId: "Groceries", month, limitCents: 45_000 });
  expect(created.status()).toBe(201);
  const budget = await created.json();
  const updated = await budgetsApi(page, `/${budget.id}`, "PATCH", { categoryId: "Groceries", month, limitCents: 50_000 });
  expect(updated.status()).toBe(200);
  expect((await updated.json()).limitCents).toBe(50_000);
});

test("delete a monthly budget", async ({ page }) => {
  await register(page);
  await page.getByRole("button", { name: "Budgets" }).click();
  await expect(page.getByRole("heading", { name: "Your budgets" })).toBeVisible();
  const month = new Date().toISOString().slice(0, 7);
  const created = await budgetsApi(page, "", "POST", { categoryId: "Travel", month, limitCents: 12_000 });
  expect(created.status()).toBe(201);
  const budget = await created.json();
  const deleted = await budgetsApi(page, `/${budget.id}`, "DELETE");
  expect(deleted.status()).toBe(204);
  expect((await budgetsApi(page, `/${budget.id}`)).status()).toBe(404);
});
