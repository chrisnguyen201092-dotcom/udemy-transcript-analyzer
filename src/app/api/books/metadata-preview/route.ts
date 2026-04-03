/**
 * POST /api/books/metadata-preview
 *
 * Accepts a multipart form upload of a book file, extracts metadata
 * (title, author, isbn, publisher, language) WITHOUT creating any DB records.
 *
 * Covers: Phase 2 — Book Metadata Auto-Extraction
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { validateMagicBytes } from "@/lib/file-security";
import { extractBookMetadata } from "@/lib/extract-book-metadata";
import { SUPPORTED_BOOK_EXTENSIONS } from "@/lib/book-constants";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Thiếu file upload" }, { status: 400 });
    }

    const filename = file.name ?? "unknown";
    const ext = getExtension(filename);

    if (!SUPPORTED_BOOK_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Định dạng '${ext}' không hỗ trợ` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File quá lớn, tối đa 50MB" },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(arrayBuffer);

    // Magic-byte validation for binary formats
    if ([".pdf", ".epub", ".docx"].includes(ext)) {
      try {
        validateMagicBytes(buffer, ext);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const metadata = await extractBookMetadata(buffer, filename, ext);

    if (metadata.error) {
      return NextResponse.json({ error: metadata.error }, { status: 422 });
    }

    return NextResponse.json({
      title: metadata.title ?? "",
      author: metadata.author ?? "",
      isbn: metadata.isbn ?? "",
      publisher: metadata.publisher ?? "",
      language: metadata.language ?? "",
    });
  } catch (err) {
    console.error("metadata-preview error:", err);
    return NextResponse.json({ error: "Lỗi server khi đọc metadata" }, { status: 500 });
  }
});
