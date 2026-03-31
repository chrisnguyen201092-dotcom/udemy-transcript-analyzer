/**
 * Integration tests for POST /api/books/split and POST /api/books/split/confirm.
 * Tests chapter splitting preview and confirmation flow.
 *
 * Covers: B-17 (heuristic), B-18 (AI fallback — stubbed), B-19 (confirm)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockPrisma, mockDetectChapters, mockParsePdf, mockParseDocx } = vi.hoisted(() => ({
  mockPrisma: {
    course: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    lesson: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    // H-7: Route now uses interactive $transaction(async (tx) => {...})
    // Mock executes the callback, passing mockPrisma as tx so sub-mocks work
    $transaction: vi.fn(),
  },
  mockDetectChapters: vi.fn(),
  mockParsePdf: vi.fn(),
  mockParseDocx: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/split-chapters", () => ({
  detectChapters: mockDetectChapters,
}));
vi.mock("@/lib/parse-book", () => ({
  parsePdf: mockParsePdf,
  parseDocx: mockParseDocx,
  parseMarkdownChapters: vi.fn(),
}));

// ─── Import AFTER mocks ──────────────────────────────────────────────────────
import { POST as splitPost } from "@/app/api/books/split/route";
import { POST as confirmPost } from "@/app/api/books/split/confirm/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeSplitRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/books/split", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeConfirmRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/books/split/confirm", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const MOCK_BOOK = {
  id: "book-1",
  title: "Test Book",
  contentType: "book",
};

const MOCK_CHAPTERS = {
  chapters: [
    { title: "Chapter 1", content: "Content of chapter one", chapterNumber: 1, wordCount: 500, short: false, confidence: 0.95, patternType: "keyword" },
    { title: "Chapter 2", content: "Content of chapter two", chapterNumber: 2, wordCount: 300, short: false, confidence: 0.95, patternType: "keyword" },
  ],
  avgConfidence: 0.95,
  method: "heuristic" as const,
  patternFamily: "keyword" as const,
};

const VALID_SPLIT_BODY = {
  bookId: "book-1",
  format: "txt",
  content: "Chapter 1\nContent of chapter one\n\nChapter 2\nContent of chapter two",
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/books/split
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/books/split", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.course.findUnique.mockResolvedValue(MOCK_BOOK);
    mockPrisma.course.update.mockResolvedValue(MOCK_BOOK);
    mockDetectChapters.mockReturnValue(MOCK_CHAPTERS);
    mockParsePdf.mockResolvedValue({ text: "parsed text", warning: null });
    mockParseDocx.mockResolvedValue({ text: "parsed text" });
  });

  // ── Validation ────────────────────────────────────────────────────────────
  describe("validation", () => {
    it("returns 400 if bookId is missing", async () => {
      const req = makeSplitRequest({ format: "pdf", content: "text" });
      const res = await splitPost(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 if format is invalid", async () => {
      const req = makeSplitRequest({ bookId: "book-1", format: "exe", content: "text" });
      const res = await splitPost(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 if content is empty", async () => {
      const req = makeSplitRequest({ bookId: "book-1", format: "pdf", content: "" });
      const res = await splitPost(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 if book not found", async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);
      const req = makeSplitRequest(VALID_SPLIT_BODY);
      const res = await splitPost(req);
      expect(res.status).toBe(404);
    });
  });

  // ── Heuristic detection ───────────────────────────────────────────────────
  describe("heuristic detection", () => {
    it("returns chapters detected by heuristic with method='heuristic'", async () => {
      const req = makeSplitRequest(VALID_SPLIT_BODY);
      const res = await splitPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.method).toBe("heuristic");
      expect(data.chapters).toHaveLength(2);
      expect(data.chapters[0]).toMatchObject({
        index: 1,
        title: "Chapter 1",
        wordCount: 500,
      });
    });

    it("passes content to detectChapters", async () => {
      const req = makeSplitRequest(VALID_SPLIT_BODY);
      await splitPost(req);

      expect(mockDetectChapters).toHaveBeenCalledWith(VALID_SPLIT_BODY.content.trim());
    });

    it("includes content in chapter response", async () => {
      const req = makeSplitRequest(VALID_SPLIT_BODY);
      const res = await splitPost(req);
      const data = await res.json();

      expect(data.chapters[0].content).toBe("Content of chapter one");
      expect(data.chapters[1].content).toBe("Content of chapter two");
    });
  });

  // ── Fallback (single chapter) ─────────────────────────────────────────────
  describe("fallback behavior", () => {
    it("returns method='fallback' when detectChapters returns 1 chapter", async () => {
      mockDetectChapters.mockReturnValue({
        chapters: [
          { title: "Untitled", content: "all text", chapterNumber: 1, wordCount: 1000, short: false, confidence: 0, patternType: "fallback" },
        ],
        avgConfidence: 0,
        method: "fallback",
        patternFamily: "fallback",
      });

      const req = makeSplitRequest(VALID_SPLIT_BODY);
      const res = await splitPost(req);
      const data = await res.json();

      expect(data.method).toBe("fallback");
      expect(data.chapters).toHaveLength(1);
    });

    it("adds warning when only 1 chapter is detected", async () => {
      mockDetectChapters.mockReturnValue({
        chapters: [
          { title: "Untitled", content: "all text", chapterNumber: 1, wordCount: 1000, short: false, confidence: 0, patternType: "fallback" },
        ],
        avgConfidence: 0,
        method: "fallback",
        patternFamily: "fallback",
      });

      const req = makeSplitRequest(VALID_SPLIT_BODY);
      const res = await splitPost(req);
      const data = await res.json();

      expect(data.warnings.length).toBeGreaterThan(0);
    });
  });

  // ── Short chapter warning ─────────────────────────────────────────────────
  describe("short chapter warnings", () => {
    it("adds warning for chapters flagged as short", async () => {
      mockDetectChapters.mockReturnValue({
        chapters: [
          { title: "Preface", content: "Short", chapterNumber: 1, wordCount: 50, short: true, confidence: 0.9, patternType: "markdown-h1" },
          { title: "Main", content: "Long content here", chapterNumber: 2, wordCount: 500, short: false, confidence: 0.9, patternType: "markdown-h1" },
        ],
        avgConfidence: 0.9,
        method: "heuristic",
        patternFamily: "markdown-h1",
      });

      const req = makeSplitRequest(VALID_SPLIT_BODY);
      const res = await splitPost(req);
      const data = await res.json();

      expect(data.warnings.some((w: string) => w.toLowerCase().includes("ngắn") || w.toLowerCase().includes("short"))).toBe(true);
    });
  });

  // ── Format-specific ───────────────────────────────────────────────────────
  describe("format handling", () => {
    it("accepts all supported formats: pdf, docx, txt, md", async () => {
      for (const format of ["pdf", "docx", "txt", "md"]) {
        vi.clearAllMocks();
        mockPrisma.course.findUnique.mockResolvedValue(MOCK_BOOK);
        mockDetectChapters.mockReturnValue(MOCK_CHAPTERS);
        // Mock binary parsers for pdf/docx — content field is treated as base64
        mockParsePdf.mockResolvedValue({ text: "parsed text", warning: null });
        mockParseDocx.mockResolvedValue({ text: "parsed text" });

        const req = makeSplitRequest({ bookId: "book-1", format, content: "dGV4dA==" }); // base64 "text"
        const res = await splitPost(req);
        expect(res.status).toBe(200);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/books/split/confirm
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/books/split/confirm", () => {
  const VALID_CONFIRM_BODY = {
    bookId: "book-1",
    chapters: [
      { index: 1, title: "Chapter 1", content: "Content one", chapterNumber: 1, pageRange: "1-24" },
      { index: 2, title: "Chapter 2", content: "Content two", chapterNumber: 2, pageRange: "25-50" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.course.findUnique.mockResolvedValue(MOCK_BOOK);
    mockPrisma.lesson.count.mockResolvedValue(0);
    mockPrisma.lesson.findMany.mockResolvedValue([]);
    mockPrisma.lesson.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: `lesson-${data.order}`,
          title: data.title,
          order: data.order,
          chapterNumber: data.chapterNumber ?? null,
        })
    );
    // H-7: Route now uses interactive $transaction(async (tx) => {...})
    // Execute the callback, passing mockPrisma as tx so lesson.count/create work
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)
    );
  });

  // ── Validation ────────────────────────────────────────────────────────────
  describe("validation", () => {
    it("returns 400 if bookId is missing", async () => {
      const req = makeConfirmRequest({ chapters: VALID_CONFIRM_BODY.chapters });
      const res = await confirmPost(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 if chapters array is empty", async () => {
      const req = makeConfirmRequest({ bookId: "book-1", chapters: [] });
      const res = await confirmPost(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 if book not found", async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);
      const req = makeConfirmRequest(VALID_CONFIRM_BODY);
      const res = await confirmPost(req);
      expect(res.status).toBe(404);
    });

    it("returns 409 if book already has lessons", async () => {
      mockPrisma.lesson.count.mockResolvedValue(5);
      const req = makeConfirmRequest(VALID_CONFIRM_BODY);
      const res = await confirmPost(req);
      expect(res.status).toBe(409);
    });
  });

  // ── Lesson creation ───────────────────────────────────────────────────────
  describe("lesson creation", () => {
    it("creates Lesson records for each confirmed chapter", async () => {
      const req = makeConfirmRequest(VALID_CONFIRM_BODY);
      const res = await confirmPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.created).toHaveLength(2);
      expect(data.courseId).toBe("book-1");
    });

    it("sets lesson order sequentially from 1", async () => {
      const req = makeConfirmRequest(VALID_CONFIRM_BODY);
      await confirmPost(req);

      const calls = mockPrisma.lesson.create.mock.calls;
      expect(calls[0][0].data.order).toBe(1);
      expect(calls[1][0].data.order).toBe(2);
    });

    it("passes chapterNumber and pageRange to lesson data", async () => {
      const req = makeConfirmRequest(VALID_CONFIRM_BODY);
      await confirmPost(req);

      const calls = mockPrisma.lesson.create.mock.calls;
      expect(calls[0][0].data.chapterNumber).toBe(1);
      expect(calls[0][0].data.pageRange).toBe("1-24");
      expect(calls[1][0].data.chapterNumber).toBe(2);
      expect(calls[1][0].data.pageRange).toBe("25-50");
    });

    it("stores chapter content as lesson transcript", async () => {
      const req = makeConfirmRequest(VALID_CONFIRM_BODY);
      await confirmPost(req);

      const calls = mockPrisma.lesson.create.mock.calls;
      expect(calls[0][0].data.transcript).toBe("Content one");
      expect(calls[1][0].data.transcript).toBe("Content two");
    });

    it("returns created lesson details", async () => {
      const req = makeConfirmRequest(VALID_CONFIRM_BODY);
      const res = await confirmPost(req);
      const data = await res.json();

      expect(data.created[0]).toMatchObject({
        id: "lesson-1",
        title: "Chapter 1",
        order: 1,
        chapterNumber: 1,
      });
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("handles chapters without pageRange (nullable)", async () => {
      const body = {
        bookId: "book-1",
        chapters: [
          { index: 1, title: "Chapter 1", content: "Content one", chapterNumber: 1 },
        ],
      };

      const req = makeConfirmRequest(body);
      const res = await confirmPost(req);
      expect(res.status).toBe(200);

      const calls = mockPrisma.lesson.create.mock.calls;
      expect(calls[0][0].data.pageRange).toBeUndefined();
    });

    it("handles DB error gracefully", async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error("DB error"));
      const req = makeConfirmRequest(VALID_CONFIRM_BODY);
      const res = await confirmPost(req);
      expect(res.status).toBe(500);
    });
  });
});

// ── Split edge cases ─────────────────────────────────────────────────────────

describe("POST /api/books/split — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.course.findUnique.mockResolvedValue(MOCK_BOOK);
    mockPrisma.course.update.mockResolvedValue(MOCK_BOOK);
    mockParsePdf.mockResolvedValue({ text: "parsed text", warning: null });
    mockParseDocx.mockResolvedValue({ text: "parsed text" });
  });

  it("handles empty chapters array after splitting", async () => {
    mockDetectChapters.mockReturnValue({
      chapters: [],
      avgConfidence: 0,
      method: "fallback",
      patternFamily: "fallback",
    });

    const req = makeSplitRequest(VALID_SPLIT_BODY);
    const res = await splitPost(req);
    const data = await res.json();

    // When no chapters detected, implementation should return fallback or empty
    expect(res.status).toBe(200);
    // Should at least have a method field
    expect(data.method).toBeDefined();
  });

  it("handles chapter with only whitespace content", async () => {
    mockDetectChapters.mockReturnValue({
      chapters: [
        { title: "Empty Chapter", content: "   \n\t\n  ", chapterNumber: 1, wordCount: 0, short: true, confidence: 0.9, patternType: "markdown-h1" },
        { title: "Real Chapter", content: "Actual content here", chapterNumber: 2, wordCount: 300, short: false, confidence: 0.9, patternType: "markdown-h1" },
      ],
      avgConfidence: 0.9,
      method: "heuristic",
      patternFamily: "markdown-h1",
    });

    const req = makeSplitRequest(VALID_SPLIT_BODY);
    const res = await splitPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.chapters).toHaveLength(2);
    // Whitespace chapter should still be present but possibly flagged
    expect(data.chapters[0].content).toBeDefined();
  });

  it("AI fallback when heuristic fails", async () => {
    // No heuristic chapters detected (only 1 "Untitled" fallback)
    mockDetectChapters.mockReturnValue({
      chapters: [
        { title: "Untitled", content: "all the text in one block", chapterNumber: 1, wordCount: 5000, short: false, confidence: 0, patternType: "fallback" },
      ],
      avgConfidence: 0,
      method: "fallback",
      patternFamily: "fallback",
    });

    const req = makeSplitRequest(VALID_SPLIT_BODY);
    const res = await splitPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // When only 1 chapter, method should be 'fallback'
    expect(data.method).toBe("fallback");
    expect(data.chapters).toHaveLength(1);
    // Should include a warning about single chapter detection
    expect(data.warnings.length).toBeGreaterThan(0);
  });
});
