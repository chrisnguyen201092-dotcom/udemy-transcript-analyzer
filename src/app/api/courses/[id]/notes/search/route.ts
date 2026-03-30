import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json(
        { error: "q query parameter is required" },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    const lessons = await prisma.lesson.findMany({
      where: {
        courseId: id,
        notes: { contains: q },
      },
      select: {
        id: true,
        title: true,
        order: true,
        notes: true,
        updatedAt: true,
      },
      orderBy: { order: "asc" },
    });

    const results = lessons.map((l) => {
      const notes = l.notes!;
      const idx = notes.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, idx - 50);
      const end = Math.min(notes.length, idx + q.length + 50);
      const snippet =
        (start > 0 ? "..." : "") +
        notes.slice(start, end) +
        (end < notes.length ? "..." : "");

      return {
        lessonId: l.id,
        lessonTitle: l.title,
        lessonOrder: l.order,
        snippet,
        updatedAt: l.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ query: q, results });
  } catch (error) {
    console.error("Failed to search notes:", error);
    return NextResponse.json(
      { error: "Failed to search notes" },
      { status: 500 }
    );
  }
}
