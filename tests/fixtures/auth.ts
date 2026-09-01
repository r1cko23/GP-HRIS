import { expect, type Page } from "@playwright/test";
import { env, requireEnv } from "./env";

export async function gotoLoginMode(page: Page, mode: "admin" | "employee") {
  await page.goto(`/login?mode=${mode}`);
  await expect(page.getByTestId("login-card")).toBeVisible();
}

export async function loginAsAdmin(page: Page) {
  await loginWithEmailPassword(
    page,
    requireEnv("TEST_ADMIN_EMAIL"),
    requireEnv("TEST_ADMIN_PASSWORD")
  );
}

export async function loginAsApprover(page: Page) {
  await loginWithEmailPassword(
    page,
    requireEnv("TEST_APPROVER_EMAIL"),
    requireEnv("TEST_APPROVER_PASSWORD")
  );
}

export async function loginWithEmailPassword(
  page: Page,
  email: string,
  password: string
) {
  await gotoLoginMode(page, "admin");
  await page.getByTestId("admin-email-input").fill(email.trim());
  await page.getByTestId("admin-password-input").fill(password.trim());
  await page.getByTestId("admin-signin-button").click();

  await page.waitForURL(/\/(reports|people|time)(\/|\?|$)/, { timeout: 20000 });
}

export async function loginAsEmployee(page: Page) {
  const employeeId = requireEnv("TEST_EMPLOYEE_ID");
  const employeePassword = env("TEST_EMPLOYEE_PASSWORD") || employeeId;

  await gotoLoginMode(page, "employee");
  await page.getByTestId("employee-id-input").fill(employeeId);
  await page.getByTestId("employee-password-input").fill(employeePassword);
  await page.getByTestId("employee-signin-button").click();

  await page.waitForURL(/\/employee-portal\//, { timeout: 20000 });
}
