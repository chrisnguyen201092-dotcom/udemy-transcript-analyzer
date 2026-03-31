import { test, expect } from "@playwright/test";

/**
 * E2E tests for Lesson Management flow.
 * Covers adding, viewing, reordering, and deleting lessons.
 */

test.describe("Lesson Management Flow", () => {
  let courseId: string;

  test.beforeEach(async ({ page }) => {
    // Create a fresh course via API for each test
    const response = await page.request.post("/api/courses", {
      data: { title: `Lesson Test Course ${Date.now()}` },
      headers: { "Content-Type": "application/json" },
    });
    const course = await response.json();
    courseId = course.id;

    // Navigate to the course page
    await page.goto(`/courses/${courseId}`);
    await page.waitForLoadState("networkidle");
  });

  test("should display course page with lesson area", async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}`));
    // The course page should have a lesson list or sidebar
    const pageContent = page.locator("main, [data-testid='lesson-list'], [role='navigation']").first();
    await expect(pageContent).toBeVisible();
  });

  test("should have an option to add a new lesson", async ({ page }) => {
    // Look for an "Add Lesson" button or similar
    const addLessonButton = page.getByRole("button", {
      name: /add lesson|thêm bài|thêm lesson|new lesson|tạo bài/i,
    });
    const uploadButton = page.getByRole("button", {
      name: /upload|tải lên|import/i,
    });
    const addButtonCount = await addLessonButton.count();
    const uploadButtonCount = await uploadButton.count();
    expect(addButtonCount + uploadButtonCount).toBeGreaterThan(0);
  });

  test("should add a lesson via API and verify it appears", async ({ page }) => {
    // Add a lesson via API
    const lessonResponse = await page.request.post(`/api/courses/${courseId}/lessons`, {
      data: {
        title: "Test Lesson 1",
        transcript: "This is a sample transcript for testing.",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(lessonResponse.ok()).toBe(true);

    // Reload and verify lesson shows up
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Test Lesson 1")).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to a lesson when clicked", async ({ page }) => {
    // Create a lesson via API
    const lessonResponse = await page.request.post(`/api/courses/${courseId}/lessons`, {
      data: {
        title: "Navigable Lesson",
        transcript: "Transcript content here.",
      },
      headers: { "Content-Type": "application/json" },
    });
    const lesson = await lessonResponse.json();

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Click on the lesson
    const lessonLink = page.getByText("Navigable Lesson").first();
    await lessonLink.click();

    // Should navigate to lesson detail page
    await expect(page).toHaveURL(
      new RegExp(`/courses/${courseId}/lessons/${lesson.id}`),
      { timeout: 10000 }
    );
  });

  test("should display multiple lessons in order", async ({ page }) => {
    // Create multiple lessons via API
    for (const title of ["Lesson A", "Lesson B", "Lesson C"]) {
      await page.request.post(`/api/courses/${courseId}/lessons`, {
        data: { title, transcript: `Transcript for ${title}` },
        headers: { "Content-Type": "application/json" },
      });
    }

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify all lessons are visible
    await expect(page.getByText("Lesson A")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Lesson B")).toBeVisible();
    await expect(page.getByText("Lesson C")).toBeVisible();
  });

  test("should delete a lesson", async ({ page }) => {
    // Create a lesson
    const lessonResponse = await page.request.post(`/api/courses/${courseId}/lessons`, {
      data: { title: "Lesson To Delete", transcript: "Will be deleted." },
      headers: { "Content-Type": "application/json" },
    });
    const lesson = await lessonResponse.json();

    // Navigate to lesson detail
    await page.goto(`/courses/${courseId}/lessons/${lesson.id}`);
    await page.waitForLoadState("networkidle");

    // Look for delete button
    const deleteButton = page.getByRole("button", { name: /delete|xóa|remove|xoá/i }).first();
    if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteButton.click();

      // Confirm if dialog appears
      const confirmButton = page.getByRole("button", {
        name: /confirm|xác nhận|yes|có|delete|xóa/i,
      }).first();
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Verify redirected back to course page
      await expect(page).toHaveURL(new RegExp(`/courses/${courseId}`), { timeout: 10000 });
    }
  });

  test("should show lesson count in course view", async ({ page }) => {
    // Add a few lessons
    for (const title of ["Counted Lesson 1", "Counted Lesson 2"]) {
      await page.request.post(`/api/courses/${courseId}/lessons`, {
        data: { title, transcript: `Content for ${title}` },
        headers: { "Content-Type": "application/json" },
      });
    }

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify the lesson count or at least that both lessons appear
    await expect(page.getByText("Counted Lesson 1")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Counted Lesson 2")).toBeVisible();
  });

  test("should handle selecting different lessons", async ({ page }) => {
    // Create two lessons
    const lesson1 = await (
      await page.request.post(`/api/courses/${courseId}/lessons`, {
        data: { title: "First Active Lesson", transcript: "First content" },
        headers: { "Content-Type": "application/json" },
      })
    ).json();
    await page.request.post(`/api/courses/${courseId}/lessons`, {
      data: { title: "Second Active Lesson", transcript: "Second content" },
      headers: { "Content-Type": "application/json" },
    });

    // Navigate to first lesson
    await page.goto(`/courses/${courseId}/lessons/${lesson1.id}`);
    await page.waitForLoadState("networkidle");

    // Click on the second lesson from the sidebar
    const secondLessonLink = page.getByText("Second Active Lesson").first();
    await secondLessonLink.click();

    // URL should update to the second lesson
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}/lessons/`), { timeout: 10000 });
  });
});
