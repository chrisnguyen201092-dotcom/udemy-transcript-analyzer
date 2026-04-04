import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

/**
 * GET /api/analytics/overview
 * Returns aggregated learning analytics for the authenticated user.
 * Accepts optional `tzOffset` query param (minutes) for timezone-aware date bucketing.
 */
export const GET = withAuth(async (req, { userId }) => {
  try {
    const tzOffsetParam = new URL(req.url).searchParams.get("tzOffset");
    const tzOffset = tzOffsetParam ? parseInt(tzOffsetParam, 10) : 0;

    const totalCourses = await prisma.course.count({ where: { userId } });

    const totalLessonsCompleted = await prisma.lessonProgress.count({
      where: { userId, completed: true },
    });

    const timeAgg = await prisma.lessonProgress.aggregate({
      where: { userId },
      _sum: { timeSpentMs: true },
    });
    const totalTimeSeconds = Math.round(
      (timeAgg._sum.timeSpentMs ?? 0) / 1000
    );

    const quizAgg = await prisma.lessonProgress.aggregate({
      where: { userId, quizScore: { not: null } },
      _avg: { quizScore: true },
    });
    const averageQuizScore =
      quizAgg._avg.quizScore !== null
        ? Math.round(quizAgg._avg.quizScore * 100) / 100
        : null;

    const totalReviews = await prisma.flashcardReview.count({ where: { userId } });
    let overallRetentionRate: number | null = null;
    if (totalReviews > 0) {
      const masteredReviews = await prisma.flashcardReview.count({
        where: { userId, interval: { gt: 7 } },
      });
      overallRetentionRate =
        Math.round((masteredReviews / totalReviews) * 10000) / 100;
    }

    const since365 = new Date();
    since365.setDate(since365.getDate() - 364);

    const completedDates = await prisma.lessonProgress.findMany({
      where: {
        userId,
        completed: true,
        completedAt: { not: null, gte: since365 },
      },
      select: { completedAt: true },
    });

    const dateCountMap = new Map<string, number>();
    for (const r of completedDates) {
      if (r.completedAt) {
        const d = toDateString(r.completedAt, tzOffset);
        dateCountMap.set(d, (dateCountMap.get(d) ?? 0) + 1);
      }
    }

    const uniqueDateSet = new Set(dateCountMap.keys());
    const { currentStreak, longestStreak } = calculateStreaks(uniqueDateSet, tzOffset);
    const studyFrequency = buildStudyFrequency(dateCountMap, tzOffset);

    return NextResponse.json({
      totalCourses,
      totalLessonsCompleted,
      totalTimeSeconds,
      averageQuizScore,
      overallRetentionRate,
      currentStreak,
      longestStreak,
      studyFrequency,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Analytics overview error:", error);
    return NextResponse.json(
      { error: "Failed to get analytics overview" },
      { status: 500 }
    );
  }
});

function calculateStreaks(
  dateSet: Set<string>,
  tzOffset: number
): { currentStreak: number; longestStreak: number } {
  if (dateSet.size === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const sortedDates = Array.from(dateSet).sort();

  let longestStreak = 1;
  let currentRun = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 1) {
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 1;
    }
  }

  const todayStr = toDateString(new Date(), tzOffset);
  const lastDate = sortedDates[sortedDates.length - 1];
  const lastDateObj = new Date(lastDate);
  const todayObj = new Date(todayStr);
  const daysSinceLast = Math.round(
    (todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLast > 1) {
    return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 1;
  for (let i = sortedDates.length - 2; i >= 0; i--) {
    const curr = new Date(sortedDates[i + 1]);
    const prev = new Date(sortedDates[i]);
    const diff = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}

function buildStudyFrequency(
  countMap: Map<string, number>,
  tzOffset: number
): { date: string; lessonsCompleted: number }[] {
  const result: { date: string; lessonsCompleted: number }[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toDateString(d, tzOffset);
    result.push({
      date: dateStr,
      lessonsCompleted: countMap.get(dateStr) ?? 0,
    });
  }
  return result;
}

function toDateString(date: Date, tzOffset: number = 0): string {
  const adjusted = new Date(date.getTime() - tzOffset * 60000);
  return adjusted.toISOString().split("T")[0];
}
