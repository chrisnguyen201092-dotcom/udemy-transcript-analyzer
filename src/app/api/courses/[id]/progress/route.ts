import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { computeCourseProgressMetrics } from "@/lib/progress-helpers";

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

    // Find or init CourseProgress (streak/time data still persisted)
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

    const lessonIds = course.lessons.map((l) => l.id);

    // Fetch all LessonProgress rows including new mastery fields
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
        masteryGatePassed: true,
        masteryScore: true,
      },
    });

    // Always compute percentages on-the-fly — never read stale cached DB value.
    // This guarantees accuracy even when lessons are added/removed after initial completion.
    const { completionPct, masteryPct, masteredCount } = computeCourseProgressMetrics(
      lessonIds.length,
      lessonsProgress.map((lp) => ({
        completed: lp.completed,
        masteryGatePassed: lp.masteryGatePassed,
        timeSpentMs: lp.timeSpentMs,
      }))
    );

    return NextResponse.json({
      courseProgress: {
        id: courseProgress.id,
        courseId: courseProgress.courseId,
        // Live-computed — accurate regardless of course modifications
        completionPct,
        masteryPct,
        masteredCount,
        totalLessons: lessonIds.length,
        // Persisted — updated by POST/PATCH progress routes
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
