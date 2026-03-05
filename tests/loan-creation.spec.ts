import { test, expect } from '@playwright/test';
import { env } from './fixtures/env';
import { loginAsAdmin } from './fixtures/auth';
import { collectConsoleErrors, filterBenignErrors, waitForAppReady } from './helpers/ui';
import { testData } from './fixtures/data';

/**
 * Test loan creation functionality
 * Tests that users with Admin/HR roles can create loans
 */
test.describe('Loan Creation', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!env('TEST_ADMIN_EMAIL') || !env('TEST_ADMIN_PASSWORD'), 'Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for loan tests.');
    await loginAsAdmin(page);
  });

  test('should allow admin/HR to create a loan @regression', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    // Navigate to loans page
    await page.goto('/loans');
    await waitForAppReady(page);
    
    // Wait for loans page to load
    await page.waitForSelector('h1:has-text("Loan Management")', { timeout: 10000 });
    
    // Click "Add Loan" button
    await page.click('button:has-text("Add Loan")');
    
    // Wait for modal to appear
    await page.waitForSelector('text=Add New Loan', { timeout: 5000 });
    
    // Wait a moment for form to fully load
    await page.waitForTimeout(500);
    
    // Fill in loan form
    // Select employee (assuming there's at least one employee)
    await page.click('button[role="combobox"]:near(text=Employee)');
    await page.waitForTimeout(300);
    // Select first employee option
    const employeeOptions = page.locator('[role="option"]');
    const firstEmployee = employeeOptions.first();
    if (await firstEmployee.count() > 0) {
      await firstEmployee.click();
    } else {
      throw new Error('No employees available for testing');
    }
    
    // Fill in loan details
    await page.fill('input[id="original_balance"]', testData.loanAmount);
    await page.fill('input[id="current_balance"]', testData.loanAmount);
    await page.fill('input[id="monthly_payment"]', '1666.67');
    await page.fill('input[id="total_terms"]', testData.loanTerms);
    await page.fill('input[id="remaining_terms"]', testData.loanTerms);
    
    // Set effectivity date (format: YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[id="effectivity_date"]', dateStr);
    
    // Select cutoff assignment
    await page.click('button[role="combobox"]:near(text=Cutoff Assignment)');
    await page.waitForTimeout(300);
    await page.click('[role="option"]:has-text("Both Cutoffs")');
    
    // Click "Create Loan" button
    const createButton = page.locator('button:has-text("Create Loan")');
    await createButton.click();
    
    // Wait for either success toast or error message
    // Check for success toast
    const successToast = page.locator('text=/Loan created successfully/i');
    const errorToast = page.locator('text=/error|failed|permission/i');
    
    // Wait for either toast to appear (with timeout)
    await Promise.race([
      successToast.waitFor({ timeout: 10000 }).catch(() => null),
      errorToast.waitFor({ timeout: 10000 }).catch(() => null),
    ]);
    
    // Check if success toast appeared
    const successVisible = await successToast.first().isVisible().catch(() => false);
    const errorVisible = await errorToast.isVisible().catch(() => false);
    
    if (errorVisible) {
      const errorText = await errorToast.textContent();
      console.error('Loan creation failed with error:', errorText);
      throw new Error(`Loan creation failed: ${errorText}`);
    }
    
    if (!successVisible) {
      throw new Error(`Loan creation did not succeed. Console errors: ${consoleErrors.join(', ')}`);
    }
    
    // Verify success
    expect(successVisible).toBe(true);
    expect(filterBenignErrors(consoleErrors)).toEqual([]);
    
    // Wait for modal to close
    await page.waitForSelector('text=Add New Loan', { state: 'hidden', timeout: 5000 });
  });

  test('should prevent duplicate submissions @smoke', async ({ page }) => {
    // Navigate to loans page
    await page.goto('/loans');
    
    // Wait for loans page to load
    await page.waitForSelector('h1:has-text("Loan Management")', { timeout: 10000 });
    
    // Click "Add Loan" button
    await page.click('button:has-text("Add Loan")');
    
    // Wait for modal to appear
    await page.waitForSelector('text=Add New Loan', { timeout: 5000 });
    
    // Fill in minimal required fields
    await page.click('button[role="combobox"]:near(text=Employee)');
    await page.waitForTimeout(300);
    const employeeOptions = page.locator('[role="option"]');
    const firstEmployee = employeeOptions.first();
    if (await firstEmployee.count() > 0) {
      await firstEmployee.click();
    }
    
    await page.fill('input[id="original_balance"]', '5000');
    await page.fill('input[id="current_balance"]', '5000');
    await page.fill('input[id="total_terms"]', testData.loanTerms);
    await page.fill('input[id="remaining_terms"]', testData.loanTerms);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[id="effectivity_date"]', dateStr);
    
    // Rapidly click create button multiple times
    const createButton = page.locator('button:has-text("Create Loan")');
    
    // Click multiple times rapidly
    await Promise.all([
      createButton.click(),
      createButton.click(),
      createButton.click(),
    ]);
    
    // Wait a moment
    await page.waitForTimeout(2000);
    
    // Should only see one success or error message, not multiple
    const toasts = page.locator('[role="status"], [data-sonner-toast]');
    const toastCount = await toasts.count();
    
    // Should have at most 1 toast (success or error)
    expect(toastCount).toBeLessThanOrEqual(1);
  });
});
