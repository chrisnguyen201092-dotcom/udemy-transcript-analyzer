import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface FlashcardData {
  front: string;
  back: string;
  type: string;
  mnemonic: string | null;
}

interface FlashcardsJSON {
  cards: FlashcardData[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: { id: true, flashcards: true },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: "Bài học không tồn tại" },
        { status: 404 }
      );
    }

    // Get due reviews (nextReviewAt <= now)
    const dueReviews = await prisma.flashcardReview.findMany({
      where: {
        lessonId: id,
        nextReviewAt: { lte: new Date() },
      },
    });

    // Parse flashcards to get card content
    let cards: FlashcardData[] = [];
    if (lesson.flashcards) {
      const parsed: FlashcardsJSON = JSON.parse(lesson.flashcards);
      cards = parsed.cards ?? [];
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
}
