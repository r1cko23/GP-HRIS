import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./fixtures/auth";
import { env } from "./fixtures/env";
import { waitForAppReady } from "./helpers/ui";

test.describe("Payroll Payslip Reliability", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !env("TEST_ADMIN_EMAIL") || !env("TEST_ADMIN_PASSWORD"),
      "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for payroll tests."
    );
    await loginAsAdmin(page);
  });

  test("payslip screen renders core payroll blocks @regression", async ({ page }) => {
    await page.goto("/payroll/payslips");
    await waitForAppReady(page);

    await expect(page.getByText("Payslip Generation")).toBeVisible();
    await expect(page.getByText("Government Contributions")).toBeVisible();
    await expect(page.getByText("Earnings Breakdown")).toBeVisible();
    await expect(page.getByText("Deductions")).toBeVisible();
  });
});
