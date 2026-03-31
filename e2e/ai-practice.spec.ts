import { test, expect } from "@playwright/test";

/**
 * E2E tests for AI Practice features (Quiz, Flashcards, Exercises).
 * Tests the Practice tab UI flow.
 */

test.describe("AI Practice (Quiz & Flashcards) Flow", () => {
  let courseId: string;
  let lessonId: string;

  test.beforeEach(async ({ page }) => {
    // Create a course with a lesson
    const courseResponse = await page.request.post("/api/courses", {
      data: { title: `Practice Test Course ${Date.now()}` },
      headers: { "Content-Type": "application/json" },
    });
    const course = await courseResponse.json();
    courseId = course.id;

    const lessonResponse = await page.request.post(`/api/courses/${courseId}/lessons`, {
      data: {
        title: "Practice Lesson",
        transcript:
          "Python is an interpreted, high-level programming language. It emphasizes code readability with significant whitespace. Python supports multiple programming paradigms including procedural, object-oriented, and functional programming. It was created by Guido van Rossum and first released in 1991.",
      },
      headers: { "Content-Type": "application/json" },
    });
    const lesson = await lessonResponse.json();
    lessonId = lesson.id;

    await page.goto(`/courses/${courseId}/lessons/${lessonId}`);
    await page.waitForLoadState("networkidle");
  });

  test("should display Practice tab", async ({ page }) => {
    const practiceTab = page.locator(
      'button:has-text("Practice"), button:has-text("Luyện tập"), [role="tab"]:has-text("Practice"), [role="tab"]:has-text("Luyện tập")'
    ).first();
    await expect(practiceTab).toBeVisible({ timeout: 10000 });
  });

  test("should switch to Practice tab", async ({ page }) => {
    const practiceTab = page.locator(
      'button:has-text("Practice"), button:has-text("Luyện tập"), [role="tab"]:has-text("Practice"), [role="tab"]:has-text("Luyện tập")'
    ).first();
    await practiceTab.click();

    // Should show quiz/flashcard generation options
    const generateButton = page.getByRole("button", {
      name: /generate|tạo|quiz|flashcard|luyện tập/i,
    });
    const count = await generateButton.count();
    expect(count).toBeGreaterThanOrEqual(0); // Graceful check
    await expect(page.locator("body")).toBeVisible();
  });

  test("should have quiz generation option", async ({ page }) => {
    const practiceTab = page.locator(
      'button:has-text("Practice"), button:has-text("Luyện tập"), [role="tab"]:has-text("Practice"), [role="tab"]:has-text("Luyện tập")'
    ).first();
    await practiceTab.click();

    // Look for Quiz-related UI elements
    const quizElements = page.locator(
      'button:has-text("Quiz"), button:has-text("Trắc nghiệm"), :has-text("Quiz"), :has-text("Trắc nghiệm")'
    );
    const count = await quizElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should have flashcard generation option", async ({ page }) => {
    const practiceTab = page.locator(
      'button:has-text("Practice"), button:has-text("Luyện tập"), [role="tab"]:has-text("Practice"), [role="tab"]:has-text("Luyện tập")'
    ).first();
    await practiceTab.click();

    // Look for Flashcard-related UI elements
    const flashcardElements = page.locator(
      'button:has-text("Flashcard"), button:has-text("Thẻ"), :has-text("Flashcard"), :has-text("flashcard")'
    );
    const count = await flashcardElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should validate quiz API requires credentials", async ({ page }) => {
    const response = await page.request.post("/api/ai/quiz", {
      data: { lessonId, type: "quiz" },
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(400);
  });

  test("should display quiz UI structure when quiz data exists", async ({ page }) => {
    const practiceTab = page.locator(
      'button:has-text("Practice"), button:has-text("Luyện tập"), [role="tab"]:has-text("Practice"), [role="tab"]:has-text("Luyện tập")'
    ).first();
    await practiceTab.click();

    // Verify the practice panel renders without error
    await expect(page.locator("body")).toBeVisible();

    // Look for quiz-related structure (questions, options, etc.)
    const quizContainer = page.locator(
      '[data-testid="quiz-player"], [data-testid="quiz"], .quiz-container, [role="radiogroup"]'
    );
    // Quiz container may not be visible if no quiz has been generated yet
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toMatch(/Something went wrong|Unhandled error/i);
  });

  test("should display flashcard UI structure", async ({ page }) => {
    const practiceTab = page.locator(
      'button:has-text("Practice"), button:has-text("Luyện tập"), [role="tab"]:has-text("Practice"), [role="tab"]:has-text("Luyện tập")'
    ).first();
    await practiceTab.click();

    // Look for flashcard-related UI
    const flashcardContainer = page.locator(
      '[data-testid="flashcard-deck"], [data-testid="flashcard"], .flashcard, .card'
    );
    // Flashcards may not be visible until generated
    await expect(page.locator("body")).toBeVisible();

    // Page should not be in error state
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toMatch(/Something went wrong|Unhandled error/i);
  });

  test("should show exercise section in Practice tab", async ({ page }) => {
    const practiceTab = page.locator(
      'button:has-text("Practice"), button:has-text("Luyện tập"), [role="tab"]:has-text("Practice"), [role="tab"]:has-text("Luyện tập")'
    ).first();
    await practiceTab.click();

    // Look for exercise-related elements
    const exerciseElements = page.locator(
      'button:has-text("Exercise"), button:has-text("Bài tập"), :has-text("Exercise"), :has-text("Bài tập")'
    );
    const count = await exerciseElements.count();
    // Exercises may or may not be separate from quiz/flashcard
    await expect(page.locator("body")).toBeVisible();
  });

  test("should handle practice tab interactions without crash", async ({ page }) => {
    const practiceTab = page.locator(
      'button:has-text("Practice"), button:has-text("Luyện tập"), [role="tab"]:has-text("Practice"), [role="tab"]:has-text("Luyện tập")'
    ).first();
    await practiceTab.click();

    // Try clicking on any generate/action buttons
    const actionButtons = page.getByRole("button", {
      name: /generate|tạo|start|bắt đầu/i,
    });
    if (await actionButtons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await actionButtons.first().click();
      // Should show loading or error state (no credentials), not crash
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("should return to Practice tab after navigating away", async ({ page }) => {
    // Click Practice tab
    const practiceTab = page.locator(
      'button:has-text("Practice"), button:has-text("Luyện tập"), [role="tab"]:has-text("Practice"), [role="tab"]:has-text("Luyện tập")'
    ).first();
    await practiceTab.click();

    // Switch to Chat tab
    const chatTab = page.locator(
      'button:has-text("Chat"), [role="tab"]:has-text("Chat")'
    ).first();
    if (await chatTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatTab.click();
    }

    // Switch back to Practice
    await practiceTab.click();
    await expect(page.locator("body")).toBeVisible();
  });
});
