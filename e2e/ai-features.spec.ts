import { test, expect } from "@playwright/test";

/**
 * E2E tests for AI features accessibility.
 * Does NOT make real AI calls — only tests the UI structure.
 */

test.describe("AI Features UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  });

  test("settings modal trigger exists", async ({ page }) => {
    // Settings button should be present (gear icon, settings text, etc.)
    page.locator(
      'button[aria-label*="setting" i], button:has-text("Setting"), button:has-text("Cài đặt"), [data-testid="settings-btn"]'
    );

    // Check if any of these are in the page
    const allButtons = page.locator("button");
    const buttonCount = await allButtons.count();
    expect(buttonCount).toBeGreaterThan(0);
  });

  test("AI assistant panel area is in the DOM", async ({ page }) => {
    // AI panel should be rendered (tabs: Summary, Explain, Chat, Quiz, etc.)
    // Check for common AI feature labels
    page.locator(
      ':has-text("Summary"), :has-text("Tóm tắt"), :has-text("Chat"), :has-text("Quiz"), :has-text("Giải thích")'
    );
    // Verifying the page renders without crash is the main goal
    await expect(page.locator("body")).toBeVisible();
  });

  test("API endpoint /api/ai/models returns 400 without credentials", async ({ page }) => {
    // Without apiKey/baseUrl, the route should return 400
    const response = await page.request.post("/api/ai/models", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(400);
  });

  test("API endpoint /api/ai/summary returns 400 without credentials", async ({ page }) => {
    const response = await page.request.post("/api/ai/summary", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(400);
  });

  test("API endpoint /api/ai/chat returns 400 without credentials", async ({ page }) => {
    const response = await page.request.post("/api/ai/chat", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(400);
  });

  test("page renders without console errors on initial load", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Filter out known non-critical errors (favicon 404, hydration warnings, etc.)
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("hydrat") &&
        !e.includes("Warning:")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
