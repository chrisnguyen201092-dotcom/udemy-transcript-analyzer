import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const SplitSchema = z.object({
  lessonId: z.string().min(1),
  splitIndex: z.number().int().positive(),
  newTitle: z.string().min(1).max(200),
});

/**
 * POST /api/courses/[id]/lessons/split
 * Split one lesson into two at the given character index.
 * Original keeps related data (top half); new lesson for bottom half.
 * AI fields cleared on both (stale after content change).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const { lessonId, splitIndex, newTitle } = SplitSchema.parse(await req.json());

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (lesson.courseId !== courseId) {
      return NextResponse.json(
        { error: "Lesson does not belong to this course" },
        { status: 400 }
      );
    }

    if (!lesson.transcript || lesson.transcript.length === 0) {
      return NextResponse.json(
        { error: "Lesson has no transcript to split" },
        { status: 400 }
      );
    }

    if (splitIndex >= lesson.transcript.length) {
      return NextResponse.json(
        { error: "Split index out of bounds" },
        { status: 400 }
      );
    }

    const topContent = lesson.transcript.slice(0, splitIndex).trimEnd();
    const bottomContent = lesson.transcript.slice(splitIndex).trimStart();

    if (!topContent || !bottomContent) {
      return NextResponse.json(
        { error: "Split would produce an empty chapter" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update original: top half + clear AI fields
      const original = await tx.lesson.update({
        where: { id: lessonId },
        data: {
          transcript: topContent,
          summary: null,
          explanation: null,
          quiz: null,
          flashcards: null,
          exercises: null,
        },
      });

      // Bump order for all lessons after the split point
      await tx.lesson.updateMany({
        where: {
          courseId,
          order: { gt: lesson.order },
        },
        data: { order: { increment: 1 } },
      });

      // Create new lesson for bottom half
      const created = await tx.lesson.create({
        data: {
          courseId,
          title: newTitle,
          transcript: bottomContent,
          order: lesson.order + 1,
        },
      });

      // Fetch final lesson list
      const lessons = await tx.lesson.findMany({
        where: { courseId },
        orderBy: { order: "asc" },
      });

      return { original, created, lessons };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    console.error("[split]", error);
    return NextResponse.json({ error: "Failed to split lesson" }, { status: 500 });
  }
}
