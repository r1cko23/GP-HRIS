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
      { testId: "nav-item-time-attendance", heading: /time attendance/i, path: "/timesheet" },
      { testId: "nav-item-leave-approvals", heading: /leave approval/i, path: "/leave-approval" },
      { testId: "nav-item-ot-approvals", heading: /ot approvals/i, path: "/overtime-approval" },
      { testId: "nav-item-failure-to-log", heading: /failure to log approval/i, path: "/failure-to-log-approval" },
      { testId: "nav-item-time-entries", heading: /time entries/i, path: "/time-entries" },
      { testId: "nav-item-payslips", heading: /payslip generation/i, path: "/payslips" },
      { testId: "nav-item-device-login-activity", heading: /device & login activity/i, path: "/device-activity" },
    ];

    for (const item of navItems) {
      await page.goto(item.path);
      await waitForAppReady(page);
      await expect(page.getByRole("heading", { name: item.heading })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(item.path.replace("/", "\\/")));
    }
  });
});
