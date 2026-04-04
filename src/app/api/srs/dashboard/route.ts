import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MASTERED_THRESHOLD } from "@/lib/srs";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (_req, { userId }) => {
  try {
    const now = new Date();

    // All counts are computed in the database — no full row fetch.
    const [totalByLesson, dueByLesson, masteredByLesson] = await Promise.all([
      // Total cards per lesson scoped to userId
      prisma.flashcardReview.groupBy({
        by: ["lessonId"],
        where: { userId },
        _count: { _all: true },
      }),
      // Due cards per lesson (nextReviewAt <= now)
      prisma.flashcardReview.groupBy({
        by: ["lessonId"],
        where: { userId, nextReviewAt: { lte: now } },
        _count: { _all: true },
      }),
      // Mastered cards per lesson (interval >= MASTERED_THRESHOLD)
      prisma.flashcardReview.groupBy({
        by: ["lessonId"],
        where: { userId, interval: { gte: MASTERED_THRESHOLD } },
        _count: { _all: true },
      }),
    ]);

    // Build lookup maps
    const dueMap = new Map(dueByLesson.map((r) => [r.lessonId, r._count._all]));
    const masteredMap = new Map(
      masteredByLesson.map((r) => [r.lessonId, r._count._all])
    );

    // Fetch lesson titles for only the lessonIds that have cards (small set)
    const lessonIds = totalByLesson.map((r) => r.lessonId);
    const lessonRows = await prisma.lesson.findMany({
      where: { id: { in: lessonIds }, course: { userId } },
      select: { id: true, title: true },
    });
    const titleMap = new Map(lessonRows.map((l) => [l.id, l.title]));

    let totalDue = 0;
    const lessons = totalByLesson.map((row) => {
      const dueCount = dueMap.get(row.lessonId) ?? 0;
      const masteredCount = masteredMap.get(row.lessonId) ?? 0;
      totalDue += dueCount;
      return {
        lessonId: row.lessonId,
        lessonTitle: titleMap.get(row.lessonId) ?? row.lessonId,
        dueCount,
        totalCards: row._count._all,
        masteredCount,
      };
    });

    return NextResponse.json({ totalDue, lessons }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to get SRS dashboard" },
      { status: 500 }
    );
  }
});
