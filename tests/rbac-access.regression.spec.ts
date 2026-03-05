import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginAsApprover } from "./fixtures/auth";
import { env } from "./fixtures/env";
import { waitForAppReady } from "./helpers/ui";

test.describe("RBAC Access Controls", () => {
  test("admin can access employees and settings @regression", async ({ page }) => {
    test.skip(
      !env("TEST_ADMIN_EMAIL") || !env("TEST_ADMIN_PASSWORD"),
      "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD."
    );

    await loginAsAdmin(page);

    await page.goto("/employees");
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: /employee management/i })).toBeVisible();

    await page.goto("/settings");
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
  });

  test("approver is constrained to time-and-attendance modules @regression", async ({
    page,
  }) => {
    test.skip(
      !env("TEST_APPROVER_EMAIL") || !env("TEST_APPROVER_PASSWORD"),
      "Set TEST_APPROVER_EMAIL and TEST_APPROVER_PASSWORD."
    );

    await loginAsApprover(page);
    await page.goto("/overtime-approval");
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: /ot approvals/i })).toBeVisible();

    // middleware should block approver from settings and redirect back to allowed area
    await page.goto("/settings");
    await waitForAppReady(page);
    await expect(page).toHaveURL(/\/overtime-approval/);
  });
});
