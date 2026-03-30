import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─── Schemas ───────────────────────────────────────────────────────────────────

const PostProgressSchema = z.object({
  completed: z.boolean(),
  quizScore: z.number().optional(),
});

const PatchProgressSchema = z.object({
  deltaTimeMs: z.number().min(0, "deltaTimeMs must be >= 0").optional(),
  flashcardsMastered: z.number().optional(),
  flashcardsTotal: z.number().optional(),
});

// ─── Streak helpers ────────────────────────────────────────────────────────────

function getUTCDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function calculateStreak(
  existing: { currentStreak: number; longestStreak: number; lastStudiedAt: Date | null } | null
): { currentStreak: number; longestStreak: number } {
  const now = new Date();
  const todayStr = getUTCDateString(now);

  if (!existing || !existing.lastStudiedAt) {
    return { currentStreak: 1, longestStreak: Math.max(1, existing?.longestStreak ?? 0) };
  }

  const lastStr = getUTCDateString(new Date(existing.lastStudiedAt));

  if (lastStr === todayStr) {
    // Same day — keep same streak
    return {
      currentStreak: existing.currentStreak,
      longestStreak: existing.longestStreak,
    };
  }

  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = getUTCDateString(yesterday);

  if (lastStr === yesterdayStr) {
    // Yesterday — increment
    const newStreak = existing.currentStreak + 1;
    return {
      currentStreak: newStreak,
      longestStreak: Math.max(existing.longestStreak, newStreak),
    };
  }

  // Gap > 1 day — reset
  return {
    currentStreak: 1,
    longestStreak: Math.max(existing.longestStreak, 1),
  };
}

// ─── POST /api/lessons/[id]/progress ───────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate body first (before DB calls) to return 400 early
  let body: z.infer<typeof PostProgressSchema>;
  try {
    body = PostProgressSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { id } = await params;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { course: { include: { lessons: { select: { id: true } } } } },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const { completed, quizScore } = body;

    // Upsert LessonProgress
    const lessonProgress = await prisma.lessonProgress.upsert({
      where: { lessonId: id },
      create: {
        lessonId: id,
        completed,
        completedAt: completed ? new Date() : null,
        quizScore: quizScore ?? null,
      },
      update: {
        completed,
        completedAt: completed ? new Date() : null,
        ...(quizScore !== undefined ? { quizScore } : {}),
      },
    });

    // Recalculate course progress
    const courseId = lesson.courseId;
    const totalLessons = lesson.course.lessons.length;

    const allLessonProgress = await prisma.lessonProgress.findMany({
      where: {
        lessonId: { in: lesson.course.lessons.map((l) => l.id) },
      },
    });

    const completedCount = allLessonProgress.filter(
      (lp: { completed: boolean }) => lp.completed
    ).length;
    const completionPct = totalLessons > 0
      ? Math.round((completedCount / totalLessons) * 1000) / 10
      : 0;

    const totalTimeSpentMs = allLessonProgress.reduce(
      (sum: number, lp: { timeSpentMs?: number }) => sum + (lp.timeSpentMs ?? 0),
      0
    );

    // Get existing course progress for streak calculation
    const existingCourseProgress = await prisma.courseProgress.findFirst({
      where: { courseId },
    });

    const { currentStreak, longestStreak } = calculateStreak(existingCourseProgress);

    await prisma.courseProgress.upsert({
      where: { courseId },
      create: {
        courseId,
        completionPct,
        currentStreak,
        longestStreak,
        lastStudiedAt: new Date(),
        totalTimeSpentMs,
      },
      update: {
        completionPct,
        currentStreak,
        longestStreak,
        lastStudiedAt: new Date(),
        totalTimeSpentMs,
      },
    });

    return NextResponse.json({
      lessonProgress: {
        id: lessonProgress.id,
        lessonId: lessonProgress.lessonId,
        completed: lessonProgress.completed,
        completedAt: lessonProgress.completedAt,
        quizScore: lessonProgress.quizScore,
        timeSpentMs: lessonProgress.timeSpentMs,
        flashcardsMastered: lessonProgress.flashcardsMastered,
        flashcardsTotal: lessonProgress.flashcardsTotal,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update lesson progress" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/lessons/[id]/progress ──────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: z.infer<typeof PatchProgressSchema>;
  try {
    body = PatchProgressSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { id } = await params;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { course: { select: { id: true } } },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const { deltaTimeMs, flashcardsMastered, flashcardsTotal } = body;

    // Read existing progress for read-then-write pattern (SQLite, no increment)
    const existing = await prisma.lessonProgress.findUnique({
      where: { lessonId: id },
    });

    const currentTimeSpentMs = existing?.timeSpentMs ?? 0;
    const newTimeSpentMs = currentTimeSpentMs + (deltaTimeMs ?? 0);

    const updateData: Record<string, unknown> = {
      timeSpentMs: newTimeSpentMs,
    };
    if (flashcardsMastered !== undefined) updateData.flashcardsMastered = flashcardsMastered;
    if (flashcardsTotal !== undefined) updateData.flashcardsTotal = flashcardsTotal;

    const lessonProgress = await prisma.lessonProgress.upsert({
      where: { lessonId: id },
      create: {
        lessonId: id,
        timeSpentMs: deltaTimeMs ?? 0,
        flashcardsMastered: flashcardsMastered ?? 0,
        flashcardsTotal: flashcardsTotal ?? 0,
      },
      update: updateData,
    });

    // Update CourseProgress: totalTimeSpentMs + streak
    const courseId = lesson.courseId;

    const allLessonProgress = await prisma.lessonProgress.findMany({
      where: {
        lesson: { courseId },
      },
    });

    const totalTimeSpentMs = allLessonProgress.reduce(
      (sum: number, lp: { timeSpentMs?: number }) => sum + (lp.timeSpentMs ?? 0),
      0
    );

    const existingCourseProgress = await prisma.courseProgress.findFirst({
      where: { courseId },
    });

    const { currentStreak, longestStreak } = calculateStreak(existingCourseProgress);

    await prisma.courseProgress.upsert({
      where: { courseId },
      create: {
        courseId,
        currentStreak,
        longestStreak,
        lastStudiedAt: new Date(),
        totalTimeSpentMs,
      },
      update: {
        currentStreak,
        longestStreak,
        lastStudiedAt: new Date(),
        totalTimeSpentMs,
      },
    });

    return NextResponse.json({
      lessonProgress: {
        id: lessonProgress.id,
        lessonId: lessonProgress.lessonId,
        completed: lessonProgress.completed,
        completedAt: lessonProgress.completedAt,
        quizScore: lessonProgress.quizScore,
        timeSpentMs: lessonProgress.timeSpentMs,
        flashcardsMastered: lessonProgress.flashcardsMastered,
        flashcardsTotal: lessonProgress.flashcardsTotal,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update lesson progress" },
      { status: 500 }
    );
  }
}
