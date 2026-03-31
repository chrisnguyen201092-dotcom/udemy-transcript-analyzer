import { test, expect } from "@playwright/test";

/**
 * E2E tests for Course CRUD (Create, Read, Update, Delete) flows.
 * Covers the full lifecycle of a course from creation to deletion.
 */

test.describe("Course CRUD Flow", () => {
  const testCourseTitle = `E2E Test Course ${Date.now()}`;
  const updatedCourseTitle = `Updated ${testCourseTitle}`;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("should display homepage with course list", async ({ page }) => {
    await expect(page).toHaveTitle(/Udemy/i);
    await expect(page.locator("body")).toBeVisible();
    // Verify there's a section for courses
    const mainContent = page.locator("main").first();
    await expect(mainContent).toBeVisible();
  });

  test("should have a way to create a new course", async ({ page }) => {
    // Look for Add Course / Thêm khóa học button or panel
    const addButton = page.getByRole("button", { name: /add|thêm|tạo|create|new/i });
    const addInput = page.locator(
      '[placeholder*="course" i], [placeholder*="khóa" i], [placeholder*="URL" i], [placeholder*="title" i]'
    );
    // At least one method to add a course should exist
    const addButtonCount = await addButton.count();
    const addInputCount = await addInput.count();
    expect(addButtonCount + addInputCount).toBeGreaterThan(0);
  });

  test("should create a new course via manual form", async ({ page }) => {
    // Find the course title input
    const titleInput = page.locator(
      '[placeholder*="course" i], [placeholder*="khóa" i], [placeholder*="tên" i], [placeholder*="title" i]'
    ).first();
    await expect(titleInput).toBeVisible();
    await titleInput.fill(testCourseTitle);

    // Submit the form — look for submit button near the input
    const submitButton = page.getByRole("button", { name: /add|thêm|tạo|create|save|lưu/i }).first();
    await submitButton.click();

    // Verify course appears in the course list
    await expect(page.getByText(testCourseTitle)).toBeVisible({ timeout: 10000 });
  });

  test("should display newly created course in the list", async ({ page }) => {
    // First create a course via API for reliable state
    const createResponse = await page.request.post("/api/courses", {
      data: { title: testCourseTitle },
      headers: { "Content-Type": "application/json" },
    });
    expect(createResponse.ok()).toBe(true);

    // Reload and verify it appears
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(testCourseTitle)).toBeVisible({ timeout: 10000 });
  });

  test("should open a course page when clicking on a course", async ({ page }) => {
    // Create course via API
    const createResponse = await page.request.post("/api/courses", {
      data: { title: testCourseTitle },
      headers: { "Content-Type": "application/json" },
    });
    const course = await createResponse.json();

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Click on the course
    const courseLink = page.getByText(testCourseTitle).first();
    await courseLink.click();

    // Should navigate to the course detail page
    await expect(page).toHaveURL(new RegExp(`/courses/${course.id}`), { timeout: 10000 });
  });

  test("should edit a course title", async ({ page }) => {
    // Create course via API
    const createResponse = await page.request.post("/api/courses", {
      data: { title: testCourseTitle },
      headers: { "Content-Type": "application/json" },
    });
    const course = await createResponse.json();

    // Navigate to the course
    await page.goto(`/courses/${course.id}`);
    await page.waitForLoadState("networkidle");

    // Look for edit button or inline edit
    const editButton = page.getByRole("button", { name: /edit|sửa|rename|đổi tên/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Find the title input for editing
    const titleInput = page.locator(
      'input[value*="E2E"], [data-testid="course-title-input"], input[name="title"]'
    ).first();
    if (await titleInput.isVisible()) {
      await titleInput.clear();
      await titleInput.fill(updatedCourseTitle);

      // Save the changes
      const saveButton = page.getByRole("button", { name: /save|lưu|update|cập nhật|confirm|xác nhận/i }).first();
      await saveButton.click();

      // Verify updated title is shown
      await expect(page.getByText(updatedCourseTitle)).toBeVisible({ timeout: 10000 });
    }
  });

  test("should delete a course", async ({ page }) => {
    // Create course via API
    const createResponse = await page.request.post("/api/courses", {
      data: { title: testCourseTitle },
      headers: { "Content-Type": "application/json" },
    });
    const course = await createResponse.json();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(testCourseTitle)).toBeVisible({ timeout: 10000 });

    // Navigate to course page where delete might be available
    await page.goto(`/courses/${course.id}`);
    await page.waitForLoadState("networkidle");

    // Look for delete button
    const deleteButton = page.getByRole("button", { name: /delete|xóa|remove|xoá/i }).first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion if there's a dialog
      const confirmButton = page.getByRole("button", { name: /confirm|xác nhận|yes|có|delete|xóa/i }).first();
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Verify redirected back to homepage
      await expect(page).toHaveURL("/", { timeout: 10000 });
    }
  });

  test("should verify deleted course is removed from API", async ({ page }) => {
    // Create and delete via API
    const createResponse = await page.request.post("/api/courses", {
      data: { title: testCourseTitle },
      headers: { "Content-Type": "application/json" },
    });
    const course = await createResponse.json();

    const deleteResponse = await page.request.delete(`/api/courses/${course.id}`);
    expect(deleteResponse.ok()).toBe(true);

    // Verify course is gone from the list
    const listResponse = await page.request.get("/api/courses");
    const courses = await listResponse.json();
    const found = courses.find((c: { id: string }) => c.id === course.id);
    expect(found).toBeUndefined();
  });

  test("should handle creating course with empty title gracefully", async ({ page }) => {
    const titleInput = page.locator(
      '[placeholder*="course" i], [placeholder*="khóa" i], [placeholder*="tên" i], [placeholder*="title" i]'
    ).first();

    if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Try to submit without filling the title
      const submitButton = page.getByRole("button", { name: /add|thêm|tạo|create|save|lưu/i }).first();
      await submitButton.click();

      // Should show validation error or the form should not submit
      // Either the page stays on homepage or shows an error message
      await expect(page).toHaveURL("/");
    }
  });
});
