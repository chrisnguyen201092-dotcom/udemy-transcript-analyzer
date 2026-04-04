/**
 * Integration tests for the complete book ingestion flow:
 * POST /api/courses (stub) → POST /api/books/split → POST /api/books/split/confirm
 *
 * Covers: B-19 (confirm flow), B-20 (cancel cleanup), magic-byte rejection, oversized file.
 * Validates that all three API legs chain correctly end-to-end with mocked Prisma + parsers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockPrisma, mockDetectChapters, mockParsePdf, mockParseDocx } = vi.hoisted(() => {
  const db = {
    course: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    lesson: {
      create: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return {
    mockPrisma: db,
    mockDetectChapters: vi.fn(),
    mockParsePdf: vi.fn(),
    mockParseDocx: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/split-chapters", () => ({ detectChapters: mockDetectChapters }));
vi.mock("@/lib/parse-book", () => ({
  parsePdf: mockParsePdf,
  parseDocx: mockParseDocx,
  parseMarkdownChapters: vi.fn().mockReturnValue([]),
}));
vi.mock("@/lib/file-security", () => ({
  validateMagicBytes: vi.fn(),
  sanitizeEpubHtml: (html: string) => html,
  stripHtmlTags: (html: string) => html.replace(/<[^>]+>/g, ""),
}));
vi.mock("@/lib/parse-epub", () => ({ parseEpub: vi.fn() }));
vi.mock("@/lib/split-ai", () => ({ detectChaptersWithAI: vi.fn() }));

// ─── Import AFTER mocks ──────────────────────────────────────────────────────
import { POST as coursesPost } from "@/app/api/courses/route";
import { POST as splitPost } from "@/app/api/books/split/route";
import { POST as confirmPost } from "@/app/api/books/split/confirm/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeJson(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const BOOK_ID = "book-abc-123";

const MOCK_CHAPTERS_RESULT = {
  chapters: [
    { title: "Chương 1: Mở đầu", content: "Nội dung chương 1", chapterNumber: 1, wordCount: 500, short: false, confidence: 0.9, patternType: "keyword" },
    { title: "Chương 2: Phát triển", content: "Nội dung chương 2", chapterNumber: 2, wordCount: 600, short: false, confidence: 0.9, patternType: "keyword" },
    { title: "Chương 3: Kết luận", content: "Nội dung chương 3", chapterNumber: 3, wordCount: 300, short: false, confidence: 0.9, patternType: "keyword" },
  ],
  avgConfidence: 0.9,
  method: "heuristic" as const,
  patternFamily: "keyword" as const,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Book ingestion flow — end-to-end", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // POST /api/courses — stub creation
    mockPrisma.course.create.mockResolvedValue({
      id: BOOK_ID,
      title: "Test Book",
      contentType: "book",
      lessons: [],
    });

    // POST /api/books/split — book lookup + update
    mockPrisma.course.findFirst.mockResolvedValue({ id: BOOK_ID, contentType: "book" });
    mockPrisma.course.update.mockResolvedValue({ id: BOOK_ID });

    // Heuristic detection
    mockDetectChapters.mockReturnValue(MOCK_CHAPTERS_RESULT);
    mockParsePdf.mockResolvedValue({ text: "Chương 1\n...\nChương 2\n...", warning: null });
    mockParseDocx.mockResolvedValue({ text: "Chương 1\n...\nChương 2\n..." });

    // POST /api/books/split/confirm — transaction + lesson creation
    mockPrisma.lesson.count.mockResolvedValue(0);
    mockPrisma.lesson.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: `lesson-${data.order}`,
          title: data.title,
          order: data.order,
          chapterNumber: data.chapterNumber ?? null,
        })
    );
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)
    );
  });

  // ── Leg 1: Create book stub via POST /api/courses ─────────────────────────
  describe("Leg 1: POST /api/courses — book stub creation", () => {
    it("creates a course with contentType='book' and returns 201", async () => {
      const req = makeJson("http://localhost/api/courses", {
        title: "Design Patterns",
        contentType: "book",
        author: "Gang of Four",
        isbn: "978-0201633610",
        publisher: "Addison-Wesley",
      });

      const res = await coursesPost(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.contentType).toBe("book");
      expect(mockPrisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Design Patterns",
            contentType: "book",
            author: "Gang of Four",
            isbn: "978-0201633610",
            publisher: "Addison-Wesley",
          }),
        })
      );
    });

    it("creates book stub without optional metadata fields", async () => {
      const req = makeJson("http://localhost/api/courses", {
        title: "Minimal Book",
        contentType: "book",
      });

      const res = await coursesPost(req);
      expect(res.status).toBe(201);
    });

    it("returns 400 when title is missing", async () => {
      const req = makeJson("http://localhost/api/courses", { contentType: "book" });
      const res = await coursesPost(req);
      expect(res.status).toBe(400);
    });
  });

  // ── Leg 2: Chapter detection via POST /api/books/split ───────────────────
  describe("Leg 2: POST /api/books/split — chapter detection", () => {
    it("accepts TXT content and returns heuristic chapters", async () => {
      const req = makeJson("http://localhost/api/books/split", {
        bookId: BOOK_ID,
        format: "txt",
        content: "Chương 1\nNội dung\n\nChương 2\nNội dung 2",
      });

      const res = await splitPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.method).toBe("heuristic");
      expect(data.chapters).toHaveLength(3);
      expect(data.chapters[0].title).toBe("Chương 1: Mở đầu");
      expect(data.chapters[0].content).toBe("Nội dung chương 1");
    });

    it("accepts PDF content (base64) and returns chapters", async () => {
      const req = makeJson("http://localhost/api/books/split", {
        bookId: BOOK_ID,
        format: "pdf",
        content: Buffer.from("fake-pdf-bytes").toString("base64"),
      });

      const res = await splitPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.chapters.length).toBeGreaterThan(0);
      expect(mockParsePdf).toHaveBeenCalled();
    });

    it("returns 413 for oversized content", async () => {
      const oversized = "A".repeat(50 * 1024 * 1024 + 1);
      const req = makeJson("http://localhost/api/books/split", {
        bookId: BOOK_ID,
        format: "txt",
        content: oversized,
      });

      const res = await splitPost(req);
      expect(res.status).toBe(413);
    });

    it("returns 400 for unsupported format", async () => {
      const req = makeJson("http://localhost/api/books/split", {
        bookId: BOOK_ID,
        format: "jpg",
        content: "image-data",
      });

      const res = await splitPost(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 if bookId does not belong to user", async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      const req = makeJson("http://localhost/api/books/split", {
        bookId: "non-existent",
        format: "txt",
        content: "content",
      });

      const res = await splitPost(req);
      expect(res.status).toBe(404);
    });

    it("persists rawContent on the book course record", async () => {
      const req = makeJson("http://localhost/api/books/split", {
        bookId: BOOK_ID,
        format: "txt",
        content: "raw book text",
      });

      await splitPost(req);

      expect(mockPrisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BOOK_ID },
          data: expect.objectContaining({ rawContent: expect.any(String) }),
        })
      );
    });
  });

  // ── Leg 3: Lesson creation via POST /api/books/split/confirm ─────────────
  describe("Leg 3: POST /api/books/split/confirm — lesson creation", () => {
    const confirmBody = {
      bookId: BOOK_ID,
      chapters: [
        { index: 1, title: "Chương 1: Mở đầu", content: "Nội dung chương 1", chapterNumber: 1 },
        { index: 2, title: "Chương 2: Phát triển", content: "Nội dung chương 2", chapterNumber: 2 },
        { index: 3, title: "Chương 3: Kết luận", content: "Nội dung chương 3", chapterNumber: 3 },
      ],
    };

    it("creates 3 lessons and returns courseId", async () => {
      const req = makeJson("http://localhost/api/books/split/confirm", confirmBody);
      const res = await confirmPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.created).toHaveLength(3);
      expect(data.courseId).toBe(BOOK_ID);
    });

    it("lessons have sequential order starting from 1", async () => {
      const req = makeJson("http://localhost/api/books/split/confirm", confirmBody);
      await confirmPost(req);

      const calls = mockPrisma.lesson.create.mock.calls;
      expect(calls[0][0].data.order).toBe(1);
      expect(calls[1][0].data.order).toBe(2);
      expect(calls[2][0].data.order).toBe(3);
    });

    it("stores chapter content as lesson transcript", async () => {
      const req = makeJson("http://localhost/api/books/split/confirm", confirmBody);
      await confirmPost(req);

      const calls = mockPrisma.lesson.create.mock.calls;
      expect(calls[0][0].data.transcript).toBe("Nội dung chương 1");
      expect(calls[1][0].data.transcript).toBe("Nội dung chương 2");
    });

    it("sets chapterNumber on each lesson", async () => {
      const req = makeJson("http://localhost/api/books/split/confirm", confirmBody);
      await confirmPost(req);

      const calls = mockPrisma.lesson.create.mock.calls;
      expect(calls[0][0].data.chapterNumber).toBe(1);
      expect(calls[2][0].data.chapterNumber).toBe(3);
    });

    it("returns 409 if book already has lessons (re-split guard)", async () => {
      mockPrisma.lesson.count.mockResolvedValue(3);

      const req = makeJson("http://localhost/api/books/split/confirm", confirmBody);
      const res = await confirmPost(req);

      expect(res.status).toBe(409);
    });
  });

  // ── Full happy path (3-leg chain) ─────────────────────────────────────────
  describe("Complete chain: stub → split → confirm", () => {
    it("chains all 3 API legs and produces lessons", async () => {
      // Leg 1: Create stub
      const stubRes = await coursesPost(
        makeJson("http://localhost/api/courses", { title: "Python Mastery", contentType: "book" })
      );
      expect(stubRes.status).toBe(201);
      const stubData = await stubRes.json();
      const bookId = stubData.id;
      expect(bookId).toBeTruthy();

      // Leg 2: Split
      const splitRes = await splitPost(
        makeJson("http://localhost/api/books/split", {
          bookId,
          format: "txt",
          content: "Chương 1\nNội dung\nChương 2\nNội dung 2",
        })
      );
      expect(splitRes.status).toBe(200);
      const splitData = await splitRes.json();
      expect(splitData.chapters.length).toBeGreaterThan(0);

      // Leg 3: Confirm
      const chapters = splitData.chapters.map(
        (ch: { index: number; title: string; content: string }) => ({
          index: ch.index,
          title: ch.title,
          content: ch.content,
          chapterNumber: ch.index,
        })
      );

      const confirmRes = await confirmPost(
        makeJson("http://localhost/api/books/split/confirm", { bookId, chapters })
      );
      expect(confirmRes.status).toBe(200);
      const confirmData = await confirmRes.json();
      expect(confirmData.created).toHaveLength(chapters.length);
      expect(confirmData.courseId).toBe(bookId);
    });
  });

  // ── Cancel/cleanup flow ───────────────────────────────────────────────────
  describe("Cancel flow — stub cleanup", () => {
    it("split returns 404 after stub is deleted (cancel path)", async () => {
      // Simulate: user cancels → stub deleted → split call fails gracefully
      mockPrisma.course.findFirst.mockResolvedValue(null);

      const req = makeJson("http://localhost/api/books/split", {
        bookId: "deleted-stub-id",
        format: "txt",
        content: "content",
      });

      const res = await splitPost(req);
      expect(res.status).toBe(404);
    });
  });

  // ── Magic-byte rejection ──────────────────────────────────────────────────
  describe("Security: magic-byte rejection", () => {
    it("returns 400 when PDF magic bytes are invalid", async () => {
      // Re-import validateMagicBytes with a throwing mock
      const { validateMagicBytes } = await import("@/lib/file-security");
      vi.mocked(validateMagicBytes).mockImplementationOnce(() => {
        throw new Error("Magic bytes mismatch: expected PDF");
      });

      const req = makeJson("http://localhost/api/books/split", {
        bookId: BOOK_ID,
        format: "pdf",
        content: Buffer.from("not-a-pdf").toString("base64"),
      });

      const res = await splitPost(req);
      expect(res.status).toBe(400);
    });
  });
});
