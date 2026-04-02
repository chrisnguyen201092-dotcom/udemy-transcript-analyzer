import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

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
    return {
      currentStreak: existing.currentStreak,
      longestStreak: existing.longestStreak,
    };
  }

  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = getUTCDateString(yesterday);

  if (lastStr === yesterdayStr) {
    const newStreak = existing.currentStreak + 1;
    return {
      currentStreak: newStreak,
      longestStreak: Math.max(existing.longestStreak, newStreak),
    };
  }

  return {
    currentStreak: 1,
    longestStreak: Math.max(existing.longestStreak, 1),
  };
}

// ─── POST /api/lessons/[id]/progress ───────────────────────────────────────────

export const POST = withAuth(async (req, { userId, params }) => {
  let body: z.infer<typeof PostProgressSchema>;
  try {
    body = PostProgressSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const id = params?.id!;

    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
      include: { course: { include: { lessons: { select: { id: true } } } } },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const { completed, quizScore } = body;
    const courseId = lesson.courseId;

    // Upsert LessonProgress scoped to userId
    const lessonProgress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: id } },
      create: {
        userId,
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
    const totalLessons = lesson.course.lessons.length;

    const allLessonProgress = await prisma.lessonProgress.findMany({
      where: {
        userId,
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

    const existingCourseProgress = await prisma.courseProgress.findFirst({
      where: { courseId, userId },
    });

    const { currentStreak, longestStreak } = calculateStreak(existingCourseProgress);

    await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: {
        userId,
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
});

// ─── PATCH /api/lessons/[id]/progress ──────────────────────────────────────────

export const PATCH = withAuth(async (req, { userId, params }) => {
  let body: z.infer<typeof PatchProgressSchema>;
  try {
    body = PatchProgressSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const id = params?.id!;

    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
      include: { course: { select: { id: true } } },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const { deltaTimeMs, flashcardsMastered, flashcardsTotal } = body;
    const delta = Math.max(0, deltaTimeMs ?? 0);

    const updateData: {
      timeSpentMs: { increment: number };
      flashcardsMastered?: number;
      flashcardsTotal?: number;
    } = {
      timeSpentMs: { increment: delta },
    };
    if (flashcardsMastered !== undefined) updateData.flashcardsMastered = flashcardsMastered;
    if (flashcardsTotal !== undefined) updateData.flashcardsTotal = flashcardsTotal;

    const lessonProgress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: id } },
      create: {
        userId,
        lessonId: id,
        timeSpentMs: delta,
        flashcardsMastered: flashcardsMastered ?? 0,
        flashcardsTotal: flashcardsTotal ?? 0,
      },
      update: updateData,
    });

    // Update CourseProgress: totalTimeSpentMs + streak
    const courseId = lesson.courseId;

    const allLessonProgress = await prisma.lessonProgress.findMany({
      where: { userId, lesson: { courseId } },
    });

    const totalTimeSpentMs = allLessonProgress.reduce(
      (sum: number, lp: { timeSpentMs?: number }) => sum + (lp.timeSpentMs ?? 0),
      0
    );

    const existingCourseProgress = await prisma.courseProgress.findFirst({
      where: { courseId, userId },
    });

    const { currentStreak, longestStreak } = calculateStreak(existingCourseProgress);

    await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: {
        userId,
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
});
