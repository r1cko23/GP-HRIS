import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./fixtures/auth";
import { env } from "./fixtures/env";
import { waitForAppReady } from "./helpers/ui";

test.describe("Admin Core Pages", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !env("TEST_ADMIN_EMAIL") || !env("TEST_ADMIN_PASSWORD"),
      "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for admin smoke tests."
    );
    await loginAsAdmin(page);
  });

  test("can access high-risk modules from sidebar @smoke", async ({ page }) => {
    const navItems = [
      { heading: /time attendance/i, path: "/time/attendance" },
      { heading: /leave approval/i, path: "/time/leave" },
      { heading: /ot approvals/i, path: "/time/overtime" },
      { heading: /failure to log approval/i, path: "/time/failure-to-log" },
      { heading: /time entries/i, path: "/time/entries" },
      { heading: /payslips/i, path: "/payroll/payslips" },
      { heading: /^payroll$/i, path: "/payroll" },
      { heading: /device & login activity/i, path: "/reports/devices" },
    ];

    for (const item of navItems) {
      await page.goto(item.path);
      await waitForAppReady(page);
      await expect(page.getByRole("heading", { name: item.heading })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(item.path.replace("/", "\\/")));
    }
  });
});
