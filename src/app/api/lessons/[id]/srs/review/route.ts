import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { calculateSM2 } from "@/lib/srs";
import { withAuth } from "@/lib/auth";

const ReviewSchema = z.object({
  cardIndex: z.number().int().min(0),
  quality: z.number().int().min(0).max(5),
});

export const POST = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id ?? "";

    const body = await req.json();
    const parsed = ReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { cardIndex, quality } = parsed.data;

    // Find the review record scoped to userId
    const review = await prisma.flashcardReview.findFirst({
      where: { lessonId: id, cardIndex, userId },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Review record not found" },
        { status: 404 }
      );
    }

    // Calculate new SM-2 values
    const sm2Result = calculateSM2({
      quality,
      repetitions: review.repetitions,
      easinessFactor: review.easinessFactor,
      interval: review.interval,
    });

    // Update the record
    const updated = await prisma.flashcardReview.update({
      where: { id: review.id },
      data: {
        repetitions: sm2Result.repetitions,
        easinessFactor: sm2Result.easinessFactor,
        interval: sm2Result.interval,
        nextReviewAt: sm2Result.nextReviewAt,
        lastQuality: quality,
        // H-4: Atomic increment at DB level to avoid lost updates under concurrency
        totalReviews: { increment: 1 },
      },
    });

    return NextResponse.json({
      cardIndex: updated.cardIndex,
      interval: updated.interval,
      repetitions: updated.repetitions,
      easinessFactor: updated.easinessFactor,
      nextReviewAt: updated.nextReviewAt,
      totalReviews: updated.totalReviews,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 }
    );
  }
});
