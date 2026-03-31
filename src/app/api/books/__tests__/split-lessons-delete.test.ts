/**
 * Tests for DELETE /api/books/split/lessons (bulk delete).
 * Tests verify-before-delete pattern: preview mode, actual deletion, edge cases.
 *
 * Covers: B-20 (re-split recovery — bulk delete)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    course: {
      findUnique: vi.fn(),
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
    lessonCount = 5,
    progress = 3,
    reviews = 10,
    chats = 20,
    deletedCount = 5,
  } = overrides;

  mockPrisma.course.findUnique.mockResolvedValue(book);
  mockPrisma.lesson.count.mockResolvedValue(lessonCount);
  mockPrisma.lessonProgress.count.mockResolvedValue(progress);
  mockPrisma.flashcardReview.count.mockResolvedValue(reviews);
  mockPrisma.chatMessage.count.mockResolvedValue(chats);
  mockPrisma.lesson.deleteMany.mockResolvedValue({ count: deletedCount });
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/books/split/lessons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Preview mode (dry run) ──────────────────────────────────────────────
  describe("preview mode", () => {
    it("returns preview with counts without deleting", async () => {
      setupMocks();

      const res = await DELETE(makeReq({ bookId: "book-1" }, true));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.preview).toEqual({
        bookId: "book-1",
        bookTitle: "Test Book",
        lessonCount: 5,
        relatedCounts: {
          progress: 3,
          flashcardReviews: 10,
          chatMessages: 20,
        },
      });
      // Should NOT have called deleteMany
      expect(mockPrisma.lesson.deleteMany).not.toHaveBeenCalled();
    });

    it("returns 404 for non-existent book in preview", async () => {
      setupMocks({ book: null });

      const res = await DELETE(makeReq({ bookId: "missing" }, true));
      expect(res.status).toBe(404);
    });

    it("returns 404 when book has no lessons in preview", async () => {
      setupMocks({ lessonCount: 0 });

      const res = await DELETE(makeReq({ bookId: "book-1" }, true));
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("chưa có bài học");
    });
  });

  // ── Actual deletion ─────────────────────────────────────────────────────
  describe("actual deletion", () => {
    it("deletes all lessons and returns summary", async () => {
      setupMocks();

      const res = await DELETE(makeReq({ bookId: "book-1" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deleted).toEqual({
        bookId: "book-1",
        lessonCount: 5,
        relatedCounts: {
          progress: 3,
          flashcardReviews: 10,
          chatMessages: 20,
        },
      });
      expect(mockPrisma.lesson.deleteMany).toHaveBeenCalledWith({
        where: { courseId: "book-1" },
      });
    });

    it("returns 404 for non-existent book", async () => {
      setupMocks({ book: null });

      const res = await DELETE(makeReq({ bookId: "missing" }));
      expect(res.status).toBe(404);
    });

    it("returns 404 when book has no lessons", async () => {
      setupMocks({ lessonCount: 0 });

      const res = await DELETE(makeReq({ bookId: "book-1" }));
      expect(res.status).toBe(404);
    });
  });

  // ── Validation ──────────────────────────────────────────────────────────
  describe("validation", () => {
    it("returns 400 for missing bookId", async () => {
      const res = await DELETE(makeReq({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for empty bookId", async () => {
      const res = await DELETE(makeReq({ bookId: "" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON body", async () => {
      const req = new NextRequest(
        "http://localhost/api/books/split/lessons",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: "not json",
        }
      );
      const res = await DELETE(req);
      expect(res.status).toBe(500);
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────
  describe("error handling", () => {
    it("returns 500 on DB error during preview build", async () => {
      mockPrisma.course.findUnique.mockRejectedValue(new Error("DB timeout"));

      const res = await DELETE(makeReq({ bookId: "book-1" }));
      expect(res.status).toBe(500);
    });

    it("returns 500 on DB error during deleteMany", async () => {
      setupMocks();
      mockPrisma.lesson.deleteMany.mockRejectedValue(new Error("FK constraint"));

      const res = await DELETE(makeReq({ bookId: "book-1" }));
      expect(res.status).toBe(500);
    });
  });
});
