/**
 * Unit tests for book parsing utilities: parsePdf, parseDocx, parseMarkdownChapters
 * Covers: B-04 (PDF), B-06 (DOCX), B-07 (Markdown)
 *
 * pdf-parse and mammoth are mocked — no real file I/O.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockGetText, mockDestroy, mockMammoth } = vi.hoisted(() => ({
  mockGetText: vi.fn(),
  mockDestroy: vi.fn().mockResolvedValue(undefined),
  mockMammoth: {
    convertToHtml: vi.fn(),
    extractRawText: vi.fn(),
  },
}));

vi.mock("pdf-parse", () => ({
  PDFParse: function MockPDFParse() {
    return { getText: mockGetText, destroy: mockDestroy };
  },
}));
vi.mock("mammoth", () => ({ default: mockMammoth }));

// ─── Import AFTER mocks ──────────────────────────────────────────────────────
import { parsePdf, parseDocx, parseMarkdownChapters } from "@/lib/parse-book";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("parsePdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts text and page count from a valid PDF", async () => {
    const longText = "Hello world content here. ".repeat(5); // 125 chars, above 100 threshold
    mockGetText.mockResolvedValue({ text: longText, total: 5, pages: [] });

    const result = await parsePdf(Buffer.from("fake-pdf"));

    expect(result.text).toBe(longText);
    expect(result.pages).toBe(5);
    expect(result.warning).toBeUndefined();
  });

  it("returns scanned_pdf warning when text is empty", async () => {
    mockGetText.mockResolvedValue({ text: "", total: 10, pages: [] });

    const result = await parsePdf(Buffer.from("fake-pdf"));

    expect(result.text).toBe("");
    expect(result.warning).toBe("scanned_pdf");
  });

  it("returns scanned_pdf warning when text is under 100 chars", async () => {
    mockGetText.mockResolvedValue({ text: "short", total: 3, pages: [] });

    const result = await parsePdf(Buffer.from("fake-pdf"));

    expect(result.warning).toBe("scanned_pdf");
  });

  it("does NOT return warning when text is >= 100 chars", async () => {
    const longText = "a".repeat(100);
    mockGetText.mockResolvedValue({ text: longText, total: 1, pages: [] });

    const result = await parsePdf(Buffer.from("fake-pdf"));

    expect(result.warning).toBeUndefined();
    expect(result.text).toBe(longText);
  });

  it("throws when pdf-parse rejects (corrupt file)", async () => {
    mockGetText.mockRejectedValue(new Error("Invalid PDF structure"));

    await expect(parsePdf(Buffer.from("corrupt"))).rejects.toThrow("Invalid PDF structure");
  });
});

describe("parseDocx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts text and HTML from a valid DOCX", async () => {
    mockMammoth.extractRawText.mockResolvedValue({ value: "Plain text content" });
    mockMammoth.convertToHtml.mockResolvedValue({ value: "<p>Plain text content</p>" });

    const result = await parseDocx(Buffer.from("fake-docx"));

    expect(result.text).toBe("Plain text content");
    expect(result.html).toBe("<p>Plain text content</p>");
  });

  it("returns empty strings when DOCX has no content", async () => {
    mockMammoth.extractRawText.mockResolvedValue({ value: "" });
    mockMammoth.convertToHtml.mockResolvedValue({ value: "" });

    const result = await parseDocx(Buffer.from("empty-docx"));

    expect(result.text).toBe("");
    expect(result.html).toBe("");
  });

  it("throws when mammoth rejects (corrupt file)", async () => {
    mockMammoth.extractRawText.mockRejectedValue(new Error("Could not find main document part"));

    await expect(parseDocx(Buffer.from("corrupt"))).rejects.toThrow(
      "Could not find main document part"
    );
  });
});

describe("parseMarkdownChapters", () => {
  it("splits by H1 headings into chapters", () => {
    const md = `# Chapter 1
Content of chapter 1.

# Chapter 2
Content of chapter 2.`;

    const chapters = parseMarkdownChapters(md);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Chapter 1");
    expect(chapters[0].content).toContain("Content of chapter 1");
    expect(chapters[1].title).toBe("Chapter 2");
    expect(chapters[1].content).toContain("Content of chapter 2");
  });

  it("returns empty array when no headings found", () => {
    const md = `Just some text without any headings.
More lines here.`;

    const chapters = parseMarkdownChapters(md);

    expect(chapters).toEqual([]);
  });

  it("handles content before the first heading (preamble preserved)", () => {
    const md = `Some preamble text.

# Introduction
This is the introduction.`;

    const chapters = parseMarkdownChapters(md);

    // Preamble before first H1 is preserved as a "Preamble" chapter
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Preamble");
    expect(chapters[0].content).toBe("Some preamble text.");
    expect(chapters[1].title).toBe("Introduction");
  });

  it("trims whitespace from chapter titles and content", () => {
    const md = `#   Spaced Title  
  Content with leading spaces.  `;

    const chapters = parseMarkdownChapters(md);

    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("Spaced Title");
    expect(chapters[0].content).toBe("Content with leading spaces.");
  });

  it("does NOT split on ## H2 headings (only H1)", () => {
    const md = `# Main Chapter
## Sub-section
Content under sub-section.

## Another Sub-section
More content.`;

    const chapters = parseMarkdownChapters(md);

    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("Main Chapter");
    expect(chapters[0].content).toContain("Sub-section");
    expect(chapters[0].content).toContain("Another Sub-section");
  });

  it("handles empty chapter content", () => {
    const md = `# Empty Chapter
# Next Chapter
Some content here.`;

    const chapters = parseMarkdownChapters(md);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Empty Chapter");
    expect(chapters[0].content).toBe("");
    expect(chapters[1].title).toBe("Next Chapter");
    expect(chapters[1].content).toContain("Some content here");
  });

  it("handles markdown with only one heading", () => {
    const md = `# Solo Chapter
All the content goes here.
Multiple lines of content.`;

    const chapters = parseMarkdownChapters(md);

    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("Solo Chapter");
    expect(chapters[0].content).toContain("All the content goes here");
  });
});

describe("parsePdf — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles empty PDF content", async () => {
    mockGetText.mockResolvedValue({ text: "", total: 0, pages: [] });

    const result = await parsePdf(Buffer.from("empty-pdf"));

    expect(result.text).toBe("");
    expect(result.warning).toBe("scanned_pdf");
  });

  it("handles very short content (<50 chars)", async () => {
    mockGetText.mockResolvedValue({ text: "Short.", total: 1, pages: [] });

    const result = await parsePdf(Buffer.from("short-pdf"));

    expect(result.text).toBe("Short.");
    expect(result.warning).toBe("scanned_pdf");
  });
});
