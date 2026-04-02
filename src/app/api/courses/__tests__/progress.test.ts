/**
 * Integration tests for GET /api/courses/[id]/progress.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    course: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    courseProgress: {
      upsert: vi.fn(),
      create: vi.fn(),
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
    mockPrisma.course.findFirst.mockResolvedValue({
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
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1",
      title: "Course 1",
      lessons: [{ id: "l1" }],
    });

    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.create.mockResolvedValue({
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
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const req = makeGetRequest("nonexistent");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("returns all lessons progress for course", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
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

// ─── Edge cases: progress percentage calculations ──────────────────────────────

describe("course progress percentage edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0% progress for course with no completed lessons", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1",
      title: "Course 1",
      lessons: [{ id: "l1" }, { id: "l2" }, { id: "l3" }],
    });

    mockPrisma.courseProgress.findFirst.mockResolvedValue({
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
    expect(json.lessonsProgress).toHaveLength(0);
  });

  it("returns 100% progress when all lessons completed", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1",
      title: "Course 1",
      lessons: [{ id: "l1" }, { id: "l2" }],
    });

    mockPrisma.courseProgress.findFirst.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 100.0,
      currentStreak: 2,
      longestStreak: 2,
      lastStudiedAt: new Date(),
      totalTimeSpentMs: 10000,
    });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: "l1",
        completed: true,
        completedAt: new Date(),
        quizScore: 90,
        timeSpentMs: 5000,
        flashcardsMastered: 10,
        flashcardsTotal: 10,
      },
      {
        lessonId: "l2",
        completed: true,
        completedAt: new Date(),
        quizScore: 85,
        timeSpentMs: 5000,
        flashcardsMastered: 8,
        flashcardsTotal: 10,
      },
    ]);

    const req = makeGetRequest("c1");
    const res = await GET(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.courseProgress.completionPct).toBe(100.0);
    expect(json.lessonsProgress).toHaveLength(2);
    expect(json.lessonsProgress.every((lp: { completed: boolean }) => lp.completed)).toBe(true);
  });

  it("progress calculation: 3 of 5 lessons = 60%", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1",
      title: "Course 1",
      lessons: [{ id: "l1" }, { id: "l2" }, { id: "l3" }, { id: "l4" }, { id: "l5" }],
    });

    mockPrisma.courseProgress.findFirst.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 60.0,
      currentStreak: 1,
      longestStreak: 3,
      lastStudiedAt: new Date(),
      totalTimeSpentMs: 15000,
    });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true, completedAt: new Date(), quizScore: 80, timeSpentMs: 5000, flashcardsMastered: 5, flashcardsTotal: 10 },
      { lessonId: "l2", completed: true, completedAt: new Date(), quizScore: 70, timeSpentMs: 5000, flashcardsMastered: 3, flashcardsTotal: 10 },
      { lessonId: "l3", completed: true, completedAt: new Date(), quizScore: 90, timeSpentMs: 5000, flashcardsMastered: 8, flashcardsTotal: 10 },
    ]);

    const req = makeGetRequest("c1");
    const res = await GET(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.courseProgress.completionPct).toBe(60.0);
    expect(json.lessonsProgress).toHaveLength(3);
  });

  it("handles deleted lesson not affecting progress calculation", async () => {
    // Course has 2 lessons, but lessonProgress references a deleted lesson (l3)
    mockPrisma.course.findFirst.mockResolvedValue({
      id: "c1",
      title: "Course 1",
      lessons: [{ id: "l1" }, { id: "l2" }],
    });

    mockPrisma.courseProgress.findFirst.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 50.0,
      currentStreak: 1,
      longestStreak: 1,
      lastStudiedAt: new Date(),
      totalTimeSpentMs: 5000,
    });

    // Progress includes a record for a deleted lesson (l3) which is no longer in course
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true, completedAt: new Date(), quizScore: 80, timeSpentMs: 3000, flashcardsMastered: 5, flashcardsTotal: 10 },
      { lessonId: "l3", completed: true, completedAt: new Date(), quizScore: 70, timeSpentMs: 2000, flashcardsMastered: 3, flashcardsTotal: 5 },
    ]);

    const req = makeGetRequest("c1");
    const res = await GET(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    // Should not error — orphaned progress records don't crash the response
    expect(res.status).toBe(200);
    expect(json.courseProgress).toBeDefined();
    expect(json.lessonsProgress).toBeDefined();
    // The returned progress may include l3 or not — either way, no crash
    expect(json.lessonsProgress.length).toBeGreaterThanOrEqual(1);
  });
});
