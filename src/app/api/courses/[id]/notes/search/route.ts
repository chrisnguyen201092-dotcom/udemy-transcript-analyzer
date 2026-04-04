import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id ?? "";

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json(
        { error: "q query parameter is required" },
        { status: 400 }
      );
    }

    const course = await prisma.course.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Query LessonArtifact (per-user notes) instead of legacy Lesson.notes
    const artifacts = await prisma.lessonArtifact.findMany({
      where: {
        userId,
        type: "notes",
        content: { contains: q },
        lesson: { courseId: id },
      },
      include: {
        lesson: {
          select: { id: true, title: true, order: true },
        },
      },
      orderBy: { lesson: { order: "asc" } },
    });

    const results = artifacts.map((a) => {
      const notes = a.content;
      const idx = notes.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, idx - 50);
      const end = Math.min(notes.length, idx + q.length + 50);
      const snippet =
        (start > 0 ? "..." : "") +
        notes.slice(start, end) +
        (end < notes.length ? "..." : "");

      return {
        lessonId: a.lesson.id,
        lessonTitle: a.lesson.title,
        lessonOrder: a.lesson.order,
        snippet,
        updatedAt: a.updatedAt.toISOString(),
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
});
