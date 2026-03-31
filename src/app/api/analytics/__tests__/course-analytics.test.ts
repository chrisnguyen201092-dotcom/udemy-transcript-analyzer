/**
 * Tests for GET /api/analytics/course/[id]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------- Hoisted mocks ----------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    course: { count: vi.fn(), findUnique: vi.fn() },
    lesson: { findMany: vi.fn() },
    lessonProgress: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    flashcardReview: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
    courseProgress: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ---------- Route import (after mock) ----------

import { GET } from "@/app/api/analytics/course/[id]/route";

// ---------- Helpers ----------

function makeReq(): NextRequest {
  return new NextRequest("http://localhost/api/analytics/course/c1", {
    method: "GET",
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const baseCourse = {
  id: "c1",
  title: "Python for Beginners",
  url: null,
  roadmap: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lessons: [
    { id: "l1", title: "Intro", order: 1 },
    { id: "l2", title: "Variables", order: 2 },
    { id: "l3", title: "Functions", order: 3 },
  ],
};

/** Default aggregate return values — route crashes without these */
const DEFAULT_TIME_AGG = { _sum: { timeSpentMs: null } };
const DEFAULT_QUIZ_AGG = { _avg: { quizScore: null }, _count: { quizScore: 0 } };
const DEFAULT_EF_AGG = { _avg: { easinessFactor: null } };

beforeEach(() => {
  vi.clearAllMocks();
  // Default: course found, no progress, no reviews
  mockPrisma.course.findUnique.mockResolvedValue(baseCourse);
  mockPrisma.lessonProgress.count.mockResolvedValue(0);
  // Route calls aggregate twice in Promise.all: first _sum timeSpentMs, then _avg quizScore.
  // Use mockImplementation so individual tests can override with mockResolvedValueOnce.
  let aggregateCallCount = 0;
  mockPrisma.lessonProgress.aggregate.mockImplementation(() => {
    aggregateCallCount++;
    return Promise.resolve(aggregateCallCount === 1 ? DEFAULT_TIME_AGG : DEFAULT_QUIZ_AGG);
  });
  mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
  mockPrisma.flashcardReview.count.mockResolvedValue(0);
  mockPrisma.flashcardReview.aggregate.mockResolvedValue(DEFAULT_EF_AGG);
  mockPrisma.flashcardReview.groupBy.mockResolvedValue([]);
});

// ==============================
// GET /api/analytics/course/[id]
// ==============================

describe("GET /api/analytics/course/[id]", () => {
  it("returns full data when all lessons have progress and flashcard reviews", async () => {
    // ── aggregate/count mocks ──────────────────────────────────────────────
    mockPrisma.lessonProgress.count.mockResolvedValue(2); // completed: 2 of 3
    mockPrisma.lessonProgress.aggregate
      // First call: _sum timeSpentMs
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 6000000 } })
      // Second call: _avg quizScore
      .mockResolvedValueOnce({ _avg: { quizScore: 80 }, _count: { quizScore: 2 } });
    mockPrisma.flashcardReview.count
      .mockResolvedValueOnce(3)  // totalReviews
      .mockResolvedValueOnce(2)  // masteredCardCount (interval > 7)
      .mockResolvedValueOnce(1); // dueCardCount
    mockPrisma.flashcardReview.aggregate.mockResolvedValue({
      _avg: { easinessFactor: 2.43 },
    });

    // ── per-lesson detail mocks ────────────────────────────────────────────
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date("2026-03-10T10:00:00Z"),
        timeSpentMs: 3600000,
        quizScore: 90,
      },
      {
        lessonId: "l2",
        completed: true,
        completedAt: new Date("2026-03-11T10:00:00Z"),
        timeSpentMs: 1800000,
        quizScore: 70,
      },
      {
        lessonId: "l3",
        completed: false,
        completedAt: null,
        timeSpentMs: 600000,
        quizScore: null,
      },
    ]);

    // groupBy: mastered per lesson (interval > 7)
    mockPrisma.flashcardReview.groupBy
      .mockResolvedValueOnce([
        { lessonId: "l1", _count: { _all: 1 } },
      ])
      // total per lesson
      .mockResolvedValueOnce([
        { lessonId: "l1", _count: { _all: 2 } },
        { lessonId: "l2", _count: { _all: 1 } },
      ]);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.courseId).toBe("c1");
    expect(data.courseName).toBe("Python for Beginners");
    expect(data.completionRate).toBeCloseTo(66.67, 1);
    expect(data.totalTimeSeconds).toBe(6000); // 6000000/1000
    expect(data.averageQuizScore).toBe(80);
    expect(data.lessons).toHaveLength(3);

    // Lesson 1 details
    expect(data.lessons[0]).toMatchObject({
      lessonId: "l1",
      title: "Intro",
      completed: true,
      timeSeconds: 3600,
      quizScore: 90,
      flashcardsMastered: 1, // from groupBy mastered mock
      flashcardsTotal: 2,    // from groupBy total mock
    });
    expect(data.lessons[0].completedAt).toBeTruthy();

    // Lesson 3 — not completed
    expect(data.lessons[2]).toMatchObject({
      lessonId: "l3",
      completed: false,
      quizScore: null,
      completedAt: null,
    });

    // Quiz distribution: 70 → 61-80 bin, 90 → 81-100 bin
    const bins = data.quizScoreDistribution;
    expect(bins.find((b: { bin: string }) => b.bin === "61-80").count).toBe(1);
    expect(bins.find((b: { bin: string }) => b.bin === "81-100").count).toBe(1);
    expect(bins.find((b: { bin: string }) => b.bin === "0-20").count).toBe(0);

    // Flashcard aggregate
    expect(data.masteredCardCount).toBe(2);
    expect(data.retentionRate).toBeCloseTo(66.67, 1);
    expect(data.averageEaseFactor).toBeCloseTo(2.43, 1);
  });

  it("returns 404 when course does not exist", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const res = await GET(makeReq(), makeParams("nonexistent"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Course not found");
  });

  it("returns empty state when course has no progress and no reviews", async () => {
    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.completionRate).toBe(0);
    expect(data.totalTimeSeconds).toBe(0);
    expect(data.averageQuizScore).toBeNull();
    expect(data.retentionRate).toBeNull();
    expect(data.masteredCardCount).toBe(0);
    expect(data.dueCardCount).toBe(0);
    expect(data.averageEaseFactor).toBeNull();
    expect(data.lessons).toHaveLength(3);
    // All lessons default to not completed
    for (const lesson of data.lessons) {
      expect(lesson.completed).toBe(false);
      expect(lesson.timeSeconds).toBe(0);
      expect(lesson.quizScore).toBeNull();
      expect(lesson.completedAt).toBeNull();
    }
    // All quiz bins should be 0
    for (const bin of data.quizScoreDistribution) {
      expect(bin.count).toBe(0);
    }
  });

  it("handles partial progress — some lessons completed, others not", async () => {
    mockPrisma.lessonProgress.count.mockResolvedValue(1);
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 1000000 } })
      .mockResolvedValueOnce({ _avg: { quizScore: 60 }, _count: { quizScore: 1 } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date("2026-03-10T10:00:00Z"),
        timeSpentMs: 1000000,
        quizScore: 60,
      },
    ]);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(data.completionRate).toBeCloseTo(33.33, 1);
    expect(data.totalTimeSeconds).toBe(1000);
    expect(data.averageQuizScore).toBe(60);
    expect(data.lessons[0].completed).toBe(true);
    expect(data.lessons[1].completed).toBe(false);
    expect(data.lessons[2].completed).toBe(false);
  });

  it("returns null averageQuizScore when no lessons have quiz scores", async () => {
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 500000 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null }, _count: { quizScore: 0 } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date(),
        timeSpentMs: 500000,
        quizScore: null,
      },
    ]);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(data.averageQuizScore).toBeNull();
    // Quiz distribution should be all zeros
    for (const bin of data.quizScoreDistribution) {
      expect(bin.count).toBe(0);
    }
  });

  it("returns null retention and ease when no flashcard reviews", async () => {
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 100000 } })
      .mockResolvedValueOnce({ _avg: { quizScore: 80 }, _count: { quizScore: 1 } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date(),
        timeSpentMs: 100000,
        quizScore: 80,
      },
    ]);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(data.retentionRate).toBeNull();
    expect(data.averageEaseFactor).toBeNull();
    expect(data.masteredCardCount).toBe(0);
    expect(data.dueCardCount).toBe(0);
  });

  it("correctly counts due cards based on nextReviewAt", async () => {
    mockPrisma.flashcardReview.count
      .mockResolvedValueOnce(2)  // totalReviews
      .mockResolvedValueOnce(1)  // masteredCardCount (interval > 7): r2 interval=20
      .mockResolvedValueOnce(1); // dueCardCount: r1 nextReviewAt in past

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(data.dueCardCount).toBe(1);
    expect(data.masteredCardCount).toBe(1);
  });

  it("quiz score distribution bins correctly", async () => {
    mockPrisma.lessonProgress.count.mockResolvedValue(3);
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 0 } })
      .mockResolvedValueOnce({ _avg: { quizScore: 50 }, _count: { quizScore: 3 } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true, completedAt: new Date(), timeSpentMs: 0, quizScore: 15 },
      { lessonId: "l2", completed: true, completedAt: new Date(), timeSpentMs: 0, quizScore: 35 },
      { lessonId: "l3", completed: true, completedAt: new Date(), timeSpentMs: 0, quizScore: 100 },
    ]);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    const dist = data.quizScoreDistribution;
    expect(dist.find((b: { bin: string }) => b.bin === "0-20").count).toBe(1); // 15
    expect(dist.find((b: { bin: string }) => b.bin === "21-40").count).toBe(1); // 35
    expect(dist.find((b: { bin: string }) => b.bin === "41-60").count).toBe(0);
    expect(dist.find((b: { bin: string }) => b.bin === "61-80").count).toBe(0);
    expect(dist.find((b: { bin: string }) => b.bin === "81-100").count).toBe(1); // 100
  });

  it("returns 500 on database error", async () => {
    mockPrisma.course.findUnique.mockRejectedValue(new Error("DB crashed"));

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to get course analytics");
  });

  it("lessons are ordered by order field from the course query", async () => {
    // Override with out-of-order lessons to verify DB ordering is respected
    mockPrisma.course.findUnique.mockResolvedValue({
      ...baseCourse,
      lessons: [
        { id: "l3", title: "Functions", order: 3 },
        { id: "l1", title: "Intro", order: 1 },
        { id: "l2", title: "Variables", order: 2 },
      ],
    });

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    // Order should be as returned from DB (already orderBy in query)
    expect(data.lessons[0].title).toBe("Functions");
    expect(data.lessons[1].title).toBe("Intro");
    expect(data.lessons[2].title).toBe("Variables");
  });
});

// ─── Edge cases: large courses, null quizScores, division by zero ──────────────

describe("course analytics edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset defaults
    mockPrisma.course.findUnique.mockResolvedValue(baseCourse);
    mockPrisma.lessonProgress.count.mockResolvedValue(0);
    let aggregateCallCount = 0;
    mockPrisma.lessonProgress.aggregate.mockImplementation(() => {
      aggregateCallCount++;
      return Promise.resolve(aggregateCallCount === 1 ? DEFAULT_TIME_AGG : DEFAULT_QUIZ_AGG);
    });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.flashcardReview.count.mockResolvedValue(0);
    mockPrisma.flashcardReview.aggregate.mockResolvedValue(DEFAULT_EF_AGG);
    mockPrisma.flashcardReview.groupBy.mockResolvedValue([]);
  });

  it("handles course with 100 lessons efficiently", async () => {
    const manyLessons = Array.from({ length: 100 }, (_, i) => ({
      id: `l${i + 1}`,
      title: `Lesson ${i + 1}`,
      order: i + 1,
    }));

    mockPrisma.course.findUnique.mockResolvedValue({
      ...baseCourse,
      lessons: manyLessons,
    });

    mockPrisma.lessonProgress.count.mockResolvedValue(50);
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 3600000 } })
      .mockResolvedValueOnce({ _avg: { quizScore: 75 }, _count: { quizScore: 50 } });

    // Progress for some lessons
    const progressRecords = manyLessons.slice(0, 50).map((l) => ({
      lessonId: l.id,
      completed: true,
      completedAt: new Date(),
      timeSpentMs: 72000,
      quizScore: 75,
    }));
    mockPrisma.lessonProgress.findMany.mockResolvedValue(progressRecords);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.lessons).toHaveLength(100);
    expect(data.completionRate).toBe(50);
  });

  it("quiz distribution handles null quizScores", async () => {
    mockPrisma.lessonProgress.count.mockResolvedValue(3);
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 0 } })
      .mockResolvedValueOnce({ _avg: { quizScore: 80 }, _count: { quizScore: 1 } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true, completedAt: new Date(), timeSpentMs: 0, quizScore: null },
      { lessonId: "l2", completed: true, completedAt: new Date(), timeSpentMs: 0, quizScore: null },
      { lessonId: "l3", completed: true, completedAt: new Date(), timeSpentMs: 0, quizScore: 80 },
    ]);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    // Only 1 quiz score should appear in distribution
    const totalCount = data.quizScoreDistribution.reduce(
      (sum: number, bin: { count: number }) => sum + bin.count,
      0
    );
    expect(totalCount).toBe(1);
    expect(data.quizScoreDistribution.find((b: { bin: string }) => b.bin === "61-80").count).toBe(1);
  });

  it("time per lesson calculation with zero totalTimeMs — no division by zero", async () => {
    mockPrisma.lessonProgress.count.mockResolvedValue(1);
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 0 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null }, _count: { quizScore: 0 } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date(),
        timeSpentMs: 0,
        quizScore: null,
      },
    ]);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalTimeSeconds).toBe(0);
    // Lesson time should be 0, not NaN or Infinity
    const lesson1 = data.lessons.find((l: { lessonId: string }) => l.lessonId === "l1");
    expect(lesson1.timeSeconds).toBe(0);
    expect(Number.isFinite(lesson1.timeSeconds)).toBe(true);
  });

  it("handles lesson with all-null AI fields in analytics", async () => {
    // Course with lessons that have no AI-generated content
    mockPrisma.lessonProgress.count.mockResolvedValue(1);
    mockPrisma.lessonProgress.aggregate
      .mockResolvedValueOnce({ _sum: { timeSpentMs: 10000 } })
      .mockResolvedValueOnce({ _avg: { quizScore: null }, _count: { quizScore: 0 } });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date(),
        timeSpentMs: 10000,
        quizScore: null,
      },
    ]);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.averageQuizScore).toBeNull();
    const lesson1 = data.lessons.find((l: { lessonId: string }) => l.lessonId === "l1");
    expect(lesson1).toBeDefined();
    expect(lesson1.completed).toBe(true);
    expect(lesson1.quizScore).toBeNull();
    // All quiz bins should be 0 since no quiz scores
    const totalBinCount = data.quizScoreDistribution.reduce(
      (sum: number, bin: { count: number }) => sum + bin.count,
      0
    );
    expect(totalBinCount).toBe(0);
  });
});
