import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

const MergeSchema = z.object({
  lessonId1: z.string().min(1),
  lessonId2: z.string().min(1),
});

/**
 * POST /api/courses/[id]/lessons/merge
 * Merge two adjacent lessons into one. Keeps first lesson's related data;
 * second lesson cascade-deleted. AI fields cleared (stale after content change).
 */
export const POST = withAuth(async (req, { userId, params }) => {
  try {
    const courseId = params?.id!;
    const { lessonId1, lessonId2 } = MergeSchema.parse(await req.json());

    // Verify course ownership
    const course = await prisma.course.findFirst({ where: { id: courseId, userId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Fetch both lessons
    const [lesson1, lesson2] = await Promise.all([
      prisma.lesson.findUnique({ where: { id: lessonId1 } }),
      prisma.lesson.findUnique({ where: { id: lessonId2 } }),
    ]);

    if (!lesson1 || !lesson2) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (lesson1.courseId !== courseId || lesson2.courseId !== courseId) {
      return NextResponse.json(
        { error: "Lessons do not belong to this course" },
        { status: 400 }
      );
    }

    if (lesson2.order !== lesson1.order + 1) {
      return NextResponse.json(
        { error: "Lessons must be adjacent" },
        { status: 400 }
      );
    }

    // Merge transcripts: concat with double newline separator
    const t1 = lesson1.transcript ?? "";
    const t2 = lesson2.transcript ?? "";
    const mergedTranscript = `${t1}\n\n${t2}`.trim() || null;

    // Execute in transaction: update first, delete second, reorder remaining
    const result = await prisma.$transaction(async (tx) => {
      // Update lesson1: merged transcript + clear stale AI fields
      const merged = await tx.lesson.update({
        where: { id: lessonId1 },
        data: {
          transcript: mergedTranscript,
          summary: null,
          explanation: null,
          quiz: null,
          flashcards: null,
          exercises: null,
        },
      });

      // Delete lesson2 (cascade handles progress, flashcards, chat)
      await tx.lesson.delete({ where: { id: lessonId2 } });

      // Reorder remaining lessons sequentially
      const remaining = await tx.lesson.findMany({
        where: { courseId },
        orderBy: { order: "asc" },
        select: { id: true },
      });

      for (let i = 0; i < remaining.length; i++) {
        await tx.lesson.update({
          where: { id: remaining[i].id },
          data: { order: i + 1 },
        });
      }

      // Fetch final lesson list
      const lessons = await tx.lesson.findMany({
        where: { courseId },
        orderBy: { order: "asc" },
      });

      return { merged, lessons };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    console.error("[merge]", error);
    return NextResponse.json({ error: "Failed to merge lessons" }, { status: 500 });
  }
});
