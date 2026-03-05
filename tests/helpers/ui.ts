import { expect, type Page } from "@playwright/test";

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(250);
}

export async function expectToast(page: Page, pattern: RegExp) {
  const toast = page.locator("[data-sonner-toast], [role='status']").filter({
    hasText: pattern,
  });
  await expect(toast.first()).toBeVisible();
}

export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
}

export function filterBenignErrors(errors: string[]) {
  const allowPatterns = [
    /favicon/i,
    /networkerror when attempting to fetch resource/i,
    /failed to load resource: the server responded with a status of 404/i,
  ];
  return errors.filter(
    (error) => !allowPatterns.some((pattern) => pattern.test(error))
  );
}
