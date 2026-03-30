import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface LessonProgressRecord {
  lessonId: string;
  completed: boolean;
  completedAt: Date | null;
  timeSpentMs: number;
  quizScore: number | null;
  flashcardsMastered: number;
  flashcardsTotal: number;
}

interface FlashcardReviewRecord {
  id: string;
  lessonId: string;
  cardIndex: number;
  easinessFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
  lastQuality: number;
  totalReviews: number;
}

/**
 * GET /api/analytics/course/[id]
 *
 * Returns detailed analytics for a single course.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch course with lessons ordered by `order`
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            order: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const lessonIds = course.lessons.map((l: { id: string }) => l.id);

    // Fetch all lesson progress for this course
    const lessonProgressRecords: LessonProgressRecord[] =
      await prisma.lessonProgress.findMany({
        where: { lessonId: { in: lessonIds } },
      });
    const progressMap = new Map<string, LessonProgressRecord>(
      lessonProgressRecords.map((lp: LessonProgressRecord) => [lp.lessonId, lp])
    );

    // Fetch all flashcard reviews for this course's lessons
    const flashcardReviews: FlashcardReviewRecord[] =
      await prisma.flashcardReview.findMany({
        where: { lessonId: { in: lessonIds } },
      });

    // Group reviews by lesson
    const reviewsByLesson = new Map<string, FlashcardReviewRecord[]>();
    for (const review of flashcardReviews) {
      const existing = reviewsByLesson.get(review.lessonId) ?? [];
      existing.push(review);
      reviewsByLesson.set(review.lessonId, existing);
    }

    // Build lesson details
    const now = new Date();
    const totalLessons = course.lessons.length;
    let completedCount = 0;
    let totalTimeMs = 0;
    const quizScores: number[] = [];

    const lessons = course.lessons.map((lesson) => {
      const progress = progressMap.get(lesson.id);
      const reviews = reviewsByLesson.get(lesson.id) ?? [];

      const completed = progress?.completed ?? false;
      if (completed) completedCount++;

      const timeMs = progress?.timeSpentMs ?? 0;
      totalTimeMs += timeMs;

      const quizScore = progress?.quizScore ?? null;
      if (quizScore !== null) quizScores.push(quizScore);

      // Flashcard stats per lesson from reviews
      const flashcardsMastered = reviews.filter(
        (r: FlashcardReviewRecord) => r.interval > 7
      ).length;
      const flashcardsTotal = reviews.length;

      return {
        lessonId: lesson.id,
        title: lesson.title,
        completed,
        timeSeconds: Math.round(timeMs / 1000),
        quizScore,
        flashcardsMastered,
        flashcardsTotal,
        completedAt: completed && progress?.completedAt
          ? progress.completedAt.toISOString()
          : null,
      };
    });

    // Completion rate
    const completionRate =
      totalLessons > 0
        ? Math.round((completedCount / totalLessons) * 10000) / 100
        : 0;

    // Total time seconds
    const totalTimeSeconds = Math.round(totalTimeMs / 1000);

    // Average quiz score
    const averageQuizScore =
      quizScores.length > 0
        ? Math.round(
            (quizScores.reduce((a, b) => a + b, 0) / quizScores.length) * 100
          ) / 100
        : null;

    // Quiz score distribution (5 bins)
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

    // Flashcard metrics across all lessons
    const totalReviews = flashcardReviews.length;
    const masteredCardCount = flashcardReviews.filter(
      (r) => r.interval > 7
    ).length;
    const dueCardCount = flashcardReviews.filter(
      (r) => new Date(r.nextReviewAt) <= now
    ).length;

    // Retention rate
    const retentionRate =
      totalReviews > 0
        ? Math.round((masteredCardCount / totalReviews) * 10000) / 100
        : null;

    // Average ease factor
    let averageEaseFactor: number | null = null;
    if (totalReviews > 0) {
      const sumEF = flashcardReviews.reduce(
        (sum, r) => sum + r.easinessFactor,
        0
      );
      averageEaseFactor = Math.round((sumEF / totalReviews) * 100) / 100;
    }

    return NextResponse.json({
      courseId: course.id,
      courseName: course.title,
      completionRate,
      totalTimeSeconds,
      averageQuizScore,
      lessons,
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
}
