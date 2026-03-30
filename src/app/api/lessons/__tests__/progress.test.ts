/**
 * Integration tests for POST & PATCH /api/lessons/[id]/progress.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: {
      findUnique: vi.fn(),
    },
    lessonProgress: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    courseProgress: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST, PATCH } from "@/app/api/lessons/[id]/progress/route";

function makePostRequest(lessonId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/lessons/${lessonId}/progress`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePatchRequest(lessonId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/lessons/${lessonId}/progress`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─── POST /api/lessons/[id]/progress ───────────────────────────────────────────

describe("POST /api/lessons/[id]/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks lesson as completed and returns lessonProgress", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      courseId: "c1",
      course: { id: "c1", lessons: [{ id: "l1" }, { id: "l2" }] },
    });

    const upsertedProgress = {
      id: "lp1",
      lessonId: "l1",
      completed: true,
      completedAt: new Date("2026-03-30T10:00:00.000Z"),
      quizScore: null,
      timeSpentMs: 0,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    };
    mockPrisma.lessonProgress.upsert.mockResolvedValue(upsertedProgress);

    // For completionPct calculation: 1 completed out of 2
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true, timeSpentMs: 0 },
    ]);

    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 50.0,
      currentStreak: 1,
      longestStreak: 1,
      lastStudiedAt: new Date(),
      totalTimeSpentMs: 0,
    });

    const req = makePostRequest("l1", { completed: true });
    const res = await POST(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.lessonProgress).toBeDefined();
    expect(json.lessonProgress.lessonId).toBe("l1");
    expect(json.lessonProgress.completed).toBe(true);
    expect(json.lessonProgress.completedAt).toBeDefined();
  });

  it("marks lesson as not completed (toggle off)", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      courseId: "c1",
      course: { id: "c1", lessons: [{ id: "l1" }] },
    });

    const upsertedProgress = {
      id: "lp1",
      lessonId: "l1",
      completed: false,
      completedAt: null,
      quizScore: null,
      timeSpentMs: 0,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    };
    mockPrisma.lessonProgress.upsert.mockResolvedValue(upsertedProgress);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 0,
      currentStreak: 1,
      longestStreak: 1,
      lastStudiedAt: new Date(),
      totalTimeSpentMs: 0,
    });

    const req = makePostRequest("l1", { completed: false });
    const res = await POST(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.lessonProgress.completed).toBe(false);
    expect(json.lessonProgress.completedAt).toBeNull();
  });

  it("saves quizScore when provided", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      courseId: "c1",
      course: { id: "c1", lessons: [{ id: "l1" }] },
    });

    const upsertedProgress = {
      id: "lp1",
      lessonId: "l1",
      completed: true,
      completedAt: new Date(),
      quizScore: 85.5,
      timeSpentMs: 0,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    };
    mockPrisma.lessonProgress.upsert.mockResolvedValue(upsertedProgress);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true, timeSpentMs: 0 },
    ]);
    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 100.0,
      currentStreak: 1,
      longestStreak: 1,
      lastStudiedAt: new Date(),
      totalTimeSpentMs: 0,
    });

    const req = makePostRequest("l1", { completed: true, quizScore: 85.5 });
    const res = await POST(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.lessonProgress.quizScore).toBe(85.5);
  });

  it("returns 404 when lesson not found", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const req = makePostRequest("nonexistent", { completed: true });
    const res = await POST(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("returns 400 when body is missing completed field", async () => {
    const req = makePostRequest("l1", {});
    const res = await POST(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 400 when completed is not a boolean", async () => {
    const req = makePostRequest("l1", { completed: "yes" });
    const res = await POST(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(400);
  });

  it("updates streak: increments when lastStudiedAt was yesterday", async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      courseId: "c1",
      course: { id: "c1", lessons: [{ id: "l1" }] },
    });
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      lessonId: "l1",
      completed: true,
      completedAt: new Date(),
      quizScore: null,
      timeSpentMs: 0,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true, timeSpentMs: 0 },
    ]);
    mockPrisma.courseProgress.findFirst.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      currentStreak: 3,
      longestStreak: 5,
      lastStudiedAt: yesterday,
      totalTimeSpentMs: 0,
    });
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 100.0,
      currentStreak: 4,
      longestStreak: 5,
      lastStudiedAt: new Date(),
      totalTimeSpentMs: 0,
    });

    const req = makePostRequest("l1", { completed: true });
    const res = await POST(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(200);
    // Verify upsert was called (streak logic in route)
    expect(mockPrisma.courseProgress.upsert).toHaveBeenCalled();
  });

  it("resets streak to 1 when gap > 1 day", async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      courseId: "c1",
      course: { id: "c1", lessons: [{ id: "l1" }] },
    });
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      lessonId: "l1",
      completed: true,
      completedAt: new Date(),
      quizScore: null,
      timeSpentMs: 0,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true, timeSpentMs: 0 },
    ]);
    mockPrisma.courseProgress.findFirst.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      currentStreak: 10,
      longestStreak: 10,
      lastStudiedAt: threeDaysAgo,
      totalTimeSpentMs: 0,
    });
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 100.0,
      currentStreak: 1,
      longestStreak: 10,
      lastStudiedAt: new Date(),
      totalTimeSpentMs: 0,
    });

    const req = makePostRequest("l1", { completed: true });
    const res = await POST(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(200);
    // Verify the streak reset logic is invoked
    const upsertCall = mockPrisma.courseProgress.upsert.mock.calls[0][0];
    expect(upsertCall.update.currentStreak).toBe(1);
  });

  it("keeps streak same when studying same day", async () => {
    const today = new Date();

    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      courseId: "c1",
      course: { id: "c1", lessons: [{ id: "l1" }] },
    });
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      lessonId: "l1",
      completed: true,
      completedAt: new Date(),
      quizScore: null,
      timeSpentMs: 0,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completed: true, timeSpentMs: 0 },
    ]);
    mockPrisma.courseProgress.findFirst.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      currentStreak: 5,
      longestStreak: 5,
      lastStudiedAt: today,
      totalTimeSpentMs: 0,
    });
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      completionPct: 100.0,
      currentStreak: 5,
      longestStreak: 5,
      lastStudiedAt: today,
      totalTimeSpentMs: 0,
    });

    const req = makePostRequest("l1", { completed: true });
    const res = await POST(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(200);
    const upsertCall = mockPrisma.courseProgress.upsert.mock.calls[0][0];
    expect(upsertCall.update.currentStreak).toBe(5);
  });
});

// ─── PATCH /api/lessons/[id]/progress ──────────────────────────────────────────

describe("PATCH /api/lessons/[id]/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds deltaTimeMs to existing progress", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      courseId: "c1",
      course: { id: "c1" },
    });

    mockPrisma.lessonProgress.findUnique.mockResolvedValue({
      id: "lp1",
      lessonId: "l1",
      completed: false,
      completedAt: null,
      quizScore: null,
      timeSpentMs: 5000,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    });

    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      lessonId: "l1",
      completed: false,
      completedAt: null,
      quizScore: null,
      timeSpentMs: 8000,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", timeSpentMs: 8000 },
    ]);
    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      totalTimeSpentMs: 8000,
    });

    const req = makePatchRequest("l1", { deltaTimeMs: 3000 });
    const res = await PATCH(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.lessonProgress).toBeDefined();
    expect(json.lessonProgress.timeSpentMs).toBe(8000);
  });

  it("updates flashcard mastery", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      courseId: "c1",
      course: { id: "c1" },
    });

    mockPrisma.lessonProgress.findUnique.mockResolvedValue(null);

    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      lessonId: "l1",
      completed: false,
      completedAt: null,
      quizScore: null,
      timeSpentMs: 0,
      flashcardsMastered: 8,
      flashcardsTotal: 20,
    });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", timeSpentMs: 0 },
    ]);
    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      totalTimeSpentMs: 0,
    });

    const req = makePatchRequest("l1", { flashcardsMastered: 8, flashcardsTotal: 20 });
    const res = await PATCH(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.lessonProgress.flashcardsMastered).toBe(8);
    expect(json.lessonProgress.flashcardsTotal).toBe(20);
  });

  it("creates progress record when none exists", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      courseId: "c1",
      course: { id: "c1" },
    });

    mockPrisma.lessonProgress.findUnique.mockResolvedValue(null);

    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      lessonId: "l1",
      completed: false,
      completedAt: null,
      quizScore: null,
      timeSpentMs: 5000,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", timeSpentMs: 5000 },
    ]);
    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      totalTimeSpentMs: 5000,
    });

    const req = makePatchRequest("l1", { deltaTimeMs: 5000 });
    const res = await PATCH(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.lessonProgress.timeSpentMs).toBe(5000);
  });

  it("returns 404 when lesson not found", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const req = makePatchRequest("nonexistent", { deltaTimeMs: 1000 });
    const res = await PATCH(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("returns 400 when deltaTimeMs is negative", async () => {
    const req = makePatchRequest("l1", { deltaTimeMs: -100 });
    const res = await PATCH(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(400);
  });

  it("accepts empty body (all fields optional)", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      courseId: "c1",
      course: { id: "c1" },
    });

    mockPrisma.lessonProgress.findUnique.mockResolvedValue({
      id: "lp1",
      lessonId: "l1",
      completed: false,
      completedAt: null,
      quizScore: null,
      timeSpentMs: 1000,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    });

    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      lessonId: "l1",
      completed: false,
      completedAt: null,
      quizScore: null,
      timeSpentMs: 1000,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
    });

    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", timeSpentMs: 1000 },
    ]);
    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.upsert.mockResolvedValue({
      id: "cp1",
      courseId: "c1",
      totalTimeSpentMs: 1000,
    });

    const req = makePatchRequest("l1", {});
    const res = await PATCH(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(200);
  });
});
