/**
 * POST /api/books
 * Create a book stub (Course record with contentType="book", no lessons).
 *
 * DELETE /api/books?id=... — clean up an uncommitted stub on cancel.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

const CreateBookSchema = z.object({
  title: z.string().min(1, "Tên sách là bắt buộc"),
  author: z.string().optional(),
  isbn: z.string().optional(),
  publisher: z.string().optional(),
});

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json();
    const parsed = CreateBookSchema.parse(body);

    const book = await prisma.course.create({
      data: {
        userId,
        title: parsed.title.trim(),
        contentType: "book",
        url: `book:${randomUUID()}`,
        ...(parsed.author ? { author: parsed.author.trim() } : {}),
        ...(parsed.isbn ? { isbn: parsed.isbn.trim() } : {}),
        ...(parsed.publisher ? { publisher: parsed.publisher.trim() } : {}),
      },
    });

    return NextResponse.json({ bookId: book.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Create book stub error:", error);
    return NextResponse.json({ error: "Lỗi server khi tạo sách" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { userId }) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id là bắt buộc" }, { status: 400 });
  }

  try {
    // M-10: Atomic deleteMany with ownership check
    const result = await prisma.course.deleteMany({
      where: {
        id,
        userId,
        contentType: "book",
        lessons: { none: {} },
      },
    });

    if (result.count === 0) {
      const course = await prisma.course.findFirst({
        where: { id, userId },
        select: { contentType: true, _count: { select: { lessons: true } } },
      });
      if (!course) {
        return NextResponse.json({ error: "Không tìm thấy sách" }, { status: 404 });
      }
      if (course.contentType !== "book") {
        return NextResponse.json({ error: "Chỉ có thể xóa bản ghi loại sách" }, { status: 403 });
      }
      if (course._count.lessons > 0) {
        return NextResponse.json({ error: "Không thể xóa sách đã có bài học" }, { status: 409 });
      }
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Delete book stub error:", error);
    return NextResponse.json({ error: "Lỗi server khi xóa sách" }, { status: 500 });
  }
});
