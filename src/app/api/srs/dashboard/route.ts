import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MASTERED_THRESHOLD } from "@/lib/srs";

interface ReviewWithLesson {
  lessonId: string;
  cardIndex: number;
  interval: number;
  nextReviewAt: Date;
  lesson: {
    id: string;
    title: string;
  };
}

export async function GET(_req: NextRequest) {
  try {
    // Fetch all FlashcardReview records with their lesson info
    const allReviews: ReviewWithLesson[] =
      await prisma.flashcardReview.findMany({
        include: {
          lesson: {
            select: { id: true, title: true },
          },
        },
      });

    // Group by lesson
    const lessonMap = new Map<
      string,
      {
        lessonTitle: string;
        dueCount: number;
        totalCards: number;
        masteredCount: number;
      }
    >();

    const now = new Date();

    for (const review of allReviews) {
      const existing = lessonMap.get(review.lessonId);
      const isDue = new Date(review.nextReviewAt) <= now;
      const isMastered = review.interval >= MASTERED_THRESHOLD;

      if (existing) {
        existing.totalCards++;
        if (isDue) existing.dueCount++;
        if (isMastered) existing.masteredCount++;
      } else {
        lessonMap.set(review.lessonId, {
          lessonTitle: review.lesson.title,
          dueCount: isDue ? 1 : 0,
          totalCards: 1,
          masteredCount: isMastered ? 1 : 0,
        });
      }
    }

    // Build response
    let totalDue = 0;
    const lessons = Array.from(lessonMap.entries()).map(
      ([lessonId, stats]) => {
        totalDue += stats.dueCount;
        return {
          lessonId,
          lessonTitle: stats.lessonTitle,
          dueCount: stats.dueCount,
          totalCards: stats.totalCards,
          masteredCount: stats.masteredCount,
        };
      }
    );

    return NextResponse.json({ totalDue, lessons });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to get SRS dashboard" },
      { status: 500 }
    );
  }
}
