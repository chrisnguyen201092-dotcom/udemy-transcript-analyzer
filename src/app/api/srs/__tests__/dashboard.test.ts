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

// ─── Edge cases: dashboard grouping, due count, mastery, empty states ──────────

describe("SRS dashboard edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups reviews by lesson correctly with multiple courses", async () => {
    // Reviews from different courses (lessons belong to different courses)
    mockPrisma.flashcardReview.groupBy
      .mockResolvedValueOnce([
        // totalByLesson
        { lessonId: "lesson-a", _count: { _all: 5 } },
        { lessonId: "lesson-b", _count: { _all: 3 } },
        { lessonId: "lesson-c", _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        // dueByLesson
        { lessonId: "lesson-a", _count: { _all: 2 } },
        { lessonId: "lesson-c", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        // masteredByLesson
        { lessonId: "lesson-a", _count: { _all: 3 } },
        { lessonId: "lesson-b", _count: { _all: 1 } },
      ]);

    mockPrisma.lesson.findMany.mockResolvedValue([
      { id: "lesson-a", title: "Course1 - Lesson A" },
      { id: "lesson-b", title: "Course2 - Lesson B" },
      { id: "lesson-c", title: "Course1 - Lesson C" },
    ]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    const res = await getDashboard(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.lessons).toHaveLength(3);
    expect(data.totalDue).toBe(3); // 2 + 0 + 1

    const lessonA = data.lessons.find((l: { lessonId: string }) => l.lessonId === "lesson-a");
    expect(lessonA).toMatchObject({
      totalCards: 5,
      dueCount: 2,
      masteredCount: 3,
    });

    const lessonB = data.lessons.find((l: { lessonId: string }) => l.lessonId === "lesson-b");
    expect(lessonB).toMatchObject({
      totalCards: 3,
      dueCount: 0,
      masteredCount: 1,
    });
  });

  it("calculates due count accurately based on nextReviewAt <= now", async () => {
    mockPrisma.flashcardReview.groupBy
      .mockResolvedValueOnce([
        { lessonId: "lesson-1", _count: { _all: 5 } },
      ])
      .mockResolvedValueOnce([
        // Only 3 cards are due
        { lessonId: "lesson-1", _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([
        { lessonId: "lesson-1", _count: { _all: 1 } },
      ]);

    mockPrisma.lesson.findMany.mockResolvedValue([
      { id: "lesson-1", title: "Test Lesson" },
    ]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    const res = await getDashboard(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDue).toBe(3);
    expect(data.lessons[0].dueCount).toBe(3);
    expect(data.lessons[0].totalCards).toBe(5);

    // Verify the due query was called with nextReviewAt filter
    const dueCall = mockPrisma.flashcardReview.groupBy.mock.calls[1][0];
    expect(dueCall.where).toHaveProperty("nextReviewAt");
    expect(dueCall.where.nextReviewAt).toHaveProperty("lte");
  });

  it("mastered count: cards with interval > threshold", async () => {
    mockPrisma.flashcardReview.groupBy
      .mockResolvedValueOnce([
        { lessonId: "lesson-1", _count: { _all: 10 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        // 7 cards mastered (interval >= threshold)
        { lessonId: "lesson-1", _count: { _all: 7 } },
      ]);

    mockPrisma.lesson.findMany.mockResolvedValue([
      { id: "lesson-1", title: "Mastery Test" },
    ]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    const res = await getDashboard(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.lessons[0].masteredCount).toBe(7);
    expect(data.lessons[0].totalCards).toBe(10);

    // Verify mastered query uses interval filter
    const masteredCall = mockPrisma.flashcardReview.groupBy.mock.calls[2][0];
    expect(masteredCall.where).toHaveProperty("interval");
    expect(masteredCall.where.interval).toHaveProperty("gte");
  });

  it("handles lessons with no flashcard reviews", async () => {
    // A lesson exists but has no reviews at all — won't appear in groupBy results
    mockPrisma.flashcardReview.groupBy
      .mockResolvedValueOnce([]) // totalByLesson — empty
      .mockResolvedValueOnce([]) // dueByLesson — empty
      .mockResolvedValueOnce([]); // masteredByLesson — empty

    // No lessons returned since no reviews exist
    mockPrisma.lesson.findMany.mockResolvedValue([]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    const res = await getDashboard(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDue).toBe(0);
    expect(data.lessons).toEqual([]);
  });

  it("returns empty dashboard for user with no courses", async () => {
    mockPrisma.flashcardReview.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockPrisma.lesson.findMany.mockResolvedValue([]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    const res = await getDashboard(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDue).toBe(0);
    expect(data.lessons).toEqual([]);
    expect(data.lessons).toHaveLength(0);
  });
});
