import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/analytics/overview
 *
 * Returns aggregated learning analytics across all courses.
 * M-28: Accepts optional `tzOffset` query param (minutes) for timezone-aware date bucketing.
 */
export async function GET(req: NextRequest) {
  try {
    // M-28: Get timezone offset from client (minutes from UTC, e.g. -420 for UTC+7)
    const tzOffsetParam = new URL(req.url).searchParams.get("tzOffset");
    const tzOffset = tzOffsetParam ? parseInt(tzOffsetParam, 10) : 0;

    // Total courses
    const totalCourses = await prisma.course.count();

    // Total lessons completed
    const totalLessonsCompleted = await prisma.lessonProgress.count({
      where: { completed: true },
    });

    // Total time (ms → seconds)
    const timeAgg = await prisma.lessonProgress.aggregate({
      _sum: { timeSpentMs: true },
    });
    const totalTimeSeconds = Math.round(
      (timeAgg._sum.timeSpentMs ?? 0) / 1000
    );

    // Average quiz score (null if no quiz data)
    const quizAgg = await prisma.lessonProgress.aggregate({
      _avg: { quizScore: true },
      where: { quizScore: { not: null } },
    });
    const averageQuizScore =
      quizAgg._avg.quizScore !== null
        ? Math.round(quizAgg._avg.quizScore * 100) / 100
        : null;

    // Overall retention rate: cards with interval > 7 / total cards * 100
    const totalReviews = await prisma.flashcardReview.count();
    let overallRetentionRate: number | null = null;
    if (totalReviews > 0) {
      const masteredReviews = await prisma.flashcardReview.count({
        where: { interval: { gt: 7 } },
      });
      overallRetentionRate =
        Math.round((masteredReviews / totalReviews) * 10000) / 100;
    }

    // M-27: Use aggregate query instead of findMany to avoid loading all records
    // Only fetch completedAt dates (not full records) — bounded by unique dates
    const completedDates = await prisma.lessonProgress.findMany({
      where: { completed: true, completedAt: { not: null } },
      select: { completedAt: true },
      distinct: undefined, // We need counts per date, so group manually
    });

    // M-27 + M-28: Build date→count map with timezone adjustment
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
    });
  } catch (error) {
    console.error("Analytics overview error:", error);
    return NextResponse.json(
      { error: "Failed to get analytics overview" },
      { status: 500 }
    );
  }
}

/**
 * Calculate current and longest streaks from a set of date strings.
 *
 * Current streak: consecutive days with ≥1 lesson completed,
 * counting backwards from today (or yesterday if today has no completions).
 *
 * Longest streak: maximum consecutive days in entire history.
 */
function calculateStreaks(
  dateSet: Set<string>,
  tzOffset: number
): { currentStreak: number; longestStreak: number } {
  if (dateSet.size === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Sort dates ascending
  const sortedDates = Array.from(dateSet).sort();

  // Calculate longest streak
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

  // Calculate current streak (counting backwards from today or yesterday)
  // M-28: Use timezone-adjusted "today"
  const todayStr = toDateString(new Date(), tzOffset);
  const lastDate = sortedDates[sortedDates.length - 1];

  // If last study day is not today or yesterday, current streak is 0
  const lastDateObj = new Date(lastDate);
  const todayObj = new Date(todayStr);
  const daysSinceLast = Math.round(
    (todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLast > 1) {
    return { currentStreak: 0, longestStreak };
  }

  // Count backwards from the last date
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

/**
 * Build 365-day study frequency array.
 * M-27: Accepts pre-computed date→count map instead of raw records.
 */
function buildStudyFrequency(
  countMap: Map<string, number>,
  tzOffset: number
): { date: string; lessonsCompleted: number }[] {
  // Generate last 365 days
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

/**
 * Convert a Date to YYYY-MM-DD string.
 * M-28: Adjusts by tzOffset minutes for user's local time instead of pure UTC.
 */
function toDateString(date: Date, tzOffset: number = 0): string {
  const adjusted = new Date(date.getTime() - tzOffset * 60000);
  return adjusted.toISOString().split("T")[0];
}
