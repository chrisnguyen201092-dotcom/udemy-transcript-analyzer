/**
 * POST /api/books/split
 * Analyze book content and detect chapter boundaries using heuristic detection.
 * Returns a preview of detected chapters for user confirmation.
 *
 * Covers: B-17 (heuristic), B-18 (fallback)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectChapters } from "@/lib/split-chapters";
import { z } from "zod";

const SUPPORTED_FORMATS = new Set(["pdf", "epub", "docx", "txt", "md"]);

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SplitRequestSchema.parse(body);

    // Validate format
    if (!SUPPORTED_FORMATS.has(parsed.format)) {
      return NextResponse.json(
        { error: `Định dạng '${parsed.format}' không hỗ trợ. Chấp nhận: pdf, epub, docx, txt, md` },
        { status: 400 }
      );
    }

    // Verify book exists
    const book = await prisma.course.findUnique({
      where: { id: parsed.bookId },
    });
    if (!book) {
      return NextResponse.json({ error: "Sách không tồn tại" }, { status: 404 });
    }

    // Run heuristic chapter detection
    const detected = detectChapters(parsed.content);

    // Determine method and build warnings
    const warnings: string[] = [];
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
