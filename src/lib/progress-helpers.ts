/**
 * Progress & Mastery helpers — single source of truth for all business logic.
 *
 * Extracted to prevent duplicate logic across POST/PATCH progress routes and
 * the certificate API.
 */

import { MASTERED_THRESHOLD } from "@/lib/srs";
import { prisma } from "@/lib/prisma";

// ─── Constants (tunable) ───────────────────────────────────────────────────────

/** Minimum quiz score (0-100) to pass the mastery gate when a quiz exists. */
export const MASTERY_QUIZ_THRESHOLD = 70;

/** Weight of quiz score in composite masteryScore (0-1). */
const QUIZ_WEIGHT = 0.4;

/** Weight of SRS retention rate in composite masteryScore (0-1). */
const SRS_WEIGHT = 0.6;

/**
 * Minimum number of SRS reviews per card before its quality counts toward retention.
 * Cards with fewer reviews are excluded to avoid noise from first-pass data.
 */
const MIN_SRS_REVIEWS_FOR_RETENTION = 3;

// ─── Timezone-aware streak ────────────────────────────────────────────────────

/**
 * Return YYYY-MM-DD string in the given IANA timezone (e.g. "Asia/Bangkok").
 * Falls back to UTC if the timezone is invalid.
 */
export function getLocalDateString(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    // Invalid timezone — safe fallback to UTC
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Calculate streak values based on the learner's local calendar day.
 *
 * Design decision: streak increments once per local calendar day, regardless
 * of how many lessons are studied. This mirrors Duolingo/GitHub behavior.
 */
export function calculateStreak(
  existing: {
    currentStreak: number;
    longestStreak: number;
    lastStudiedAt: Date | null;
  } | null,
  timezone: string = "UTC"
): { currentStreak: number; longestStreak: number } {
  const now = new Date();
  const todayStr = getLocalDateString(now, timezone);

  if (!existing?.lastStudiedAt) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(1, existing?.longestStreak ?? 0),
    };
  }

  const lastStr = getLocalDateString(new Date(existing.lastStudiedAt), timezone);

  // Already studied today — don't increment, don't break
  if (lastStr === todayStr) {
    return {
      currentStreak: existing.currentStreak,
      longestStreak: existing.longestStreak,
    };
  }

  // Check if lastStudiedAt was yesterday (in local time)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday, timezone);

  if (lastStr === yesterdayStr) {
    // Consecutive day — extend streak
    const newStreak = existing.currentStreak + 1;
    return {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, existing.longestStreak),
    };
  }

  // Gap > 1 day — streak broken, reset to 1
  return {
    currentStreak: 1,
    longestStreak: existing.longestStreak,
  };
}

// ─── Mastery gate ─────────────────────────────────────────────────────────────

/**
 * Determine whether a lesson passes the mastery gate.
 *
 * Rules (all that apply must pass):
 *   1. If a quiz score is provided → must be >= MASTERY_QUIZ_THRESHOLD
 *   2. If no quiz score → passes automatically (lesson has no quiz content)
 *
 * Future: add timeSpentMs >= estimatedDuration * 0.6 when lesson durations exist.
 */
export function evaluateMasteryGate(quizScore: number | null | undefined): boolean {
  if (quizScore == null) return true; // No quiz — gate passes by default
  return quizScore >= MASTERY_QUIZ_THRESHOLD;
}

/**
 * Calculate composite masteryScore (0-100) for a lesson.
 *
 * Formula: quizScore * 0.4 + srsRetentionRate * 0.6
 * Returns null if insufficient data to compute a meaningful score.
 */
export async function computeMasteryScore(
  userId: string,
  lessonId: string,
  quizScore: number | null | undefined
): Promise<number | null> {
  // Fetch all SRS review records for this lesson/user that have enough reviews
  const reviews = await prisma.flashcardReview.findMany({
    where: { userId, lessonId, totalReviews: { gte: MIN_SRS_REVIEWS_FOR_RETENTION } },
    select: { lastQuality: true, interval: true },
  });

  const hasSrsData = reviews.length > 0;
  const hasQuiz = quizScore != null;

  if (!hasQuiz && !hasSrsData) return null;

  // SRS retention rate: avg(lastQuality / 5) across reviewed cards, scaled 0-100
  const srsRetention = hasSrsData
    ? (reviews.reduce((sum, r) => sum + r.lastQuality / 5, 0) / reviews.length) * 100
    : null;

  if (hasQuiz && srsRetention != null) {
    // Both signals available — weighted composite
    return Math.round(quizScore! * QUIZ_WEIGHT + srsRetention * SRS_WEIGHT);
  }
  if (hasQuiz) return Math.round(quizScore!); // Quiz only
  return Math.round(srsRetention!); // SRS only
}

// ─── Course-level aggregations ────────────────────────────────────────────────

/**
 * Compute completionPct and masteryPct on-the-fly from LessonProgress rows.
 * Never read cached DB values — always derive from source of truth.
 */
export function computeCourseProgressMetrics(
  totalLessons: number,
  allLessonProgress: Array<{ completed: boolean; masteryGatePassed: boolean; timeSpentMs: number }>
): {
  completionPct: number;
  masteryPct: number;
  totalTimeSpentMs: number;
  masteredCount: number;
  completedCount: number;
} {
  if (totalLessons === 0) {
    return { completionPct: 0, masteryPct: 0, totalTimeSpentMs: 0, masteredCount: 0, completedCount: 0 };
  }

  const completedCount = allLessonProgress.filter((lp) => lp.completed).length;
  const masteredCount = allLessonProgress.filter((lp) => lp.masteryGatePassed).length;
  const totalTimeSpentMs = allLessonProgress.reduce((sum, lp) => sum + lp.timeSpentMs, 0);

  return {
    completionPct: Math.round((completedCount / totalLessons) * 1000) / 10,
    masteryPct: Math.round((masteredCount / totalLessons) * 1000) / 10,
    totalTimeSpentMs,
    masteredCount,
    completedCount,
  };
}

/**
 * Count distinct local calendar days with study activity for a user/course.
 * Used as an evidence signal in certificate issuance.
 */
export async function countDistinctStudyDays(
  userId: string,
  courseId: string,
  timezone: string = "UTC"
): Promise<number> {
  // Fetch all completedAt timestamps for lessons in this course
  const rows = await prisma.lessonProgress.findMany({
    where: {
      userId,
      lesson: { courseId },
      completedAt: { not: null },
    },
    select: { completedAt: true },
  });

  const uniqueDays = new Set(
    rows
      .filter((r) => r.completedAt != null)
      .map((r) => getLocalDateString(r.completedAt!, timezone))
  );
  return uniqueDays.size;
}

/**
 * Certificate eligibility check.
 * Returns { eligible, reason } — never throws.
 */
export async function checkCertificateEligibility(
  userId: string,
  courseId: string,
  timezone: string = "UTC"
): Promise<{
  eligible: boolean;
  reason?: string;
  completionPct: number;
  masteryPct: number;
  avgQuizScore: number | null;
  totalDaysStudied: number;
}> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    include: { lessons: { select: { id: true } } },
  });

  if (!course) {
    return { eligible: false, reason: "Course not found", completionPct: 0, masteryPct: 0, avgQuizScore: null, totalDaysStudied: 0 };
  }

  const lessonIds = course.lessons.map((l) => l.id);
  const allProgress = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonIds } },
    select: { completed: true, masteryGatePassed: true, timeSpentMs: true, quizScore: true },
  });

  const metrics = computeCourseProgressMetrics(lessonIds.length, allProgress);
  const totalDaysStudied = await countDistinctStudyDays(userId, courseId, timezone);

  // Average quiz score (only lessons that have a quiz score)
  const scoredLessons = allProgress.filter((lp) => lp.quizScore != null);
  const avgQuizScore = scoredLessons.length > 0
    ? scoredLessons.reduce((sum, lp) => sum + lp.quizScore!, 0) / scoredLessons.length
    : null;

  // Eligibility conditions
  if (metrics.completionPct < 80) {
    return { eligible: false, reason: `Cần hoàn thành ít nhất 80% bài học (hiện tại: ${metrics.completionPct}%)`, ...metrics, avgQuizScore, totalDaysStudied };
  }
  if (metrics.masteryPct < 70) {
    return { eligible: false, reason: `Cần đạt mastery ≥70% bài học (hiện tại: ${metrics.masteryPct}%)`, ...metrics, avgQuizScore, totalDaysStudied };
  }
  if (avgQuizScore != null && avgQuizScore < 65) {
    return { eligible: false, reason: `Điểm quiz trung bình cần ≥65 (hiện tại: ${avgQuizScore.toFixed(1)})`, ...metrics, avgQuizScore, totalDaysStudied };
  }
  if (totalDaysStudied < 7) {
    return { eligible: false, reason: `Cần học ít nhất 7 ngày khác nhau (hiện tại: ${totalDaysStudied} ngày)`, ...metrics, avgQuizScore, totalDaysStudied };
  }

  return { eligible: true, ...metrics, avgQuizScore, totalDaysStudied };
}

/** Extract IANA timezone from request header, default to UTC if missing/invalid. */
export function getTimezoneFromRequest(req: Request): string {
  return req.headers.get("X-Timezone") ?? "UTC";
}

/** Extract SRS mastery data for a lesson */
export async function getSRSMasteryStats(userId: string, lessonId: string): Promise<{
  masteredCount: number;
  totalCards: number;
} | null> {
  const reviews = await prisma.flashcardReview.findMany({
    where: { userId, lessonId },
    select: { interval: true },
  });
  if (reviews.length === 0) return null;
  return {
    masteredCount: reviews.filter((r) => r.interval >= MASTERED_THRESHOLD).length,
    totalCards: reviews.length,
  };
}
