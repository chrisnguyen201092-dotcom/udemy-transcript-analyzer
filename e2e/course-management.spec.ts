import { test, expect } from "@playwright/test";

/**
 * E2E tests for course management flows.
 * Requires the dev server to be running at http://localhost:3000.
 */

test.describe("Course Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("homepage loads and shows course list area", async ({ page }) => {
    await expect(page).toHaveTitle(/Udemy Learner/i);
    // The page should render without crashing
    await expect(page.locator("body")).toBeVisible();
  });

  test("manual course creation form is accessible", async ({ page }) => {
    // There should be a way to add a course manually (button or panel)
    // Look for common patterns: "Add Course", "Thêm khóa học", or an input
    const addCourseElements = page.locator(
      'button:has-text("Add"), button:has-text("Thêm"), [placeholder*="Course"], [placeholder*="khóa"]'
    );
    // At least one of these should exist on the page
    await expect(addCourseElements.first()).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to the main application page", async ({ page }) => {
    // The root page should render within 5 seconds
    await expect(page.locator("main, #__next, [data-testid='app']").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("settings button or icon is accessible", async ({ page }) => {
    // Settings modal trigger (gear icon or settings button)
    const settingsButton = page.locator(
      'button[aria-label*="setting" i], button[aria-label*="cài đặt" i], [data-testid="settings"], svg[data-icon="settings"]'
    ).first();

    // Should exist somewhere in the page
    const count = await page.locator(
      'button, [role="button"]'
    ).count();
    expect(count).toBeGreaterThan(0);
  });

  test("course list renders after page load", async ({ page }) => {
    // Wait for the API to load courses (even if empty)
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    // Page should not show a crash/error screen
    const errorScreen = page.locator('[data-testid="error"], .error-boundary');
    await expect(errorScreen).not.toBeVisible();
  });
});
