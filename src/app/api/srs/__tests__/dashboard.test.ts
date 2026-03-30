/**
 * Integration tests for GET /api/srs/dashboard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------- Hoisted mocks ----------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    flashcardReview: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    lesson: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
    // findMany returns all FlashcardReview records
    mockPrisma.flashcardReview.findMany.mockResolvedValue([
      {
        lessonId: "lesson-1",
        cardIndex: 0,
        interval: 1,
        nextReviewAt: new Date("2026-03-29T00:00:00Z"), // due (past)
        lesson: { id: "lesson-1", title: "React Hooks" },
      },
      {
        lessonId: "lesson-1",
        cardIndex: 1,
        interval: 25,
        nextReviewAt: new Date("2026-04-15T00:00:00Z"), // not due, mastered
        lesson: { id: "lesson-1", title: "React Hooks" },
      },
      {
        lessonId: "lesson-1",
        cardIndex: 2,
        interval: 6,
        nextReviewAt: new Date("2026-03-30T00:00:00Z"), // due (today)
        lesson: { id: "lesson-1", title: "React Hooks" },
      },
      {
        lessonId: "lesson-2",
        cardIndex: 0,
        interval: 30,
        nextReviewAt: new Date("2026-03-28T00:00:00Z"), // due, mastered
        lesson: { id: "lesson-2", title: "State Management" },
      },
    ]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    const res = await getDashboard(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDue).toBe(3); // 3 cards due across all lessons
    expect(data.lessons).toHaveLength(2);

    const lesson1 = data.lessons.find(
      (l: { lessonId: string }) => l.lessonId === "lesson-1"
    );
    expect(lesson1).toMatchObject({
      lessonId: "lesson-1",
      lessonTitle: "React Hooks",
      dueCount: 2,
      totalCards: 3,
      masteredCount: 1, // interval >= 21
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
    mockPrisma.flashcardReview.findMany.mockResolvedValue([]);

    const req = makeGetRequest("http://localhost/api/srs/dashboard");
    const res = await getDashboard(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDue).toBe(0);
    expect(data.lessons).toEqual([]);
  });

  it("excludes lessons with no due cards from due count but includes in list", async () => {
    mockPrisma.flashcardReview.findMany.mockResolvedValue([
      {
        lessonId: "lesson-1",
        cardIndex: 0,
        interval: 10,
        nextReviewAt: new Date("2026-04-15T00:00:00Z"), // not due
        lesson: { id: "lesson-1", title: "No Due Cards" },
      },
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
});
