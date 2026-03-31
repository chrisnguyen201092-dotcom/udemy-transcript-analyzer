/**
 * DELETE /api/books/split/lessons
 * Bulk-delete all lessons for a book course (verify-before-delete pattern).
 *
 * Flow:
 * 1. Validate bookId
 * 2. Count lessons + related records (progress, reviews, chats)
 * 3. Return preview if ?preview=true (dry run)
 * 4. Delete all lessons in a transaction (cascades handle related records)
 * 5. Return deletion summary
 *
 * Covers: B-20 (re-split recovery — bulk delete)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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

async function buildPreview(bookId: string): Promise<DeletionPreview | null> {
  const book = await prisma.course.findUnique({
    where: { id: bookId },
    select: { id: true, title: true },
  });
  if (!book) return null;

  const [lessonCount, progress, flashcardReviews, chatMessages] =
    await Promise.all([
      prisma.lesson.count({ where: { courseId: bookId } }),
      prisma.lessonProgress.count({
        where: { lesson: { courseId: bookId } },
      }),
      prisma.flashcardReview.count({
        where: { lesson: { courseId: bookId } },
      }),
      prisma.chatMessage.count({
        where: { lesson: { courseId: bookId } },
      }),
    ]);

  return {
    bookId: book.id,
    bookTitle: book.title ?? "Untitled",
    lessonCount,
    relatedCounts: { progress, flashcardReviews, chatMessages },
  };
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = DeleteRequestSchema.parse(body);
    const { bookId } = parsed;

    // Check preview mode (dry run)
    const isPreview =
      req.nextUrl.searchParams.get("preview") === "true";

    const preview = await buildPreview(bookId);
    if (!preview) {
      return NextResponse.json(
        { error: "Sách không tồn tại" },
        { status: 404 }
      );
    }

    if (preview.lessonCount === 0) {
      return NextResponse.json(
        { error: "Sách chưa có bài học để xóa" },
        { status: 404 }
      );
    }

    // Dry run: return what would be deleted
    if (isPreview) {
      return NextResponse.json({ preview });
    }

    // Delete all lessons (cascade handles progress, reviews, chats)
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
    return NextResponse.json(
      { error: "Lỗi server khi xóa bài học" },
      { status: 500 }
    );
  }
}
