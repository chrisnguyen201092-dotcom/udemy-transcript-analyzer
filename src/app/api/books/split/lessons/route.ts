/**
 * DELETE /api/books/split/lessons
 * Bulk-delete all lessons for a book course (verify-before-delete pattern).
 * Covers: B-20 (re-split recovery — bulk delete)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

const DeleteRequestSchema = z.object({
  bookId: z.string().min(1, "bookId là bắt buộc"),
});

interface DeletionPreview {
  bookId: string;
  bookTitle: string;
  lessonCount: number;
  relatedCounts: {
    progress: number;
    flashcardReviews: number;
    chatMessages: number;
  };
}

async function buildPreview(bookId: string, userId: string): Promise<DeletionPreview | null> {
  const book = await prisma.course.findFirst({
    where: { id: bookId, userId },
    select: { id: true, title: true },
  });
  if (!book) return null;

  const [lessonCount, progress, flashcardReviews, chatMessages] = await Promise.all([
    prisma.lesson.count({ where: { courseId: bookId } }),
    prisma.lessonProgress.count({ where: { lesson: { courseId: bookId } } }),
    prisma.flashcardReview.count({ where: { lesson: { courseId: bookId } } }),
    prisma.chatMessage.count({ where: { lesson: { courseId: bookId } } }),
  ]);

  return {
    bookId: book.id,
    bookTitle: book.title ?? "Untitled",
    lessonCount,
    relatedCounts: { progress, flashcardReviews, chatMessages },
  };
}

export const DELETE = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json();
    const parsed = DeleteRequestSchema.parse(body);
    const { bookId } = parsed;

    const isPreview = req.nextUrl.searchParams.get("preview") === "true";

    const preview = await buildPreview(bookId, userId);
    if (!preview) {
      return NextResponse.json({ error: "Sách không tồn tại" }, { status: 404 });
    }

    if (preview.lessonCount === 0) {
      return NextResponse.json({ error: "Sách chưa có bài học để xóa" }, { status: 404 });
    }

    if (isPreview) {
      return NextResponse.json({ preview });
    }

    const { count } = await prisma.lesson.deleteMany({
      where: { courseId: bookId },
    });

    return NextResponse.json({
      deleted: {
        bookId,
        lessonCount: count,
        relatedCounts: preview.relatedCounts,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: "Lỗi server khi xóa bài học" }, { status: 500 });
  }
});
