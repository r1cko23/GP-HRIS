import { test, expect } from "@playwright/test";
import { env } from "./fixtures/env";
import { loginAsEmployee } from "./fixtures/auth";
import { waitForAppReady } from "./helpers/ui";

/**
 * Employee Leave Request: history and LWOP half-day
 * - My Leave Requests section is visible
 * - LWOP shows Half-Day Leave Options when at least one date is selected
 *
 * Run: npx playwright test tests/leave-request-employee.spec.ts
 * Requires: employee portal credentials in env (e.g. TEST_EMPLOYEE_ID, TEST_EMPLOYEE_PASSWORD)
 * or login manually before running if using a persistent session.
 */
test.describe("Leave Request (Employee Portal)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !env("TEST_EMPLOYEE_ID"),
      "Set TEST_EMPLOYEE_ID/TEST_EMPLOYEE_PASSWORD for employee portal tests."
    );
    await loginAsEmployee(page);
    await page.goto("/employee-portal/leave-request");
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: /leave request/i })).toBeVisible();
  });

  test("My Leave Requests section is visible @smoke", async ({ page }) => {
    await expect(page.getByText("My Leave Requests")).toBeVisible();
    // Either shows list or empty state
    const hasList =
      (await page
        .locator(
          '[class*="border-yellow-300"], [class*="border-emerald-300"], [class*="border-destructive"]'
        )
        .count()) > 0;
    const hasEmpty = (await page.getByText("No leave requests yet").count()) > 0;
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("LWOP shows Half-Day Leave Options when a date is selected @regression", async ({
    page,
  }) => {
    await page.getByRole("radio", { name: /LWOP/ }).click();
    // Pick a weekday in the current month (e.g. 27)
    const day = page.locator('button:has-text("27")').first();
    if ((await day.count()) > 0) {
      await day.click();
      await expect(page.locator('text=Half-Day Leave Options')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('text=0.5 day (4 hours) unpaid leave per date')).toBeVisible();
    } else {
      // If 27 is disabled (e.g. weekend/holiday), try 28
      const alt = page.locator('button:has-text("28")').first();
      if ((await alt.count()) > 0) await alt.click();
      await expect(page.locator('text=Half-Day Leave Options')).toBeVisible({ timeout: 3000 });
    }
  });
});