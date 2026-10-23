import { expect, test, type Page } from "@playwright/test";

const password = "endurance-test-password";

function uniqueUsername() {
  return `e2e_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

async function openRecurring(page: Page) {
  const username = uniqueUsername();
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Good to see you, ${username}.` })).toBeVisible();
  const accountResponse = await page.request.post("/api/accounts", {
    data: { id: crypto.randomUUID(), name: "Everyday checking" },
  });
  expect(accountResponse.ok()).toBeTruthy();
  await page.getByRole("button", { name: "Recurring" }).click();
  await expect(page.getByRole("heading", { name: "Recurring rules", exact: true })).toBeVisible();
  return (await accountResponse.json()).id as string;
}

async function recurrenceApi(page: Page, path: string, method = "GET", data?: unknown) {
  const cookies = await page.context().cookies();
  return page.request.fetch(`http://127.0.0.1:3000/api/recurrence${path}`, {
    method,
    headers: { Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ") },
    data,
  });
}

async function createRule(page: Page, accountId: string, description: string, startDate: string) {
  const created = await recurrenceApi(page, "", "POST", {
    accountId,
    amountCents: -7_500,
    description,
    startDate,
    schedule: { frequency: "weekly", weekdays: [new Date(`${startDate}T00:00:00`).getDay()] },
  });
  expect(created.status()).toBe(201);
  return created.json();
}

test("create a weekly expense recurrence", async ({ page }) => {
  const accountId = await openRecurring(page);
  const rule = await createRule(page, accountId, "Weekly groceries", "2026-10-19");
  const listed = await recurrenceApi(page, "/");
  expect(listed.status()).toBe(200);
  expect((await listed.json()).some((item: { id: string; schedule: { frequency: string } }) => item.id === rule.id && item.schedule.frequency === "weekly")).toBe(true);
});

test("apply due recurring entries to the ledger", async ({ page }) => {
  const accountId = await openRecurring(page);
  await createRule(page, accountId, "Weekly groceries", "2026-10-19");

  const applied = await recurrenceApi(page, "/apply-due", "POST", { asOf: "2026-10-23" });
  expect(applied.status()).toBe(200);
  expect((await applied.json()).applied.length).toBeGreaterThan(0);
  const cookies = await page.context().cookies();
  const transactions = await page.request.get("http://127.0.0.1:3000/transactions", {
    headers: { Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ") },
  });
  expect(transactions.ok()).toBeTruthy();
  const entries = await transactions.json();
  expect(entries.some((entry: { description: string }) => entry.description === "Weekly groceries")).toBe(true);
});

test("delete a recurring rule", async ({ page }) => {
  const accountId = await openRecurring(page);
  const rule = await createRule(page, accountId, "Streaming subscription", "2026-10-19");
  const deleted = await recurrenceApi(page, `/${rule.id}`, "DELETE");
  expect(deleted.status()).toBe(204);
  expect((await recurrenceApi(page, `/${rule.id}`)).status()).toBe(404);
});
