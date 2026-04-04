import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import {
  calculateStreak,
  computeMasteryScore,
  computeCourseProgressMetrics,
  evaluateMasteryGate,
  getTimezoneFromRequest,
} from "@/lib/progress-helpers";

// ─── Schemas ───────────────────────────────────────────────────────────────────

const PostProgressSchema = z.object({
  completed: z.boolean(),
  quizScore: z.number().min(0).max(100).optional(),
});

const PatchProgressSchema = z.object({
  deltaTimeMs: z.number().min(0, "deltaTimeMs must be >= 0").optional(),
  flashcardsMastered: z.number().optional(),
  flashcardsTotal: z.number().optional(),
});

// ─── POST /api/lessons/[id]/progress ───────────────────────────────────────────

export const POST = withAuth(async (req, { userId, params }) => {
  let body: z.infer<typeof PostProgressSchema>;
  try {
    body = PostProgressSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const id = params?.id ?? "";
    const timezone = getTimezoneFromRequest(req);

    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
      include: { course: { include: { lessons: { select: { id: true } } } } },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const { completed, quizScore } = body;
    const courseId = lesson.courseId;

    // ── Mastery gate ──────────────────────────────────────────────────────────
    // Gate passes if: no quiz (quizScore null) OR quizScore >= threshold
    const masteryGatePassed = completed && evaluateMasteryGate(quizScore);

    // Composite mastery score (async — reads SRS data)
    const masteryScore = completed
      ? await computeMasteryScore(userId, id, quizScore ?? null)
      : null;

    // ── Upsert LessonProgress ────────────────────────────────────────────────
    const lessonProgress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: id } },
      create: {
        userId,
        lessonId: id,
        completed,
        completedAt: completed ? new Date() : null,
        quizScore: quizScore ?? null,
        masteryGatePassed,
        masteryScore,
      },
      update: {
        completed,
        completedAt: completed ? new Date() : null,
        ...(quizScore !== undefined ? { quizScore } : {}),
        masteryGatePassed,
        ...(masteryScore !== null ? { masteryScore } : {}),
      },
    });

    // ── Recalculate CourseProgress ───────────────────────────────────────────
    const allLessonProgress = await prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lesson.course.lessons.map((l) => l.id) } },
      select: { completed: true, masteryGatePassed: true, timeSpentMs: true },
    });

    const { completionPct, totalTimeSpentMs } = computeCourseProgressMetrics(
      lesson.course.lessons.length,
      allLessonProgress
    );

    const existingCourseProgress = await prisma.courseProgress.findFirst({
      where: { courseId, userId },
    });

    const { currentStreak, longestStreak } = calculateStreak(existingCourseProgress, timezone);

    await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, completionPct, currentStreak, longestStreak, lastStudiedAt: new Date(), totalTimeSpentMs },
      update: { completionPct, currentStreak, longestStreak, lastStudiedAt: new Date(), totalTimeSpentMs },
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
        masteryGatePassed: lessonProgress.masteryGatePassed,
        masteryScore: lessonProgress.masteryScore,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update lesson progress" }, { status: 500 });
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
    const id = params?.id ?? "";
    const timezone = getTimezoneFromRequest(req);

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
    } = { timeSpentMs: { increment: delta } };

    if (flashcardsMastered !== undefined) updateData.flashcardsMastered = flashcardsMastered;
    if (flashcardsTotal !== undefined) updateData.flashcardsTotal = flashcardsTotal;

    const lessonProgress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: id } },
      create: { userId, lessonId: id, timeSpentMs: delta, flashcardsMastered: flashcardsMastered ?? 0, flashcardsTotal: flashcardsTotal ?? 0 },
      update: updateData,
    });

    // Update streak + totalTimeSpentMs in CourseProgress
    const courseId = lesson.courseId;

    const allLessonProgress = await prisma.lessonProgress.findMany({
      where: { userId, lesson: { courseId } },
      select: { completed: true, masteryGatePassed: true, timeSpentMs: true },
    });

    // PATCH doesn't change completionPct — read existing or recompute
    const course = await prisma.course.findFirst({ where: { id: courseId }, include: { lessons: { select: { id: true } } } });
    const { completionPct, totalTimeSpentMs } = computeCourseProgressMetrics(
      course?.lessons.length ?? 0,
      allLessonProgress
    );

    const existingCourseProgress = await prisma.courseProgress.findFirst({ where: { courseId, userId } });
    const { currentStreak, longestStreak } = calculateStreak(existingCourseProgress, timezone);

    await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, completionPct, currentStreak, longestStreak, lastStudiedAt: new Date(), totalTimeSpentMs },
      update: { completionPct, currentStreak, longestStreak, lastStudiedAt: new Date(), totalTimeSpentMs },
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
        masteryGatePassed: lessonProgress.masteryGatePassed,
        masteryScore: lessonProgress.masteryScore,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update lesson progress" }, { status: 500 });
  }
});
