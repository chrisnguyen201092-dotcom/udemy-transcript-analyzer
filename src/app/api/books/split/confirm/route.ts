/**
 * POST /api/books/split/confirm
 * Confirm chapter split: create Lesson records for each approved chapter.
 *
 * Covers: B-19 (confirm flow)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ChapterSchema = z.object({
  index: z.number(),
  title: z.string().min(1),
  content: z.string(),
  chapterNumber: z.number(),
  pageRange: z.string().optional(),
});

const ConfirmRequestSchema = z.object({
  bookId: z.string().min(1, "bookId là bắt buộc"),
  chapters: z.array(ChapterSchema).min(1, "Danh sách chương không được rỗng"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ConfirmRequestSchema.parse(body);

    // Verify book exists
    const book = await prisma.course.findUnique({
      where: { id: parsed.bookId },
      select: { id: true, contentType: true },
    });
    if (!book) {
      return NextResponse.json({ error: "Sách không tồn tại" }, { status: 404 });
    }
    // H-19: Ensure only book-type courses can be confirmed
    if (book.contentType !== "book") {
      return NextResponse.json({ error: "Not a book course" }, { status: 400 });
    }

    // H-7: Move existingCount check INSIDE interactive transaction so the
    // check and lesson creation are atomic — prevents duplicate chapters
    // if two confirm requests race for the same bookId.
    const lessons = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.lesson.count({
        where: { courseId: parsed.bookId },
      });
      if (existingCount > 0) {
        throw Object.assign(new Error("Sách đã có bài học. Xóa bài học hiện tại trước khi chia lại chương."), { status: 409 });
      }

      // Create Lesson records within the same transaction
      return Promise.all(
        parsed.chapters.map((ch, i) =>
          tx.lesson.create({
            data: {
              courseId: parsed.bookId,
              title: ch.title,
              order: i + 1,
              transcript: ch.content || null,
              chapterNumber: ch.chapterNumber,
              ...(ch.pageRange ? { pageRange: ch.pageRange } : {}),
            },
          })
        )
      );
    });

    const created = lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      order: lesson.order,
      chapterNumber: lesson.chapterNumber ?? 0,
    }));

    return NextResponse.json({ created, courseId: parsed.bookId });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    // Re-surface 409 thrown from within the transaction
    if (error?.status === 409) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Split confirm error:", error);
    return NextResponse.json(
      { error: "Lỗi server khi tạo bài học" },
      { status: 500 }
    );
  }
}
