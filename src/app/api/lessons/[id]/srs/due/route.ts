import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

interface FlashcardData {
  front: string;
  back: string;
  type: string;
  mnemonic: string | null;
}

interface FlashcardsJSON {
  cards: FlashcardData[];
}

export const GET = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id ?? "";

    // Verify lesson belongs to user's course
    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
      select: { id: true },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: "Bài học không tồn tại" },
        { status: 404 }
      );
    }

    // Get due reviews scoped to userId
    const dueReviews = await prisma.flashcardReview.findMany({
      where: {
        lessonId: id,
        userId,
        nextReviewAt: { lte: new Date() },
      },
    });

    // Read flashcards from per-user LessonArtifact instead of legacy Lesson column
    let cards: FlashcardData[] = [];
    const artifact = await prisma.lessonArtifact.findUnique({
      where: {
        userId_lessonId_type: { userId, lessonId: id, type: "flashcards" },
      },
    });
    if (artifact) {
      try {
        const parsed: FlashcardsJSON = JSON.parse(artifact.content);
        cards = parsed.cards ?? [];
      } catch {
        // Corrupted flashcard data — return empty cards instead of crashing
        cards = [];
      }
    }

    // Merge review data with card content
    const dueCards = dueReviews.map((review) => {
      const card = cards[review.cardIndex];
      return {
        cardIndex: review.cardIndex,
        front: card?.front ?? "",
        back: card?.back ?? "",
        type: card?.type ?? "",
        mnemonic: card?.mnemonic ?? null,
        interval: review.interval,
        repetitions: review.repetitions,
        easinessFactor: review.easinessFactor,
        lastQuality: review.lastQuality,
      };
    });

    return NextResponse.json({
      dueCards,
      totalDue: dueCards.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to get due cards" },
      { status: 500 }
    );
  }
});
