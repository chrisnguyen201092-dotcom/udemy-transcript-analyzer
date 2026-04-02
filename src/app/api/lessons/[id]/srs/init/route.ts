import { NextRequest, NextResponse } from "next/server";
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

export const POST = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id!;

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

    // Read flashcards from per-user LessonArtifact instead of legacy Lesson column
    const artifact = await prisma.lessonArtifact.findUnique({
      where: {
        userId_lessonId_type: { userId, lessonId: id, type: "flashcards" },
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: "Bài học này chưa có flashcard. Hãy tạo flashcard trước." },
        { status: 422 }
      );
    }

    const parsed: FlashcardsJSON = JSON.parse(artifact.content);

    if (!parsed.cards || parsed.cards.length === 0) {
      return NextResponse.json(
        { error: "Bài học này chưa có flashcard. Hãy tạo flashcard trước." },
        { status: 422 }
      );
    }

    // Atomically check existing indices and create new ones to prevent races
    const { created, skipped } = await prisma.$transaction(async (tx) => {
      const existing = await tx.flashcardReview.findMany({
        where: { lessonId: id, userId },
        select: { cardIndex: true },
      });

      const existingIndices = new Set(existing.map((r) => r.cardIndex));
      const newCards = parsed.cards
        .map((_card, index) => index)
        .filter((index) => !existingIndices.has(index));

      if (newCards.length > 0) {
        await tx.flashcardReview.createMany({
          data: newCards.map((cardIndex) => ({
            userId,
            lessonId: id,
            cardIndex,
            easinessFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReviewAt: new Date(),
            lastQuality: 0,
            totalReviews: 0,
          })),
        });
      }

      return { created: newCards.length, skipped: existingIndices.size };
    });

    return NextResponse.json({
      created,
      skipped,
      message: `Khởi tạo SRS thành công cho ${created} thẻ`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to initialize SRS" },
      { status: 500 }
    );
  }
});
