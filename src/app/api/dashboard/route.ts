/**
 * GET /api/dashboard — Aggregated dashboard data for authenticated user.
 * Returns: continue learning, SRS due, study stats.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (_req: NextRequest, { userId }) => {
  try {
    const [
      recentCourses,
      srsCards,
      lessonArtifacts,
      allCourseData,
      totalCoursesCount,
      totalLessonsCount,
    ] = await Promise.all([
    // Recent courses with lesson count (for "continue learning" widget)
    prisma.course.findMany({
      where: { userId },
      orderBy: { lastAccessedAt: { sort: "desc", nulls: "last" } },
      take: 5,
      select: {
        id: true,
        title: true,
        contentType: true,
        lastAccessedAt: true,
        _count: { select: { lessons: true } },
        progress: {
          where: { userId },
          select: { completionPct: true },
          take: 1,
        },
      },
    }),
    // SRS due cards count
    prisma.flashcardReview.count({
      where: {
        userId,
        nextReviewAt: { lte: new Date() },
      },
    }),
    // Total artifacts (proxy for lessons studied)
    prisma.lessonArtifact.count({
      where: { userId },
    }),
    // All courses with lesson count + progress (for weighted completion)
    prisma.course.findMany({
      where: { userId },
      select: {
        _count: { select: { lessons: true } },
        progress: {
          where: { userId },
          select: { completionPct: true },
          take: 1,
        },
      },
    }),
    // Total courses count (all, not just recent 5)
    prisma.course.count({ where: { userId } }),
    // Total lessons count (all courses)
    prisma.lesson.count({
      where: { course: { userId } },
    }),
  ]);

  // Weighted completion: sum per-course (lessons × completion%) for accuracy
  const completedLessons = allCourseData.reduce((sum, c) => {
    const pct = c.progress[0]?.completionPct ?? 0;
    return sum + Math.round((c._count.lessons * pct) / 100);
  }, 0);

  const continueLearning = recentCourses.map((c) => ({
    id: c.id,
    title: c.title,
    contentType: c.contentType,
    lastAccessedAt: c.lastAccessedAt,
    totalLessons: c._count.lessons,
    completedLessons: Math.round(
      (c._count.lessons * (c.progress[0]?.completionPct ?? 0)) / 100
    ),
    progress: Math.round(c.progress[0]?.completionPct ?? 0),
  }));

  return NextResponse.json({
      continueLearning,
      srsDue: srsCards,
      stats: {
        totalCourses: totalCoursesCount,
        completedLessons,
        totalLessons: totalLessonsCount,
        totalArtifacts: lessonArtifacts,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
});
