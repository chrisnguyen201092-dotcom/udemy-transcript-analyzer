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
      include: { lessons: { select: { id: true } } },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Find or create CourseProgress
    let courseProgress = await prisma.courseProgress.findFirst({
      where: { courseId: id },
    });

    if (!courseProgress) {
      courseProgress = await prisma.courseProgress.upsert({
        where: { courseId: id },
        create: {
          courseId: id,
          completionPct: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastStudiedAt: null,
          totalTimeSpentMs: 0,
        },
        update: {},
      });
    }

    // Find all LessonProgress for the course's lessons
    const lessonIds = course.lessons.map((l) => l.id);
    const lessonsProgress = await prisma.lessonProgress.findMany({
      where: { lessonId: { in: lessonIds } },
      select: {
        lessonId: true,
        completed: true,
        completedAt: true,
        quizScore: true,
        timeSpentMs: true,
        flashcardsMastered: true,
        flashcardsTotal: true,
      },
    });

    return NextResponse.json({
      courseProgress: {
        id: courseProgress.id,
        courseId: courseProgress.courseId,
        completionPct: courseProgress.completionPct,
        currentStreak: courseProgress.currentStreak,
        longestStreak: courseProgress.longestStreak,
        lastStudiedAt: courseProgress.lastStudiedAt,
        totalTimeSpentMs: courseProgress.totalTimeSpentMs,
      },
      lessonsProgress,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to get course progress" },
      { status: 500 }
    );
  }
}
