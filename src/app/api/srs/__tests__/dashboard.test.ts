/**
 * Integration tests for GET /api/srs/dashboard.
 * Updated to match Phase 05 refactor: groupBy aggregation instead of findMany.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------- Hoisted mocks ----------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    flashcardReview: {
      groupBy: vi.fn(),
    },
    lesson: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ---------- Route import (after mock) ----------

import { GET as getDashboard } from "@/app/api/srs/dashboard/route";

// ---------- Helpers ----------

function makeGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==============================
// GET /api/srs/dashboard
// ==============================

describe("GET /api/srs/dashboard", () => {
  it("returns lessons with due counts, total cards, and mastered counts", async () => {
    // groupBy returns are called in order: totalByLesson, dueByLesson, masteredByLesson
    mockPrisma.flashcardReview.groupBy
      .mockResolvedValueOnce([
        // totalByLesson
        { lessonId: "lesson-1", _count: { _all: 3 } },
        { lessonId: "lesson-2", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        // dueByLesson
        { lessonId: "lesson-1", _count: { _all: 2 } },
        { lessonId: "lesson-2", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        // masteredByLesson (interval >= MASTERED_THRESHOLD)
        { lessonId: "lesson-1", _count: { _all: 1 } },
        { lessonId: "lesson-2", _count: { _all: 1 } },
      ]);

    mockPrisma.lesson.findMany.mockResolvedValue([
      { id: "lesson-1", title: "React Hooks" },
      { id: "lesson-2", title: "State Management" },
    ]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    const res = await getDashboard(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDue).toBe(3); // 2 + 1
    expect(data.lessons).toHaveLength(2);

    const lesson1 = data.lessons.find(
      (l: { lessonId: string }) => l.lessonId === "lesson-1"
    );
    expect(lesson1).toMatchObject({
      lessonId: "lesson-1",
      lessonTitle: "React Hooks",
      dueCount: 2,
      totalCards: 3,
      masteredCount: 1,
    });

    const lesson2 = data.lessons.find(
      (l: { lessonId: string }) => l.lessonId === "lesson-2"
    );
    expect(lesson2).toMatchObject({
      lessonId: "lesson-2",
      lessonTitle: "State Management",
      dueCount: 1,
      totalCards: 1,
      masteredCount: 1,
    });
  });

  it("returns empty lessons array when no FlashcardReview exists", async () => {
    mockPrisma.flashcardReview.groupBy
      .mockResolvedValueOnce([]) // totalByLesson
      .mockResolvedValueOnce([]) // dueByLesson
      .mockResolvedValueOnce([]); // masteredByLesson

    mockPrisma.lesson.findMany.mockResolvedValue([]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    const res = await getDashboard(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDue).toBe(0);
    expect(data.lessons).toEqual([]);
  });

  it("excludes lessons with no due cards from due count but includes in list", async () => {
    mockPrisma.flashcardReview.groupBy
      .mockResolvedValueOnce([
        // totalByLesson — 1 lesson with 1 card
        { lessonId: "lesson-1", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([]) // dueByLesson — none due
      .mockResolvedValueOnce([]); // masteredByLesson — none mastered

    mockPrisma.lesson.findMany.mockResolvedValue([
      { id: "lesson-1", title: "No Due Cards" },
    ]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    const res = await getDashboard(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDue).toBe(0);
    // Lesson still included since it has FlashcardReview records
    expect(data.lessons).toHaveLength(1);
    expect(data.lessons[0].dueCount).toBe(0);
  });

  it("uses groupBy aggregation (not findMany) for counting — P-5 regression", async () => {
    // Arrange
    mockPrisma.flashcardReview.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.lesson.findMany.mockResolvedValue([]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    await getDashboard(req);

    // groupBy should be called 3 times (total, due, mastered)
    expect(mockPrisma.flashcardReview.groupBy).toHaveBeenCalledTimes(3);

    // Verify due-cards query filters by nextReviewAt
    const dueCall = mockPrisma.flashcardReview.groupBy.mock.calls[1][0];
    expect(dueCall.where).toHaveProperty("nextReviewAt");
    expect(dueCall.where.nextReviewAt).toHaveProperty("lte");

    // Verify mastered query filters by interval
    const masteredCall = mockPrisma.flashcardReview.groupBy.mock.calls[2][0];
    expect(masteredCall.where).toHaveProperty("interval");
    expect(masteredCall.where.interval).toHaveProperty("gte");
  });
});
