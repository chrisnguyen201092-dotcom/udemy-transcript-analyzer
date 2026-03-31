/**
 * POST /api/books/split
 * Parse a book file (PDF, DOCX, TXT, MD), detect chapter boundaries using
 * heuristic detection (with optional AI fallback), and return a preview
 * for user confirmation.
 *
 * The file content must be:
 *   - base64-encoded for binary formats (.pdf, .docx)
 *   - plain text for text formats (.txt, .md)
 *
 * Covers: B-17 (heuristic), B-18 (AI fallback)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePdf, parseDocx, parseMarkdownChapters } from "@/lib/parse-book";
import { detectChapters } from "@/lib/split-chapters";
import type { DetectedChapter } from "@/lib/split-chapters";
import { detectChaptersWithAI } from "@/lib/split-ai";
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
  // AI config — required when splitConfig.useAI is true
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).optional(),
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
        { error: `Định dạng '${parsed.format}' không hỗ trợ. Chấp nhận: pdf, docx, txt, md` },
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

    // ── Persist raw text for future re-splitting ─────────────────────────
    await prisma.course.update({
      where: { id: parsed.bookId },
      data: { rawContent: textContent },
    });

    // ── Run heuristic chapter detection ──────────────────────────────────
    const detection = detectChapters(textContent);
    const useAI = parsed.splitConfig?.useAI ?? false;
    const aiThreshold = 0.5; // fallback to AI when avgConfidence < this

    let method = detection.method;
    let finalChapters = detection.chapters;
    let avgConfidence = detection.avgConfidence;
    let patternFamily: string = detection.patternFamily;
    let tokensUsed = 0;

    // ── AI fallback when heuristic is weak ──────────────────────────────
    const shouldFallbackToAI =
      useAI &&
      (method === "fallback" || avgConfidence < aiThreshold);

    if (shouldFallbackToAI) {
      if (!parsed.apiKey || !parsed.baseUrl || !parsed.model) {
        warnings.push(
          "AI được yêu cầu nhưng thiếu cấu hình (apiKey/baseUrl/model). Dùng kết quả heuristic."
        );
      } else {
        try {
          const aiResult = await detectChaptersWithAI(textContent, {
            apiKey: parsed.apiKey,
            baseUrl: parsed.baseUrl,
            model: parsed.model,
          });
          tokensUsed = aiResult.tokensUsed;

          if (aiResult.chapters.length >= 2 && aiResult.confidence > avgConfidence) {
            // AI found better chapters — build DetectedChapter-like objects
            const lines = textContent.split("\n");
            finalChapters = aiResult.chapters.map((ch, idx) => {
              const endLine =
                idx + 1 < aiResult.chapters.length
                  ? aiResult.chapters[idx + 1].startLine
                  : lines.length;
              const content = lines.slice(ch.startLine + 1, endLine).join("\n").trim();
              const wordCount = content.trim().length === 0
                ? 0
                : content.trim().split(/\s+/).length;
              return {
                title: ch.title,
                content,
                chapterNumber: idx + 1,
                wordCount,
                short: wordCount < 200,
                confidence: aiResult.confidence,
                patternType: "fallback" as const,
              };
            });
            method = "heuristic"; // upgraded from fallback
            avgConfidence = aiResult.confidence;
            patternFamily = "ai";
            warnings.push(
              `AI đã phát hiện ${aiResult.chapters.length} chương (confidence: ${Math.round(aiResult.confidence * 100)}%).`
            );
          } else {
            warnings.push(
              "AI không tìm thấy cấu trúc tốt hơn. Dùng kết quả heuristic."
            );
          }
        } catch (aiError) {
          const reason = aiError instanceof Error ? aiError.message : String(aiError);
          warnings.push(`AI fallback thất bại: ${reason}. Dùng kết quả heuristic.`);
        }
      }
    }

    if (method === "fallback") {
      warnings.push(
        "Không tìm thấy cấu trúc chương rõ ràng. Toàn bộ nội dung được gom thành 1 phần."
      );
    }

    // Confidence-based warnings
    if (avgConfidence > 0 && avgConfidence < 0.5) {
      warnings.push(
        useAI
          ? "Độ tin cậy thấp ngay cả sau khi dùng AI."
          : "Độ tin cậy thấp. Cân nhắc dùng AI phân tích."
      );
    }

    // Flag low-confidence individual chapters
    for (const ch of finalChapters) {
      if (ch.confidence > 0 && ch.confidence < 0.3) {
        warnings.push(
          `Chương "${ch.title}" có độ tin cậy thấp (${Math.round(ch.confidence * 100)}%).`
        );
      }
    }

    // Flag short chapters
    for (const ch of finalChapters) {
      if (ch.short) {
        warnings.push(
          `Chương "${ch.title}" ngắn (${ch.wordCount} từ). Cân nhắc gộp với chương liền kề.`
        );
      }
    }

    // Map to response format
    const chapters = finalChapters.map((ch) => ({
      index: ch.chapterNumber,
      title: ch.title,
      wordCount: ch.wordCount,
      content: ch.content,
      confidence: ch.confidence,
    }));

    return NextResponse.json({
      method,
      chapters,
      warnings,
      avgConfidence,
      patternFamily,
      ...(tokensUsed > 0 && { tokensUsed }),
    });
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
