/**
 * POST /api/books/split
 * Parse a book file (PDF, DOCX, TXT, MD), detect chapter boundaries using
 * heuristic detection (with optional AI fallback), and return a preview
 * for user confirmation.
 *
 * Covers: B-17 (heuristic), B-18 (AI fallback)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePdf, parseDocx, parseMarkdownChapters } from "@/lib/parse-book";
import { parseEpub } from "@/lib/parse-epub";
import { validateMagicBytes } from "@/lib/file-security";
import { detectChapters } from "@/lib/split-chapters";
import type { DetectedChapter } from "@/lib/split-chapters";
import { detectChaptersWithAI } from "@/lib/split-ai";
import { MAX_BOOK_CONTENT_LENGTH, SUPPORTED_BOOK_EXTENSIONS } from "@/lib/book-constants";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

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
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).optional(),
});

function getExtension(format: string): string {
  return format.startsWith(".") ? format.toLowerCase() : `.${format.toLowerCase()}`;
}

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json();
    const parsed = SplitRequestSchema.parse(body);

    const ext = getExtension(parsed.format);

    if (parsed.content.length > MAX_BOOK_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `File quá lớn. Giới hạn ${MAX_BOOK_CONTENT_LENGTH / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    if (!SUPPORTED_BOOK_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Định dạng '${parsed.format}' không hỗ trợ. Chấp nhận: pdf, docx, txt, md` },
        { status: 400 }
      );
    }

    // Verify book exists and belongs to user
    const book = await prisma.course.findFirst({
      where: { id: parsed.bookId, userId },
      select: { id: true, contentType: true },
    });
    if (!book) {
      return NextResponse.json({ error: "Sách không tồn tại" }, { status: 404 });
    }
    if (book.contentType !== "book") {
      return NextResponse.json({ error: "Not a book course" }, { status: 400 });
    }

    const warnings: string[] = [];
    let textContent = "";

    try {
      switch (ext) {
        case ".pdf": {
          const buffer = Buffer.from(parsed.content, "base64");
          validateMagicBytes(buffer, ext);
          const pdfResult = await parsePdf(buffer);
          if (pdfResult.warning === "scanned_pdf") {
            warnings.push("PDF này có thể là ảnh scan, không extract được text đầy đủ.");
          } else if (pdfResult.warning === "ocr_used") {
            warnings.push("Đã dùng OCR để đọc PDF scan. Kết quả có thể không chính xác hoàn toàn.");
          }
          textContent = pdfResult.text;
          break;
        }
        case ".docx": {
          const buffer = Buffer.from(parsed.content, "base64");
          validateMagicBytes(buffer, ext);
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
        case ".epub": {
          const buffer = Buffer.from(parsed.content, "base64");
          validateMagicBytes(buffer, ext);
          const epubResult = await parseEpub(buffer);
          // Use EPUB chapter structure directly (higher confidence than heuristic)
          if (epubResult.chapters.length > 0) {
            const chapters = epubResult.chapters.map((ch, idx) => ({
              index: idx + 1,
              title: ch.title,
              wordCount: ch.content.trim() ? ch.content.trim().split(/\s+/).length : 0,
              content: ch.content,
              confidence: 0.9,
            }));
            return NextResponse.json({
              method: "epub_spine",
              chapters,
              warnings,
              avgConfidence: 0.9,
              patternFamily: "epub",
            });
          }
          // Fall through to heuristic if no chapters found
          textContent = epubResult.text;
          break;
        }
      }
    } catch (parseError) {
      const reason = parseError instanceof Error ? parseError.message : String(parseError);
      return NextResponse.json({ error: `Không thể đọc file: ${reason}` }, { status: 400 });
    }

    // Persist raw text for future re-splitting
    await prisma.course.update({
      where: { id: parsed.bookId },
      data: { rawContent: textContent },
    });

    const detection = detectChapters(textContent);
    const useAI = parsed.splitConfig?.useAI ?? false;
    const aiThreshold = 0.5;

    let method = detection.method;
    let finalChapters = detection.chapters;
    let avgConfidence = detection.avgConfidence;
    let patternFamily: string = detection.patternFamily;
    let tokensUsed = 0;

    const shouldFallbackToAI =
      useAI && (method === "fallback" || avgConfidence < aiThreshold);

    if (shouldFallbackToAI) {
      if (!parsed.apiKey || !parsed.baseUrl || !parsed.model) {
        warnings.push("AI được yêu cầu nhưng thiếu cấu hình (apiKey/baseUrl/model). Dùng kết quả heuristic.");
      } else {
        try {
          const aiResult = await detectChaptersWithAI(textContent, {
            apiKey: parsed.apiKey,
            baseUrl: parsed.baseUrl,
            model: parsed.model,
          });
          tokensUsed = aiResult.tokensUsed;

          if (aiResult.chapters.length >= 2 && aiResult.confidence > avgConfidence) {
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
            method = "heuristic";
            avgConfidence = aiResult.confidence;
            patternFamily = "ai";
            warnings.push(`AI đã phát hiện ${aiResult.chapters.length} chương (confidence: ${Math.round(aiResult.confidence * 100)}%).`);
          } else {
            warnings.push("AI không tìm thấy cấu trúc tốt hơn. Dùng kết quả heuristic.");
          }
        } catch (aiError) {
          const reason = aiError instanceof Error ? aiError.message : String(aiError);
          warnings.push(`AI fallback thất bại: ${reason}. Dùng kết quả heuristic.`);
        }
      }
    }

    if (method === "fallback") {
      warnings.push("Không tìm thấy cấu trúc chương rõ ràng. Toàn bộ nội dung được gom thành 1 phần.");
    }

    if (avgConfidence > 0 && avgConfidence < 0.5) {
      warnings.push(useAI ? "Độ tin cậy thấp ngay cả sau khi dùng AI." : "Độ tin cậy thấp. Cân nhắc dùng AI phân tích.");
    }

    for (const ch of finalChapters) {
      if (ch.confidence > 0 && ch.confidence < 0.3) {
        warnings.push(`Chương "${ch.title}" có độ tin cậy thấp (${Math.round(ch.confidence * 100)}%).`);
      }
    }

    for (const ch of finalChapters) {
      if (ch.short) {
        warnings.push(`Chương "${ch.title}" ngắn (${ch.wordCount} từ). Cân nhắc gộp với chương liền kề.`);
      }
    }

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
    return NextResponse.json({ error: "Lỗi server khi phân tích chương" }, { status: 500 });
  }
});
