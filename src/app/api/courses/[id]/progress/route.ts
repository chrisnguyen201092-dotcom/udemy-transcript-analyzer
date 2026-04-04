import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id ?? "";

    const course = await prisma.course.findFirst({
      where: { id, userId },
      include: { lessons: { select: { id: true } } },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Find or create CourseProgress scoped to userId
    let courseProgress = await prisma.courseProgress.findFirst({
      where: { courseId: id, userId },
    });

    if (!courseProgress) {
      courseProgress = await prisma.courseProgress.create({
        data: {
          courseId: id,
          userId,
          completionPct: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastStudiedAt: null,
          totalTimeSpentMs: 0,
        },
      });
    }

    // Find all LessonProgress for the course's lessons scoped to userId
    const lessonIds = course.lessons.map((l) => l.id);
    const lessonsProgress = await prisma.lessonProgress.findMany({
      where: { lessonId: { in: lessonIds }, userId },
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
});
