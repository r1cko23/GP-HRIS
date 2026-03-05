import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./fixtures/auth";
import { env } from "./fixtures/env";
import { waitForAppReady } from "./helpers/ui";
import { capturePageRuntime, expectHealthyRuntime } from "./helpers/runtime";

test.describe("Runtime Health (DevTools-aligned checks)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !env("TEST_ADMIN_EMAIL") || !env("TEST_ADMIN_PASSWORD"),
      "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for runtime health checks."
    );
    await loginAsAdmin(page);
  });

  test("critical routes load without console/request failures @regression", async ({
    page,
  }) => {
    const capture = capturePageRuntime(page);
    const routes = ["/dashboard", "/timesheet", "/payslips", "/leave-approval", "/device-activity"];

    for (const route of routes) {
      await page.goto(route);
      await waitForAppReady(page);
      await expect(page.getByRole("main")).toBeVisible();
    }

    await expectHealthyRuntime(capture);
  });

  test("critical pages stay within basic front-end timing budget @regression", async ({
    page,
  }) => {
    const routes = ["/dashboard", "/timesheet", "/payslips"];

    for (const route of routes) {
      await page.goto(route);
      await waitForAppReady(page);

      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (!nav) return null;
        return {
          domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
          loadEventEnd: nav.loadEventEnd - nav.startTime,
        };
      });

      expect(timing).not.toBeNull();
      expect(timing!.domContentLoaded).toBeLessThan(8000);
      expect(timing!.loadEventEnd).toBeLessThan(12000);
    }
  });
});
