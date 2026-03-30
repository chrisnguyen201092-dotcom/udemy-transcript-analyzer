/**
 * Integration tests for GET /api/courses/[id]/progress.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    course: {
      findUnique: vi.fn(),
    },
    courseProgress: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    lessonProgress: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/courses/[id]/progress/route";

function makeGetRequest(courseId: string): NextRequest {
  return new NextRequest(`http://localhost/api/courses/${courseId}/progress`, {
    method: "GET",
  });
}

describe("GET /api/courses/[id]/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns course progress and lessons progress", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Course 1",
      lessons: [{ id: "l1" }, { id: "l2" }, { id: "l3" }],
    });

    mockPrisma.courseProgress.findFirst.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 33.3,
      currentStreak: 2,
      longestStreak: 5,
      lastStudiedAt: new Date("2026-03-30T08:00:00.000Z"),
      totalTimeSpentMs: 7200000,
    });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date("2026-03-29T10:00:00.000Z"),
        quizScore: 90.0,
        timeSpentMs: 1800000,
        flashcardsMastered: 15,
        flashcardsTotal: 20,
      },
    ]);

    const req = makeGetRequest("c1");
    const res = await GET(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.courseProgress).toBeDefined();
    expect(json.courseProgress.courseId).toBe("c1");
    expect(json.courseProgress.completionPct).toBe(33.3);
    expect(json.courseProgress.currentStreak).toBe(2);
    expect(json.courseProgress.longestStreak).toBe(5);
    expect(json.lessonsProgress).toHaveLength(1);
    expect(json.lessonsProgress[0].lessonId).toBe("l1");
  });

  it("creates default course progress when none exists", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Course 1",
      lessons: [{ id: "l1" }],
    });

    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastStudiedAt: null,
      totalTimeSpentMs: 0,
    });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

    const req = makeGetRequest("c1");
    const res = await GET(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.courseProgress.completionPct).toBe(0);
    expect(json.courseProgress.currentStreak).toBe(0);
    expect(json.lessonsProgress).toHaveLength(0);
  });

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const req = makeGetRequest("nonexistent");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("returns all lessons progress for course", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Course 1",
      lessons: [{ id: "l1" }, { id: "l2" }],
    });

    mockPrisma.courseProgress.findFirst.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 100.0,
      currentStreak: 1,
      longestStreak: 1,
      lastStudiedAt: new Date(),
      totalTimeSpentMs: 5000,
    });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date(),
        quizScore: 95.0,
        timeSpentMs: 3000,
        flashcardsMastered: 10,
        flashcardsTotal: 10,
      },
      {
        lessonId: "l2",
        completed: true,
        completedAt: new Date(),
        quizScore: 80.0,
        timeSpentMs: 2000,
        flashcardsMastered: 5,
        flashcardsTotal: 8,
      },
    ]);

    const req = makeGetRequest("c1");
    const res = await GET(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.lessonsProgress).toHaveLength(2);
    expect(json.courseProgress.completionPct).toBe(100.0);
  });
});
