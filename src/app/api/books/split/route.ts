/**
 * POST /api/books/split
 * Parse a book file (PDF, DOCX, TXT, MD), detect chapter boundaries using
 * heuristic detection, and return a preview for user confirmation.
 *
 * The file content must be:
 *   - base64-encoded for binary formats (.pdf, .docx)
 *   - plain text for text formats (.txt, .md)
 *
 * Covers: B-17 (heuristic), B-18 (fallback)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePdf, parseDocx, parseMarkdownChapters } from "@/lib/parse-book";
import { detectChapters } from "@/lib/split-chapters";
import { MAX_BOOK_CONTENT_LENGTH, SUPPORTED_BOOK_EXTENSIONS } from "@/lib/book-constants";
import { z } from "zod";

const SplitRequestSchema = z.object({
  bookId: z.string().min(1, "bookId là bắt buộc"),
  format: z.string().min(1),
  content: z.string().min(1, "content không được rỗng"),
  toc: z.string().nullable().optional(),
  pageHeaders: z.array(z.string()).nullable().optional(),
  splitConfig: z
    .object({
      useAI: z.boolean().optional().default(false),
      minChapterWords: z.number().optional().default(200),
    })
    .optional(),
});

function getExtension(format: string): string {
  return format.startsWith(".") ? format.toLowerCase() : `.${format.toLowerCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SplitRequestSchema.parse(body);

    const ext = getExtension(parsed.format);

    // ── File size check ──────────────────────────────────────────────────
    if (parsed.content.length > MAX_BOOK_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `File quá lớn. Giới hạn ${MAX_BOOK_CONTENT_LENGTH / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    // ── Validate format ──────────────────────────────────────────────────
    if (!SUPPORTED_BOOK_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Định dạng '${parsed.format}' không hỗ trợ. Chấp nhận: pdf, epub, docx, txt, md` },
        { status: 400 }
      );
    }

    // ── Verify book exists ───────────────────────────────────────────────
    const book = await prisma.course.findUnique({
      where: { id: parsed.bookId },
    });
    if (!book) {
      return NextResponse.json({ error: "Sách không tồn tại" }, { status: 404 });
    }

    // ── Parse file content into plain text ───────────────────────────────
    const warnings: string[] = [];
    let textContent = "";

    try {
      switch (ext) {
        case ".pdf": {
          const buffer = Buffer.from(parsed.content, "base64");
          const pdfResult = await parsePdf(buffer);
          if (pdfResult.warning === "scanned_pdf") {
            warnings.push(
              "PDF này có thể là ảnh scan, không extract được text đầy đủ. Nội dung chương có thể thiếu."
            );
          } else if (pdfResult.warning === "ocr_used") {
            warnings.push("Đã dùng OCR để đọc PDF scan. Kết quả có thể không chính xác hoàn toàn.");
          }
          textContent = pdfResult.text;
          break;
        }

        case ".docx": {
          const buffer = Buffer.from(parsed.content, "base64");
          const docxResult = await parseDocx(buffer);
          textContent = docxResult.text;
          break;
        }

        case ".txt": {
          textContent = parsed.content.trim();
          break;
        }

        case ".md": {
          textContent = parsed.content;
          break;
        }
      }
    } catch (parseError) {
      const reason = parseError instanceof Error ? parseError.message : String(parseError);
      return NextResponse.json(
        { error: `Không thể đọc file: ${reason}` },
        { status: 400 }
      );
    }

    // ── Run heuristic chapter detection ──────────────────────────────────
    const detected = detectChapters(textContent);

    // Determine method and accumulate warnings
    let method: "heuristic" | "fallback";

    if (detected.length >= 2) {
      method = "heuristic";
    } else {
      method = "fallback";
      warnings.push(
        "Không tìm thấy cấu trúc chương rõ ràng. Toàn bộ nội dung được gom thành 1 phần."
      );
    }

    // Flag short chapters
    for (const ch of detected) {
      if (ch.short) {
        warnings.push(
          `Chương "${ch.title}" ngắn (${ch.wordCount} từ). Cân nhắc gộp với chương liền kề.`
        );
      }
    }

    // Map to response format
    const chapters = detected.map((ch) => ({
      index: ch.chapterNumber,
      title: ch.title,
      wordCount: ch.wordCount,
      content: ch.content,
    }));

    return NextResponse.json({ method, chapters, warnings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Split error:", error);
    return NextResponse.json(
      { error: "Lỗi server khi phân tích chương" },
      { status: 500 }
    );
  }
}
