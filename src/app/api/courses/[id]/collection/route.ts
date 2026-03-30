import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        lessons: {
          select: {
            id: true,
            title: true,
            order: true,
            notes: true,
            flashcards: true,
            updatedAt: true,
          },
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

    const notesItems = course.lessons
      .filter((l) => l.notes && l.notes.trim().length > 0)
      .map((l) => ({
        lessonId: l.id,
        lessonTitle: l.title,
        lessonOrder: l.order,
        content: l.notes!,
        updatedAt: l.updatedAt.toISOString(),
      }));

    const flashcardItems = course.lessons
      .filter((l) => l.flashcards && l.flashcards.trim().length > 0)
      .map((l) => ({
        lessonId: l.id,
        lessonTitle: l.title,
        lessonOrder: l.order,
        content: l.flashcards!,
        updatedAt: l.updatedAt.toISOString(),
      }));

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
}
