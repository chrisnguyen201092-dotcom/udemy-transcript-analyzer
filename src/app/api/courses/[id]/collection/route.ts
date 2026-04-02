import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id!;

    const course = await prisma.course.findFirst({
      where: { id, userId },
      select: {
        id: true,
        title: true,
        lessons: {
          select: { id: true, title: true, order: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Fetch notes and flashcards artifacts for all lessons in one query
    const lessonIds = course.lessons.map((l) => l.id);
    const artifacts = await prisma.lessonArtifact.findMany({
      where: { lessonId: { in: lessonIds }, userId, type: { in: ["notes", "flashcards"] } },
      select: { lessonId: true, type: true, content: true, updatedAt: true },
    });

    // Build lookup: lessonId → type → { content, updatedAt }
    type ArtifactEntry = { content: string; updatedAt: Date };
    const artifactMap = new Map<string, Map<string, ArtifactEntry>>();
    for (const a of artifacts) {
      if (!artifactMap.has(a.lessonId)) artifactMap.set(a.lessonId, new Map());
      artifactMap.get(a.lessonId)!.set(a.type, { content: a.content, updatedAt: a.updatedAt });
    }

    const notesItems = course.lessons
      .filter((l) => {
        const content = artifactMap.get(l.id)?.get("notes")?.content;
        return content && content.trim().length > 0;
      })
      .map((l) => {
        const entry = artifactMap.get(l.id)!.get("notes")!;
        return {
          lessonId: l.id,
          lessonTitle: l.title,
          lessonOrder: l.order,
          content: entry.content,
          updatedAt: entry.updatedAt.toISOString(),
        };
      });

    const flashcardItems = course.lessons
      .filter((l) => {
        const content = artifactMap.get(l.id)?.get("flashcards")?.content;
        return content && content.trim().length > 0;
      })
      .map((l) => {
        const entry = artifactMap.get(l.id)!.get("flashcards")!;
        return {
          lessonId: l.id,
          lessonTitle: l.title,
          lessonOrder: l.order,
          content: entry.content,
          updatedAt: entry.updatedAt.toISOString(),
        };
      });

    return NextResponse.json({
      courseId: course.id,
      courseTitle: course.title,
      notes: notesItems,
      flashcards: flashcardItems,
      stats: {
        totalNotes: notesItems.length,
        totalFlashcards: flashcardItems.length,
        totalLessons: course.lessons.length,
      },
    });
  } catch (error) {
    console.error("Failed to load collection:", error);
    return NextResponse.json(
      { error: "Failed to load collection" },
      { status: 500 }
    );
  }
});
