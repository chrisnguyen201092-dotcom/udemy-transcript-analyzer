/**
 * POST /api/books/split/confirm
 * Confirm chapter split: create Lesson records for each approved chapter.
 * Covers: B-19 (confirm flow)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

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

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json();
    const parsed = ConfirmRequestSchema.parse(body);

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

    // H-7: Atomic check + create in transaction
    const lessons = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.lesson.count({
        where: { courseId: parsed.bookId },
      });
      if (existingCount > 0) {
        throw Object.assign(
          new Error("Sách đã có bài học. Xóa bài học hiện tại trước khi chia lại chương."),
          { status: 409 }
        );
      }

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
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    if (
      error instanceof Error &&
      (error as Error & { status?: number }).status === 409
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Split confirm error:", error);
    return NextResponse.json({ error: "Lỗi server khi tạo bài học" }, { status: 500 });
  }
});
