import { expect, test } from "@playwright/test";
import { loginAsEmployee } from "./fixtures/auth";
import { env } from "./fixtures/env";
import { waitForAppReady } from "./helpers/ui";

test.describe("Employee Portal Core Experience", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !env("TEST_EMPLOYEE_ID"),
      "Set TEST_EMPLOYEE_ID (and optional TEST_EMPLOYEE_PASSWORD)."
    );
    await loginAsEmployee(page);
  });

  test("employee can open bundy, leave request, and payslips pages @smoke", async ({
    page,
  }) => {
    await page.goto("/employee-portal/bundy");
    await waitForAppReady(page);
    await expect(page.getByText(/bundy|clock/i).first()).toBeVisible();

    await page.goto("/employee-portal/leave-request");
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: /leave request/i })).toBeVisible();

    await page.goto("/employee-portal/payslips");
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: /my payslips/i })).toBeVisible();
  });
});
