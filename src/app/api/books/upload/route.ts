/**
 * POST /api/books/upload
 * Upload a book file (PDF, DOCX, TXT, MD) and create a course with lessons.
 * Accepts JSON body with base64-encoded file content (matching courses/upload pattern).
 *
 * Covers: B-04, B-06, B-07, B-08
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { parsePdf, parseDocx, parseMarkdownChapters } from "@/lib/parse-book";
import { MAX_BOOK_CONTENT_LENGTH, SUPPORTED_BOOK_EXTENSIONS } from "@/lib/book-constants";
import { z } from "zod";

const SUPPORTED_EXTENSIONS = SUPPORTED_BOOK_EXTENSIONS;
const MAX_CONTENT_LENGTH = MAX_BOOK_CONTENT_LENGTH;

const BookUploadSchema = z.object({
  title: z.string().min(1, "Tên sách (title) là bắt buộc"),
  courseId: z.string().min(1).optional(),
  author: z.string().optional(),
  isbn: z.string().optional(),
  publisher: z.string().optional(),
  file: z.object({
    name: z.string().min(1),
    content: z.string().min(1, "File content là bắt buộc"),
    type: z.string(),
  }),
});

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function removeExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(0, dot) : filename;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BookUploadSchema.parse(body);

    // ── File size check ──────────────────────────────────────────────────
    if (parsed.file.content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `File quá lớn. Giới hạn ${MAX_CONTENT_LENGTH / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    const ext = getExtension(parsed.file.name);
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Định dạng file '${ext}' không hỗ trợ. Chấp nhận: .pdf, .docx, .txt, .md` },
        { status: 400 }
      );
    }

    // ── Resolve or create course ───────────────────────────────────────
    let resolvedCourseId: string;
    // M-1: track whether we created a new course to enable orphan cleanup on failure
    let isNewCourse = false;

    if (parsed.courseId) {
      const course = await prisma.course.findUnique({ where: { id: parsed.courseId } });
      if (!course) {
        return NextResponse.json({ error: "Course không tồn tại" }, { status: 404 });
      }
      resolvedCourseId = parsed.courseId;
    } else {
      const newCourse = await prisma.course.create({
        data: {
          title: parsed.title.trim(),
          contentType: "book",
          url: `book:${randomUUID()}`,
          ...(parsed.author ? { author: parsed.author.trim() } : {}),
          ...(parsed.isbn ? { isbn: parsed.isbn.trim() } : {}),
          ...(parsed.publisher ? { publisher: parsed.publisher.trim() } : {}),
        },
      });
      resolvedCourseId = newCourse.id;
      isNewCourse = true;
    }

    // ── Parse file content ─────────────────────────────────────────────
    const warnings: Array<{ type: string; message: string }> = [];
    const chapters: Array<{ title: string; transcript: string }> = [];

    // For binary formats (PDF, DOCX), decode from base64
    // For text formats (TXT, MD), use content directly
    try {
      switch (ext) {
        case ".pdf": {
          const buffer = Buffer.from(parsed.file.content, "base64");
          const pdfResult = await parsePdf(buffer);
          if (pdfResult.warning === "scanned_pdf") {
            warnings.push({
              type: "scanned_pdf",
              message: "PDF này có thể là ảnh scan, không extract được text. Bạn có thể nhập transcript thủ công.",
            });
          }
          chapters.push({
            title: removeExtension(parsed.file.name),
            transcript: pdfResult.text,
          });
          break;
        }

        case ".docx": {
          const buffer = Buffer.from(parsed.file.content, "base64");
          const docxResult = await parseDocx(buffer);
          chapters.push({
            title: removeExtension(parsed.file.name),
            transcript: docxResult.text,
          });
          break;
        }

        case ".txt": {
          const text = parsed.file.content.trim();
          chapters.push({
            title: removeExtension(parsed.file.name),
            transcript: text,
          });
          break;
        }

        case ".md": {
          const mdText = parsed.file.content;
          const mdChapters = parseMarkdownChapters(mdText);
          if (mdChapters.length > 0) {
            for (const ch of mdChapters) {
              chapters.push({ title: ch.title, transcript: ch.content });
            }
          } else {
            // No headings — treat as plain text
            chapters.push({
              title: removeExtension(parsed.file.name),
              transcript: mdText.trim(),
            });
          }
          break;
        }
      }
    } catch (parseError) {
      // File is corrupt or unparseable
      // M-1: cleanup orphan course created in this request (has 0 lessons, safe to delete)
      if (isNewCourse) {
        await prisma.course.delete({ where: { id: resolvedCourseId } }).catch(() => {});
      }
      const reason = parseError instanceof Error ? parseError.message : String(parseError);
      return NextResponse.json(
        { error: `Không thể đọc file: ${reason}` },
        { status: 400 }
      );
    }

    // ── Create lessons atomically ──────────────────────────────────────
    const created: Array<{ id: string; title: string; order: number }> = [];

    await prisma.$transaction(async (tx) => {
      // H-6: Count existing lessons INSIDE transaction to prevent duplicate
      // order values when concurrent uploads race against the same courseId.
      const existingCount = await tx.lesson.count({
        where: { courseId: resolvedCourseId },
      });
      for (let i = 0; i < chapters.length; i++) {
        const order = existingCount + i + 1;
        const lesson = await tx.lesson.create({
          data: {
            courseId: resolvedCourseId,
            title: chapters[i].title,
            order,
            transcript: chapters[i].transcript || null,
          },
        });
        created.push({ id: lesson.id, title: lesson.title, order: lesson.order });
      }
    });

    return NextResponse.json({ courseId: resolvedCourseId, created, warnings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Book upload error:", error);
    return NextResponse.json(
      { error: "Lỗi server khi upload sách" },
      { status: 500 }
    );
  }
}
