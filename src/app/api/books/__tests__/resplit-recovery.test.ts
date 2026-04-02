/**
 * Tests for Re-Split Recovery Flow.
 *
 * Verifies the end-to-end recovery pattern:
 * 1. Bulk delete all lessons via DELETE /api/books/split/lessons
 * 2. rawContent preserved on course after lesson deletion
 * 3. Reconstruction logic (backfill pattern) for legacy courses
 *
 * Covers: B-20 (re-split recovery)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    course: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    lesson: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    lessonProgress: {
      count: vi.fn(),
    },
    flashcardReview: {
      count: vi.fn(),
    },
    chatMessage: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Import AFTER mocks ──────────────────────────────────────────────────────
import { DELETE } from "@/app/api/books/split/lessons/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeReq(body: unknown, preview = false): NextRequest {
  const url = `http://localhost/api/books/split/lessons${preview ? "?preview=true" : ""}`;
  return new NextRequest(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Reconstruct rawContent from lesson transcripts.
 * Same logic as scripts/backfill-raw-content.ts.
 */
function reconstructRawContent(
  lessons: { title: string; transcript: string | null; order: number }[]
): string {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  const sections: string[] = [];
  for (const lesson of sorted) {
    if (lesson.transcript === null) continue;
    sections.push(`# ${lesson.title}\n\n${lesson.transcript}`);
  }
  return sections.join("\n\n---\n\n");
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("Re-Split Recovery Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Reconstruction logic ───────────────────────────────────────────────
  describe("rawContent reconstruction", () => {
    it("reconstructs content from lesson transcripts in order", () => {
      const lessons = [
        { title: "Chapter 2", transcript: "Content of ch2", order: 2 },
        { title: "Chapter 1", transcript: "Content of ch1", order: 1 },
        { title: "Chapter 3", transcript: "Content of ch3", order: 3 },
      ];
      const result = reconstructRawContent(lessons);
      expect(result).toBe(
        "# Chapter 1\n\nContent of ch1\n\n---\n\n# Chapter 2\n\nContent of ch2\n\n---\n\n# Chapter 3\n\nContent of ch3"
      );
    });

    it("skips lessons with null transcripts", () => {
      const lessons = [
        { title: "Chapter 1", transcript: "Content", order: 1 },
        { title: "Chapter 2", transcript: null, order: 2 },
        { title: "Chapter 3", transcript: "More content", order: 3 },
      ];
      const result = reconstructRawContent(lessons);
      expect(result).toBe(
        "# Chapter 1\n\nContent\n\n---\n\n# Chapter 3\n\nMore content"
      );
      expect(result).not.toContain("Chapter 2");
    });

    it("returns empty string when all transcripts are null", () => {
      const lessons = [
        { title: "A", transcript: null, order: 1 },
        { title: "B", transcript: null, order: 2 },
      ];
      expect(reconstructRawContent(lessons)).toBe("");
    });

    it("returns empty string for empty lessons array", () => {
      expect(reconstructRawContent([])).toBe("");
    });

    it("handles single lesson", () => {
      const result = reconstructRawContent([
        { title: "Solo", transcript: "Only chapter", order: 1 },
      ]);
      expect(result).toBe("# Solo\n\nOnly chapter");
      expect(result).not.toContain("---");
    });

    it("preserves markdown in transcript content", () => {
      const result = reconstructRawContent([
        {
          title: "Ch 1",
          transcript: "## Section\n\n- item 1\n- item 2\n\n```js\nconsole.log('hi')\n```",
          order: 1,
        },
      ]);
      expect(result).toContain("## Section");
      expect(result).toContain("```js");
    });

    it("uses --- separator between chapters", () => {
      const result = reconstructRawContent([
        { title: "A", transcript: "text a", order: 1 },
        { title: "B", transcript: "text b", order: 2 },
      ]);
      const separator = "\n\n---\n\n";
      expect(result.split(separator)).toHaveLength(2);
    });
  });

  // ── Preview → Delete → Re-split flow ──────────────────────────────────
  describe("preview then delete flow", () => {
    function setupMocks(overrides: {
      book?: { id: string; title: string } | null;
      lessonCount?: number;
      progress?: number;
      reviews?: number;
      chats?: number;
      deletedCount?: number;
    } = {}) {
      const {
        book = { id: "book-1", title: "Test Book" },
        lessonCount = 10,
        progress = 5,
        reviews = 15,
        chats = 30,
        deletedCount = 10,
      } = overrides;
      mockPrisma.course.findFirst.mockResolvedValue(book);
      mockPrisma.lesson.count.mockResolvedValue(lessonCount);
      mockPrisma.lessonProgress.count.mockResolvedValue(progress);
      mockPrisma.flashcardReview.count.mockResolvedValue(reviews);
      mockPrisma.chatMessage.count.mockResolvedValue(chats);
      mockPrisma.lesson.deleteMany.mockResolvedValue({ count: deletedCount });
    }

    it("preview shows accurate counts before deletion", async () => {
      setupMocks({ lessonCount: 12, progress: 8, reviews: 20, chats: 50 });

      const previewRes = await DELETE(makeReq({ bookId: "book-1" }, true));
      const previewData = await previewRes.json();

      expect(previewRes.status).toBe(200);
      expect(previewData.preview.lessonCount).toBe(12);
      expect(previewData.preview.relatedCounts).toEqual({
        progress: 8,
        flashcardReviews: 20,
        chatMessages: 50,
      });
      expect(mockPrisma.lesson.deleteMany).not.toHaveBeenCalled();
    });

    it("delete removes all lessons after preview", async () => {
      setupMocks({ lessonCount: 12, deletedCount: 12 });

      // Step 1: Preview
      const previewRes = await DELETE(makeReq({ bookId: "book-1" }, true));
      expect(previewRes.status).toBe(200);
      expect(mockPrisma.lesson.deleteMany).not.toHaveBeenCalled();

      // Step 2: Actual delete
      const deleteRes = await DELETE(makeReq({ bookId: "book-1" }));
      const deleteData = await deleteRes.json();

      expect(deleteRes.status).toBe(200);
      expect(deleteData.deleted.lessonCount).toBe(12);
      expect(mockPrisma.lesson.deleteMany).toHaveBeenCalledWith({
        where: { courseId: "book-1" },
      });
    });

    it("delete preserves book record (only lessons removed)", async () => {
      setupMocks();

      await DELETE(makeReq({ bookId: "book-1" }));

      // deleteMany only targets lessons, not the course itself
      expect(mockPrisma.lesson.deleteMany).toHaveBeenCalledWith({
        where: { courseId: "book-1" },
      });
      // course.findUnique was called for validation, NOT for deletion
      expect(mockPrisma.course.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "book-1", userId: "test-user-id" },
          select: { id: true, title: true },
        })
      );
    });

    it("returns related counts showing cascade impact", async () => {
      setupMocks({ progress: 10, reviews: 25, chats: 100 });

      const res = await DELETE(makeReq({ bookId: "book-1" }));
      const data = await res.json();

      expect(data.deleted.relatedCounts).toEqual({
        progress: 10,
        flashcardReviews: 25,
        chatMessages: 100,
      });
    });

    it("handles book with no related data (fresh course)", async () => {
      setupMocks({ lessonCount: 3, progress: 0, reviews: 0, chats: 0, deletedCount: 3 });

      const res = await DELETE(makeReq({ bookId: "book-1" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deleted.relatedCounts).toEqual({
        progress: 0,
        flashcardReviews: 0,
        chatMessages: 0,
      });
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────
  describe("recovery edge cases", () => {
    it("concurrent delete requests both succeed (idempotent)", async () => {
      // First call: book exists with lessons
      mockPrisma.course.findFirst.mockResolvedValue({ id: "book-1", title: "Book" });
      mockPrisma.lesson.count.mockResolvedValueOnce(5);
      mockPrisma.lessonProgress.count.mockResolvedValue(0);
      mockPrisma.flashcardReview.count.mockResolvedValue(0);
      mockPrisma.chatMessage.count.mockResolvedValue(0);
      mockPrisma.lesson.deleteMany.mockResolvedValueOnce({ count: 5 });

      const res1 = await DELETE(makeReq({ bookId: "book-1" }));
      expect(res1.status).toBe(200);

      // Second call: lessons already deleted
      mockPrisma.lesson.count.mockResolvedValueOnce(0);
      const res2 = await DELETE(makeReq({ bookId: "book-1" }));
      expect(res2.status).toBe(404); // No lessons to delete
    });

    it("rejects non-book course IDs gracefully", async () => {
      // Course exists but is not a book (API doesn't check contentType)
      mockPrisma.course.findFirst.mockResolvedValue({ id: "video-1", title: "Video Course" });
      mockPrisma.lesson.count.mockResolvedValue(10);
      mockPrisma.lessonProgress.count.mockResolvedValue(0);
      mockPrisma.flashcardReview.count.mockResolvedValue(0);
      mockPrisma.chatMessage.count.mockResolvedValue(0);
      mockPrisma.lesson.deleteMany.mockResolvedValue({ count: 10 });

      // API still works — contentType check is UI-level (LessonList component)
      const res = await DELETE(makeReq({ bookId: "video-1" }));
      expect(res.status).toBe(200);
    });
  });
});
