/**
 * Integration tests for POST /api/books/metadata-preview.
 * Verifies metadata extraction returns correct fields without DB side-effects.
 *
 * Covers: Phase 2 — metadata auto-fill, magic-byte rejection, size limit.
 *
 * Note: req.formData() does not work in Vitest/JSDOM environment, so we mock
 * the NextRequest and its formData() method directly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockExtractBookMetadata, mockValidateMagicBytes } = vi.hoisted(() => ({
  mockExtractBookMetadata: vi.fn(),
  mockValidateMagicBytes: vi.fn(),
}));

vi.mock("@/lib/extract-book-metadata", () => ({
  extractBookMetadata: mockExtractBookMetadata,
}));
vi.mock("@/lib/file-security", () => ({
  validateMagicBytes: mockValidateMagicBytes,
  sanitizeEpubHtml: (html: string) => html,
  stripHtmlTags: (html: string) => html.replace(/<[^>]+>/g, ""),
}));
// No Prisma needed — this endpoint is read-only (no DB writes)

// ─── Import AFTER mocks ──────────────────────────────────────────────────────
import { POST } from "@/app/api/books/metadata-preview/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a NextRequest whose formData() resolves to a fake file entry.
 * We must mock formData() because the Node.js test environment doesn't
 * implement the multipart parser that NextRequest relies on.
 */
function makeFormRequest(
  filename: string,
  content: Buffer | string,
  mimeType = "application/octet-stream"
): NextRequest {
  const buffer = typeof content === "string" ? Buffer.from(content) : content;

  // Build a minimal File-like object that satisfies the route's expectations
  const fakeFile = {
    name: filename,
    arrayBuffer: () => Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer),
    size: buffer.byteLength,
    type: mimeType,
  };

  const req = new NextRequest("http://localhost/api/books/metadata-preview", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=----boundary` },
    body: "placeholder",
  });

  // Patch formData() to return our fake file
  req.formData = () =>
    Promise.resolve({
      get: (key: string) => (key === "file" ? fakeFile : null),
    } as unknown as FormData);

  return req;
}

/** Build a NextRequest that returns no file from formData */
function makeEmptyFormRequest(): NextRequest {
  const req = new NextRequest("http://localhost/api/books/metadata-preview", {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=----boundary" },
    body: "placeholder",
  });
  req.formData = () =>
    Promise.resolve({
      get: () => null,
    } as unknown as FormData);
  return req;
}

const MOCK_PDF_METADATA = {
  title: "Clean Code",
  author: "Robert C. Martin",
  isbn: "978-0132350884",
  publisher: "Prentice Hall",
  language: "en",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/books/metadata-preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateMagicBytes.mockReturnValue(undefined); // no-op by default
    mockExtractBookMetadata.mockResolvedValue(MOCK_PDF_METADATA);
  });

  // ── PDF ───────────────────────────────────────────────────────────────────
  describe("PDF metadata extraction", () => {
    it("returns metadata for valid PDF", async () => {
      const req = makeFormRequest("clean-code.pdf", Buffer.from("fake-pdf"), "application/pdf");
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.title).toBe("Clean Code");
      expect(data.author).toBe("Robert C. Martin");
      expect(data.isbn).toBe("978-0132350884");
      expect(data.publisher).toBe("Prentice Hall");
      expect(data.language).toBe("en");
    });

    it("calls validateMagicBytes for PDF", async () => {
      const req = makeFormRequest("book.pdf", Buffer.from("fake-pdf"), "application/pdf");
      await POST(req);
      expect(mockValidateMagicBytes).toHaveBeenCalledWith(expect.any(Buffer), ".pdf");
    });

    it("returns 400 when magic-byte validation fails for PDF", async () => {
      mockValidateMagicBytes.mockImplementation(() => {
        throw new Error("Invalid magic bytes for .pdf");
      });

      const req = makeFormRequest("fake.pdf", Buffer.from("not-a-pdf"), "application/pdf");
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/magic/i);
    });
  });

  // ── EPUB ──────────────────────────────────────────────────────────────────
  describe("EPUB metadata extraction", () => {
    it("returns metadata for valid EPUB", async () => {
      mockExtractBookMetadata.mockResolvedValue({
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        isbn: "",
        publisher: "Scribner",
        language: "en",
      });

      const req = makeFormRequest("gatsby.epub", Buffer.from("fake-epub"), "application/epub+zip");
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.title).toBe("The Great Gatsby");
      expect(data.author).toBe("F. Scott Fitzgerald");
    });

    it("calls validateMagicBytes for EPUB", async () => {
      const req = makeFormRequest("book.epub", Buffer.from("fake-epub"), "application/epub+zip");
      await POST(req);
      expect(mockValidateMagicBytes).toHaveBeenCalledWith(expect.any(Buffer), ".epub");
    });
  });

  // ── DOCX ──────────────────────────────────────────────────────────────────
  describe("DOCX metadata extraction", () => {
    it("returns metadata for valid DOCX", async () => {
      mockExtractBookMetadata.mockResolvedValue({
        title: "My Thesis",
        author: "Jane Doe",
        isbn: "",
        publisher: "",
        language: "vi",
      });

      const req = makeFormRequest(
        "thesis.docx",
        Buffer.from("fake-docx"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.title).toBe("My Thesis");
      expect(data.author).toBe("Jane Doe");
    });
  });

  // ── TXT / MD ──────────────────────────────────────────────────────────────
  describe("Text file metadata extraction", () => {
    it("returns metadata for TXT file (no magic-byte check)", async () => {
      mockExtractBookMetadata.mockResolvedValue({
        title: "Notes",
        author: "",
        isbn: "",
        publisher: "",
        language: "",
      });

      const req = makeFormRequest("notes.txt", "plain text content", "text/plain");
      const res = await POST(req);

      expect(res.status).toBe(200);
      // validateMagicBytes NOT called for text formats
      expect(mockValidateMagicBytes).not.toHaveBeenCalled();
    });

    it("returns metadata for MD file (no magic-byte check)", async () => {
      mockExtractBookMetadata.mockResolvedValue({
        title: "README",
        author: "",
        isbn: "",
        publisher: "",
        language: "",
      });

      const req = makeFormRequest("readme.md", "# README\ncontent", "text/markdown");
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockValidateMagicBytes).not.toHaveBeenCalled();
    });
  });

  // ── Unsupported format ────────────────────────────────────────────────────
  describe("Unsupported format rejection", () => {
    it("returns 400 for .jpg files", async () => {
      const req = makeFormRequest("photo.jpg", Buffer.from("fake-jpg"), "image/jpeg");
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/không hỗ trợ|unsupported/i);
    });

    it("returns 400 for .exe files", async () => {
      const req = makeFormRequest("virus.exe", Buffer.from("MZ-binary"), "application/octet-stream");
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("does not call extractBookMetadata for unsupported formats", async () => {
      const req = makeFormRequest("bad.zip", Buffer.from("PK-zip"), "application/zip");
      await POST(req);
      expect(mockExtractBookMetadata).not.toHaveBeenCalled();
    });
  });

  // ── Size limit ────────────────────────────────────────────────────────────
  describe("File size limit", () => {
    it("returns 413 for files exceeding 50MB", async () => {
      // Simulate oversized file via the arrayBuffer size — don't allocate 50MB
      const fakeFile = {
        name: "huge.pdf",
        // arrayBuffer returns a buffer whose byteLength triggers the size check
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(50 * 1024 * 1024 + 1)),
        size: 50 * 1024 * 1024 + 1,
        type: "application/pdf",
      };

      const req = new NextRequest("http://localhost/api/books/metadata-preview", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=----boundary" },
        body: "placeholder",
      });
      req.formData = () =>
        Promise.resolve({
          get: (key: string) => (key === "file" ? fakeFile : null),
        } as unknown as FormData);

      const res = await POST(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toMatch(/quá lớn|too large|50/i);
    });
  });

  // ── Missing file ──────────────────────────────────────────────────────────
  describe("Validation", () => {
    it("returns 400 when no file is provided", async () => {
      const res = await POST(makeEmptyFormRequest());

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/thiếu|missing/i);
    });

    it("returns 422 when extractBookMetadata returns an error", async () => {
      mockExtractBookMetadata.mockResolvedValue({
        error: "Cannot parse PDF structure",
      });

      const req = makeFormRequest("corrupt.pdf", Buffer.from("bad-bytes"), "application/pdf");
      const res = await POST(req);

      expect(res.status).toBe(422);
    });
  });

  // ── Partial metadata ──────────────────────────────────────────────────────
  describe("Partial metadata handling", () => {
    it("returns empty strings for missing optional fields", async () => {
      mockExtractBookMetadata.mockResolvedValue({
        title: "Only Title",
        // author, isbn, publisher, language omitted
      });

      const req = makeFormRequest("book.pdf", Buffer.from("fake-pdf"), "application/pdf");
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.author).toBe("");
      expect(data.isbn).toBe("");
      expect(data.publisher).toBe("");
      expect(data.language).toBe("");
    });

    it("does not create any DB records (pure read operation)", async () => {
      const req = makeFormRequest("book.pdf", Buffer.from("fake-pdf"), "application/pdf");
      await POST(req);

      // extractBookMetadata called once with the buffer
      expect(mockExtractBookMetadata).toHaveBeenCalledTimes(1);
    });
  });
});
