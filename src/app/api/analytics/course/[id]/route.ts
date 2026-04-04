import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

interface LessonProgressRecord {
  lessonId: string;
  completed: boolean;
  completedAt: Date | null;
  timeSpentMs: number;
  quizScore: number | null;
}

interface LessonReviewStats {
  lessonId: string;
  flashcardsMastered: number;
  flashcardsTotal: number;
}

/**
 * GET /api/analytics/course/[id]
 * Returns detailed analytics for a single course scoped to the authenticated user.
 */
export const GET = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id ?? "";

    const course = await prisma.course.findFirst({
      where: { id, userId },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, order: true },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const lessonIds = course.lessons.map((l: { id: string }) => l.id);
    const totalLessons = lessonIds.length;
    const now = new Date();

    const [
      completedCount,
      timeAgg,
      quizAgg,
      totalReviews,
      masteredCardCount,
      dueCardCount,
      efAgg,
    ] = await Promise.all([
      prisma.lessonProgress.count({
        where: { userId, lessonId: { in: lessonIds }, completed: true },
      }),
      prisma.lessonProgress.aggregate({
        where: { userId, lessonId: { in: lessonIds } },
        _sum: { timeSpentMs: true },
      }),
      prisma.lessonProgress.aggregate({
        where: { userId, lessonId: { in: lessonIds }, quizScore: { not: null } },
        _avg: { quizScore: true },
        _count: { quizScore: true },
      }),
      prisma.flashcardReview.count({
        where: { userId, lessonId: { in: lessonIds } },
      }),
      prisma.flashcardReview.count({
        where: { userId, lessonId: { in: lessonIds }, interval: { gt: 7 } },
      }),
      prisma.flashcardReview.count({
        where: { userId, lessonId: { in: lessonIds }, nextReviewAt: { lte: now } },
      }),
      prisma.flashcardReview.aggregate({
        where: { userId, lessonId: { in: lessonIds } },
        _avg: { easinessFactor: true },
      }),
    ]);

    const totalTimeSeconds = Math.round((timeAgg._sum.timeSpentMs ?? 0) / 1000);
    const completionRate =
      totalLessons > 0
        ? Math.round((completedCount / totalLessons) * 10000) / 100
        : 0;
    const averageQuizScore =
      quizAgg._avg.quizScore !== null
        ? Math.round(quizAgg._avg.quizScore * 100) / 100
        : null;
    const retentionRate =
      totalReviews > 0
        ? Math.round((masteredCardCount / totalReviews) * 10000) / 100
        : null;
    const averageEaseFactor =
      totalReviews > 0 && efAgg._avg.easinessFactor !== null
        ? Math.round(efAgg._avg.easinessFactor * 100) / 100
        : null;

    const lessonProgressRecords: LessonProgressRecord[] =
      await prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: {
          lessonId: true,
          completed: true,
          completedAt: true,
          timeSpentMs: true,
          quizScore: true,
        },
      });
    const progressMap = new Map<string, LessonProgressRecord>(
      lessonProgressRecords.map((lp) => [lp.lessonId, lp])
    );

    const masteredByLesson = await prisma.flashcardReview.groupBy({
      by: ["lessonId"],
      where: { userId, lessonId: { in: lessonIds }, interval: { gt: 7 } },
      _count: { _all: true },
    });
    const totalByLesson = await prisma.flashcardReview.groupBy({
      by: ["lessonId"],
      where: { userId, lessonId: { in: lessonIds } },
      _count: { _all: true },
    });

    const masteredMap = new Map<string, number>(
      masteredByLesson.map((r) => [r.lessonId, r._count._all])
    );
    const totalMap = new Map<string, number>(
      totalByLesson.map((r) => [r.lessonId, r._count._all])
    );

    const quizScores: number[] = [];
    const lessons: LessonReviewStats[] = [];

    const lessonDetails = course.lessons.map((lesson) => {
      const progress = progressMap.get(lesson.id);
      const quizScore = progress?.quizScore ?? null;
      if (quizScore !== null) quizScores.push(quizScore);

      const flashcardsMastered = masteredMap.get(lesson.id) ?? 0;
      const flashcardsTotal = totalMap.get(lesson.id) ?? 0;
      lessons.push({ lessonId: lesson.id, flashcardsMastered, flashcardsTotal });

      return {
        lessonId: lesson.id,
        title: lesson.title,
        completed: progress?.completed ?? false,
        timeSeconds: Math.round((progress?.timeSpentMs ?? 0) / 1000),
        quizScore,
        flashcardsMastered,
        flashcardsTotal,
        completedAt:
          progress?.completed && progress.completedAt
            ? progress.completedAt.toISOString()
            : null,
      };
    });

    const quizScoreDistribution = [
      { bin: "0-20", count: 0 },
      { bin: "21-40", count: 0 },
      { bin: "41-60", count: 0 },
      { bin: "61-80", count: 0 },
      { bin: "81-100", count: 0 },
    ];
    for (const score of quizScores) {
      if (score <= 20) quizScoreDistribution[0].count++;
      else if (score <= 40) quizScoreDistribution[1].count++;
      else if (score <= 60) quizScoreDistribution[2].count++;
      else if (score <= 80) quizScoreDistribution[3].count++;
      else quizScoreDistribution[4].count++;
    }

    return NextResponse.json({
      courseId: course.id,
      courseName: course.title,
      completionRate,
      totalTimeSeconds,
      averageQuizScore,
      lessons: lessonDetails,
      quizScoreDistribution,
      retentionRate,
      masteredCardCount,
      dueCardCount,
      averageEaseFactor,
    });
  } catch (error) {
    console.error("Course analytics error:", error);
    return NextResponse.json(
      { error: "Failed to get course analytics" },
      { status: 500 }
    );
  }
});
