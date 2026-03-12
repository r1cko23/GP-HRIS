import { expect, test } from "@playwright/test";
import { env } from "./fixtures/env";

/**
 * Multi-device login test: log in as the same employee from different
 * "devices" (user-agent overrides) and verify that different device labels
 * (e.g. iPhone 17, iPhone 16, Android) are recorded and visible on My devices.
 *
 * Prerequisites:
 *   npx playwright install   # if not already installed
 *
 * Run (with app running on http://localhost:3000):
 *   PLAYWRIGHT_EXTERNAL_BASE_URL=1 TEST_EMPLOYEE_ID=2025001 TEST_EMPLOYEE_PASSWORD=2025001 npx playwright test tests/device-login-multi-device.spec.ts
 *
 * Note: The app allows max 5 devices per employee. If the test fails with "Too many devices",
 * use an employee with fewer linked devices or remove old devices in Admin → Device & Login Activity.
 */
const EMPLOYEE_ID = env("TEST_EMPLOYEE_ID") || "2025001";
const EMPLOYEE_PASSWORD = env("TEST_EMPLOYEE_PASSWORD") || "2025001";

// Use 2 devices to stay under the app's max-devices-per-employee limit (5).
const DEVICE_USER_AGENTS = [
  {
    name: "iPhone iOS 17",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
  {
    name: "Android 14",
    ua: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  },
];

test.describe("Device & Login – multi-device recording", () => {
  test("multiple logins with different UAs register different device labels and show on My devices @smoke", async ({
    browser,
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // Log in from each "device" (context with different user-agent)
    const contexts = await Promise.all(
      DEVICE_USER_AGENTS.map(async (device) => {
        const ctx = await browser.newContext({
          userAgent: device.ua,
          viewport: { width: 390, height: 844 },
        });
        const page = await ctx.newPage();

        await page.goto(`${url}/login?mode=employee`);
        await expect(page.getByTestId("login-card")).toBeVisible();
        await page.getByTestId("employee-id-input").fill(EMPLOYEE_ID);
        await page.getByTestId("employee-password-input").fill(EMPLOYEE_PASSWORD);
        await page.getByTestId("employee-signin-button").click();

        try {
          await page.waitForURL(/\/employee-portal\//, { timeout: 20000 });
        } catch {
          const body = (await page.locator("body").textContent()) ?? "";
          if (/too many devices/i.test(body)) {
            throw new Error(
              `Login failed for ${device.name}: app reported "Too many devices". ` +
                "Use an employee with fewer than 4 linked devices, or remove old devices for this employee in Admin → Device & Login Activity."
            );
          }
          throw new Error(
            `Login failed for ${device.name}. URL: ${page.url()}. Body snippet: ${body.slice(0, 300)}`
          );
        }

        return { context: ctx, page, device };
      })
    );

    // Use first context to open My devices and assert we see multiple devices
    const [first] = contexts;
    if (!first) throw new Error("No contexts");
    const { page } = first;

    await page.goto(`${url}/employee-portal/devices`);
    await page.waitForLoadState("networkidle");

    // Page should show "My devices" and a table with at least 2 devices (we logged in from 2)
    await expect(page.getByRole("heading", { name: /my devices/i })).toBeVisible({ timeout: 10000 });

    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 5000 });

    const deviceCells = page.locator("table tbody td.font-medium");
    const count = await deviceCells.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await deviceCells.nth(i).textContent())?.trim() ?? "";
      if (text && text !== "—") labels.push(text);
    }

    // We expect at least one iPhone and one Android (or multiple distinct labels)
    const hasIphone = labels.some((l) => /iphone/i.test(l));
    const hasAndroid = labels.some((l) => /android/i.test(l));
    expect(hasIphone || hasAndroid).toBe(true);
    expect(labels.length).toBeGreaterThanOrEqual(2);

    await Promise.all(contexts.map((c) => c.context.close()));
  });
});
