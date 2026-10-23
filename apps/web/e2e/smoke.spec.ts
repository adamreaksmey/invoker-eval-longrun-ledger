import { expect, test } from "@playwright/test";

test("web app starts", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Personal Ledger");
});
