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
    flashcardReview: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
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

beforeEach(() => {
  vi.clearAllMocks();
  // Default: course found, no progress, no reviews
  mockPrisma.course.findUnique.mockResolvedValue(baseCourse);
  mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
  mockPrisma.flashcardReview.findMany.mockResolvedValue([]);
});

// ==============================
// GET /api/analytics/course/[id]
// ==============================

describe("GET /api/analytics/course/[id]", () => {
  it("returns full data when all lessons have progress and flashcard reviews", async () => {
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date("2026-03-10T10:00:00Z"),
        timeSpentMs: 3600000,
        quizScore: 90,
        flashcardsMastered: 8,
        flashcardsTotal: 10,
      },
      {
        lessonId: "l2",
        completed: true,
        completedAt: new Date("2026-03-11T10:00:00Z"),
        timeSpentMs: 1800000,
        quizScore: 70,
        flashcardsMastered: 5,
        flashcardsTotal: 10,
      },
      {
        lessonId: "l3",
        completed: false,
        completedAt: null,
        timeSpentMs: 600000,
        quizScore: null,
        flashcardsMastered: 0,
        flashcardsTotal: 0,
      },
    ]);

    mockPrisma.flashcardReview.findMany.mockResolvedValue([
      {
        id: "r1",
        lessonId: "l1",
        cardIndex: 0,
        easinessFactor: 2.5,
        interval: 10,
        repetitions: 3,
        nextReviewAt: new Date("2026-04-01T00:00:00Z"),
        lastQuality: 4,
        totalReviews: 5,
      },
      {
        id: "r2",
        lessonId: "l1",
        cardIndex: 1,
        easinessFactor: 2.0,
        interval: 3,
        repetitions: 2,
        nextReviewAt: new Date("2026-03-28T00:00:00Z"),
        lastQuality: 3,
        totalReviews: 3,
      },
      {
        id: "r3",
        lessonId: "l2",
        cardIndex: 0,
        easinessFactor: 2.8,
        interval: 15,
        repetitions: 5,
        nextReviewAt: new Date("2026-04-10T00:00:00Z"),
        lastQuality: 5,
        totalReviews: 7,
      },
    ]);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.courseId).toBe("c1");
    expect(data.courseName).toBe("Python for Beginners");
    expect(data.completionRate).toBeCloseTo(66.67, 1);
    expect(data.totalTimeSeconds).toBe(6000); // (3600000+1800000+600000)/1000
    expect(data.averageQuizScore).toBe(80); // (90+70)/2
    expect(data.lessons).toHaveLength(3);

    // Lesson 1 details
    expect(data.lessons[0]).toMatchObject({
      lessonId: "l1",
      title: "Intro",
      completed: true,
      timeSeconds: 3600,
      quizScore: 90,
      flashcardsMastered: 1, // from reviews: interval>7 → r1
      flashcardsTotal: 2,
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

    // Flashcard aggregate: 2 mastered (r1 interval=10, r3 interval=15), 3 total
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
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date("2026-03-10T10:00:00Z"),
        timeSpentMs: 1000000,
        quizScore: 60,
        flashcardsMastered: 0,
        flashcardsTotal: 0,
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
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date(),
        timeSpentMs: 500000,
        quizScore: null,
        flashcardsMastered: 0,
        flashcardsTotal: 0,
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
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date(),
        timeSpentMs: 100000,
        quizScore: 80,
        flashcardsMastered: 0,
        flashcardsTotal: 0,
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
    const past = new Date("2026-03-01T00:00:00Z");
    const future = new Date("2099-01-01T00:00:00Z");

    mockPrisma.flashcardReview.findMany.mockResolvedValue([
      {
        id: "r1",
        lessonId: "l1",
        cardIndex: 0,
        easinessFactor: 2.5,
        interval: 1,
        repetitions: 1,
        nextReviewAt: past, // due
        lastQuality: 3,
        totalReviews: 1,
      },
      {
        id: "r2",
        lessonId: "l1",
        cardIndex: 1,
        easinessFactor: 2.5,
        interval: 20,
        repetitions: 5,
        nextReviewAt: future, // not due
        lastQuality: 5,
        totalReviews: 5,
      },
    ]);

    const res = await GET(makeReq(), makeParams("c1"));
    const data = await res.json();

    expect(data.dueCardCount).toBe(1);
    expect(data.masteredCardCount).toBe(1); // r2 interval=20 > 7
  });

  it("quiz score distribution bins correctly", async () => {
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true, completedAt: new Date(), timeSpentMs: 0, quizScore: 15, flashcardsMastered: 0, flashcardsTotal: 0 },
      { lessonId: "l2", completed: true, completedAt: new Date(), timeSpentMs: 0, quizScore: 35, flashcardsMastered: 0, flashcardsTotal: 0 },
      { lessonId: "l3", completed: true, completedAt: new Date(), timeSpentMs: 0, quizScore: 100, flashcardsMastered: 0, flashcardsTotal: 0 },
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
