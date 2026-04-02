/**
 * Integration tests for POST /api/books/upload.
 * Tests book file upload flow (PDF, DOCX, TXT, MD) with mocked parsers and Prisma.
 * Uses JSON body (matching courses/upload pattern) — NOT FormData.
 *
 * Covers: B-04 (PDF), B-06 (DOCX), B-07 (Markdown/TXT), B-08 (metadata)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockPrisma, mockParsePdf, mockParseDocx, mockParseMarkdownChapters } =
  vi.hoisted(() => {
    const db = {
      course: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      lesson: {
        create: vi.fn(),
        count: vi.fn(),
      },
      // Route wraps course.create + lesson.create(s) in $transaction.
      // Callback receives db itself so all sub-mocks remain active.
      $transaction: vi.fn().mockImplementation(
        async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)
      ),
    };
    return {
      mockPrisma: db,
      mockParsePdf: vi.fn(),
      mockParseDocx: vi.fn(),
      mockParseMarkdownChapters: vi.fn(),
    };
  });

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/parse-book", () => ({
  parsePdf: mockParsePdf,
  parseDocx: mockParseDocx,
  parseMarkdownChapters: mockParseMarkdownChapters,
}));

// ─── Import AFTER mocks ──────────────────────────────────────────────────────
import { POST } from "@/app/api/books/upload/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeUploadRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/books/upload", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_COURSE = { id: "c1", title: "Existing Book", contentType: "book" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/books/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: create new course, no existing lessons
    mockPrisma.course.create.mockResolvedValue({ id: "new-c1", title: "Test Book" });
    mockPrisma.course.findFirst.mockResolvedValue(VALID_COURSE);
    mockPrisma.lesson.count.mockResolvedValue(0);
    mockPrisma.lesson.create.mockImplementation(
      (args: { data: { title: string; transcript: string | null; order: number; courseId: string } }) =>
        Promise.resolve({ id: `l-${args.data.order}`, ...args.data })
    );

    // Default parser returns
    mockParsePdf.mockResolvedValue({ text: "a".repeat(200), pages: 10 });
    mockParseDocx.mockResolvedValue({ text: "Docx content", html: "<p>Docx content</p>" });
    mockParseMarkdownChapters.mockReturnValue([]);
  });

  // ── PDF upload ─────────────────────────────────────────────────────────────
  describe("PDF upload (B-04)", () => {
    it("creates course and lesson from valid PDF", async () => {
      const req = makeUploadRequest({
        title: "Clean Code",
        file: { name: "clean-code.pdf", content: Buffer.from("fake-pdf-bytes").toString("base64"), type: "application/pdf" },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.courseId).toBe("new-c1");
      expect(json.created).toHaveLength(1);
      expect(json.created[0].title).toBe("clean-code");
      expect(json.warnings).toEqual([]);
      expect(mockPrisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: "Clean Code", contentType: "book" }),
        })
      );
    });

    it("returns scanned_pdf warning when PDF has no extractable text", async () => {
      mockParsePdf.mockResolvedValue({ text: "", pages: 5, warning: "scanned_pdf" });

      const req = makeUploadRequest({
        title: "Scanned Book",
        file: { name: "scan.pdf", content: Buffer.from("fake-pdf-bytes").toString("base64"), type: "application/pdf" },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "scanned_pdf" }),
        ])
      );
    });

    it("returns 400 when PDF is corrupt (parser throws)", async () => {
      mockParsePdf.mockRejectedValue(new Error("Invalid PDF structure"));

      const req = makeUploadRequest({
        title: "Bad PDF",
        file: { name: "corrupt.pdf", content: Buffer.from("bad-bytes").toString("base64"), type: "application/pdf" },
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  // ── DOCX upload ────────────────────────────────────────────────────────────
  describe("DOCX upload (B-06)", () => {
    it("creates a single lesson from DOCX without headings", async () => {
      mockParseDocx.mockResolvedValue({ text: "Simple text", html: "<p>Simple text</p>" });

      const req = makeUploadRequest({
        title: "DOCX Book",
        file: { name: "book.docx", content: Buffer.from("fake-docx-bytes").toString("base64"), type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.created).toHaveLength(1);
      expect(json.created[0].title).toBe("book");
    });

    it("returns 400 when DOCX is corrupt", async () => {
      mockParseDocx.mockRejectedValue(new Error("Could not find main document part"));

      const req = makeUploadRequest({
        title: "Bad DOCX",
        file: { name: "corrupt.docx", content: Buffer.from("bad-bytes").toString("base64"), type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  // ── TXT upload ─────────────────────────────────────────────────────────────
  describe("TXT upload (B-07)", () => {
    it("creates a single lesson from TXT file", async () => {
      const req = makeUploadRequest({
        title: "Text Book",
        file: { name: "chapter.txt", content: "Plain text book content", type: "text/plain" },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.created).toHaveLength(1);
      expect(json.created[0].title).toBe("chapter");
    });
  });

  // ── Markdown upload ────────────────────────────────────────────────────────
  describe("Markdown upload (B-07)", () => {
    it("splits markdown with H1 headings into multiple lessons", async () => {
      mockParseMarkdownChapters.mockReturnValue([
        { title: "Introduction", content: "Intro content" },
        { title: "Methods", content: "Methods content" },
      ]);

      const req = makeUploadRequest({
        title: "MD Book",
        file: { name: "book.md", content: "# Introduction\nIntro content\n# Methods\nMethods content", type: "text/markdown" },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.created).toHaveLength(2);
      expect(json.created[0].title).toBe("Introduction");
      expect(json.created[1].title).toBe("Methods");
      expect(json.created[0].order).toBe(1);
      expect(json.created[1].order).toBe(2);
    });

    it("creates single lesson when markdown has no headings", async () => {
      mockParseMarkdownChapters.mockReturnValue([]);

      const req = makeUploadRequest({
        title: "Plain MD",
        file: { name: "notes.md", content: "Just some text without headings", type: "text/markdown" },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.created).toHaveLength(1);
      expect(json.created[0].title).toBe("notes");
    });
  });

  // ── Metadata ───────────────────────────────────────────────────────────────
  describe("Metadata (B-08)", () => {
    it("saves author, isbn, publisher on the created course", async () => {
      const req = makeUploadRequest({
        title: "Clean Code",
        author: "Robert C. Martin",
        isbn: "978-0132350884",
        publisher: "Prentice Hall",
        file: { name: "book.pdf", content: Buffer.from("fake-pdf-bytes").toString("base64"), type: "application/pdf" },
      });

      await POST(req);

      expect(mockPrisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            author: "Robert C. Martin",
            isbn: "978-0132350884",
            publisher: "Prentice Hall",
          }),
        })
      );
    });

    it("handles missing optional metadata fields", async () => {
      const req = makeUploadRequest({
        title: "No Metadata Book",
        file: { name: "book.pdf", content: Buffer.from("fake-pdf-bytes").toString("base64"), type: "application/pdf" },
      });

      await POST(req);

      expect(mockPrisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "No Metadata Book",
            contentType: "book",
          }),
        })
      );
    });
  });

  // ── Existing course ────────────────────────────────────────────────────────
  describe("Adding to existing course", () => {
    it("appends lessons to existing course when courseId is provided", async () => {
      mockPrisma.lesson.count.mockResolvedValue(3);

      const req = makeUploadRequest({
        title: "Ignored Title",
        courseId: "c1",
        file: { name: "extra.pdf", content: Buffer.from("fake-pdf-bytes").toString("base64"), type: "application/pdf" },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.courseId).toBe("c1");
      expect(json.created[0].order).toBe(4); // existing 3 + 1
      expect(mockPrisma.course.create).not.toHaveBeenCalled();
    });

    it("returns 404 when courseId does not exist", async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      const req = makeUploadRequest({
        title: "Book",
        courseId: "nonexistent",
        file: { name: "book.pdf", content: Buffer.from("fake-pdf-bytes").toString("base64"), type: "application/pdf" },
      });

      const res = await POST(req);

      expect(res.status).toBe(404);
    });
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  describe("Validation", () => {
    it("returns 400 when title is missing", async () => {
      const req = makeUploadRequest({
        file: { name: "book.pdf", content: Buffer.from("fake-pdf-bytes").toString("base64"), type: "application/pdf" },
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 when file is missing", async () => {
      const req = makeUploadRequest({ title: "No File" });

      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 for unsupported file extension", async () => {
      const req = makeUploadRequest({
        title: "Bad File",
        file: { name: "image.jpg", content: Buffer.from("fake-image-bytes").toString("base64"), type: "image/jpeg" },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toMatch(/không hỗ trợ|unsupported|format/i);
    });

    it("returns 413 when file content exceeds 50 MB limit", async () => {
      // Create a string > 50 MB to trigger the limit
      const hugeContent = "A".repeat(50 * 1024 * 1024 + 1);

      const req = makeUploadRequest({
        title: "Huge File",
        file: { name: "huge.pdf", content: hugeContent, type: "application/pdf" },
      });

      const res = await POST(req);
      expect(res.status).toBe(413);
    });
  });

  // ── Order assignment ───────────────────────────────────────────────────────
  describe("Lesson ordering", () => {
    it("starts order from 1 for new course", async () => {
      mockPrisma.lesson.count.mockResolvedValue(0);

      const req = makeUploadRequest({
        title: "New Book",
        file: { name: "book.pdf", content: Buffer.from("fake-pdf-bytes").toString("base64"), type: "application/pdf" },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(json.created[0].order).toBe(1);
    });
  });

  // ── C-8 regression: lesson creation failure → course rolled back ───────────

  describe("C-8 regression: atomic lesson creation", () => {
    it("returns 500 when lesson.create throws inside $transaction", async () => {
      // The route uses prisma.$transaction to create all lessons atomically.
      // If any lesson.create fails, the transaction is aborted.
      // The course was already created BEFORE the transaction — this test verifies
      // the route returns a 500 (not 200 with partial data) when the tx fails.
      mockPrisma.lesson.create.mockRejectedValue(new Error("DB constraint violation"));

      const req = makeUploadRequest({
        title: "Failing Book",
        file: { name: "book.pdf", content: Buffer.from("fake-pdf-bytes").toString("base64"), type: "application/pdf" },
      });

      const res = await POST(req);

      // Must not return 200 with partial created array
      expect(res.status).not.toBe(200);
      // Should be 500 (transaction failed)
      expect(res.status).toBe(500);
    });

    it("does not return partial created list when only some lessons succeed", async () => {
      // First lesson succeeds, second throws — transaction rolls back
      let callCount = 0;
      mockPrisma.lesson.create.mockImplementation(
        (args: { data: { title: string; transcript: string | null; order: number; courseId: string } }) => {
          callCount++;
          if (callCount === 2) {
            return Promise.reject(new Error("Lesson 2 failed"));
          }
          return Promise.resolve({ id: `l-${args.data.order}`, ...args.data });
        }
      );

      // Use markdown with 2 chapters so 2 lessons are attempted
      mockParseMarkdownChapters.mockReturnValue([
        { title: "Chapter 1", content: "Content 1" },
        { title: "Chapter 2", content: "Content 2" },
      ]);

      const req = makeUploadRequest({
        title: "Partial Book",
        file: {
          name: "book.md",
          content: "# Chapter 1\nContent 1\n# Chapter 2\nContent 2",
          type: "text/markdown",
        },
      });

      const res = await POST(req);

      // Must not return 200 with partial data
      expect(res.status).not.toBe(200);
    });
  });

  // ── Upload edge cases ──────────────────────────────────────────────────────
  describe("Upload edge cases", () => {
    it("handles very large PDF (>10MB) gracefully", async () => {
      // Generate content > 10MB (base64 encoded)
      const largeContent = "A".repeat(10 * 1024 * 1024 + 1);

      const req = makeUploadRequest({
        title: "Large PDF",
        file: { name: "large.pdf", content: largeContent, type: "application/pdf" },
      });

      const res = await POST(req);

      // Should either succeed (if no 10MB limit) or return 413 (if limited)
      // The existing test tests 50MB → 413, so 10MB should be within limit
      expect([200, 413]).toContain(res.status);
    });

    it("handles PDF with no extractable text", async () => {
      mockParsePdf.mockResolvedValue({ text: "", pages: 5, warning: "scanned_pdf" });

      const req = makeUploadRequest({
        title: "Empty PDF",
        file: { name: "empty.pdf", content: Buffer.from("fake-pdf-bytes").toString("base64"), type: "application/pdf" },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      // Lesson should still be created with empty transcript
      expect(json.created).toHaveLength(1);
      expect(json.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "scanned_pdf" }),
        ])
      );
    });
  });
});
