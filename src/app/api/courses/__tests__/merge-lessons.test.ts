/**
 * Tests for POST /api/courses/[id]/lessons/merge
 * Merge two adjacent lessons into one.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  const txMock = {
    lesson: {
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return {
    mockPrisma: {
      course: {
        findFirst: vi.fn(),
      },
      lesson: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
      _tx: txMock,
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/courses/[id]/lessons/merge/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeReq(courseId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/courses/${courseId}/lessons/merge`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

// ─── Test Data ────────────────────────────────────────────────────────────────
const lesson1 = {
  id: "l1", courseId: "c1", title: "Ch 1", order: 1,
  transcript: "First chapter content",
  summary: "old summary", explanation: "old", quiz: "old", flashcards: "old", exercises: "old",
};
const lesson2 = {
  id: "l2", courseId: "c1", title: "Ch 2", order: 2,
  transcript: "Second chapter content",
  summary: "s2", explanation: "e2", quiz: "q2", flashcards: "f2", exercises: "ex2",
};

// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/courses/[id]/lessons/merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1", userId: "test-user-id" });
    // Reset $transaction to use callback pattern
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockPrisma._tx) => Promise<unknown>) => cb(mockPrisma._tx)
    );
  });

  it("merges adjacent lessons — transcripts concatenated, second deleted, orders renumbered", async () => {
    mockPrisma.lesson.findUnique
      .mockResolvedValueOnce(lesson1)
      .mockResolvedValueOnce(lesson2);

    const mergedLesson = {
      ...lesson1,
      transcript: "First chapter content\n\nSecond chapter content",
      summary: null, explanation: null, quiz: null, flashcards: null, exercises: null,
    };
    mockPrisma._tx.lesson.update.mockResolvedValueOnce(mergedLesson);
    mockPrisma._tx.lesson.delete.mockResolvedValue(undefined);
    mockPrisma._tx.lesson.findMany
      .mockResolvedValueOnce([{ id: "l1" }]) // remaining for reorder
      .mockResolvedValueOnce([mergedLesson]); // final list
    mockPrisma._tx.lesson.update.mockResolvedValue(undefined); // reorder updates

    const res = await POST(makeReq("c1", { lessonId1: "l1", lessonId2: "l2" }), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.merged).toBeDefined();
    expect(data.lessons).toBeDefined();
    expect(mockPrisma._tx.lesson.delete).toHaveBeenCalledWith({ where: { id: "l2" } });
  });

  it("returns 400 if lessons are not adjacent", async () => {
    const nonAdjLesson2 = { ...lesson2, order: 3 };
    mockPrisma.lesson.findUnique
      .mockResolvedValueOnce(lesson1)
      .mockResolvedValueOnce(nonAdjLesson2);

    const res = await POST(makeReq("c1", { lessonId1: "l1", lessonId2: "l2" }), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("adjacent");
  });

  it("returns 400 if lessons belong to different courses", async () => {
    const wrongCourse = { ...lesson2, courseId: "other" };
    mockPrisma.lesson.findUnique
      .mockResolvedValueOnce(lesson1)
      .mockResolvedValueOnce(wrongCourse);

    const res = await POST(makeReq("c1", { lessonId1: "l1", lessonId2: "l2" }), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("returns 404 if either lesson not found", async () => {
    mockPrisma.lesson.findUnique
      .mockResolvedValueOnce(lesson1)
      .mockResolvedValueOnce(null);

    const res = await POST(makeReq("c1", { lessonId1: "l1", lessonId2: "l2" }), makeParams("c1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid Zod body", async () => {
    const res = await POST(makeReq("c1", { bad: "data" }), makeParams("c1"));
    expect(res.status).toBe(400);
  });

  it("clears AI fields on merged lesson", async () => {
    mockPrisma.lesson.findUnique
      .mockResolvedValueOnce(lesson1)
      .mockResolvedValueOnce(lesson2);

    const mergedLesson = { ...lesson1, transcript: "merged", summary: null, explanation: null, quiz: null, flashcards: null, exercises: null };
    mockPrisma._tx.lesson.update.mockResolvedValueOnce(mergedLesson);
    mockPrisma._tx.lesson.delete.mockResolvedValue(undefined);
    mockPrisma._tx.lesson.findMany
      .mockResolvedValueOnce([{ id: "l1" }])
      .mockResolvedValueOnce([mergedLesson]);

    await POST(makeReq("c1", { lessonId1: "l1", lessonId2: "l2" }), makeParams("c1"));

    const updateCall = mockPrisma._tx.lesson.update.mock.calls[0];
    expect(updateCall[0].data.summary).toBeNull();
    expect(updateCall[0].data.explanation).toBeNull();
    expect(updateCall[0].data.quiz).toBeNull();
    expect(updateCall[0].data.flashcards).toBeNull();
    expect(updateCall[0].data.exercises).toBeNull();
  });

  it("handles null transcripts gracefully", async () => {
    const nullT1 = { ...lesson1, transcript: null };
    const nullT2 = { ...lesson2, transcript: "has content" };
    mockPrisma.lesson.findUnique
      .mockResolvedValueOnce(nullT1)
      .mockResolvedValueOnce(nullT2);

    const mergedLesson = { ...nullT1, transcript: "has content" };
    mockPrisma._tx.lesson.update.mockResolvedValueOnce(mergedLesson);
    mockPrisma._tx.lesson.delete.mockResolvedValue(undefined);
    mockPrisma._tx.lesson.findMany
      .mockResolvedValueOnce([{ id: "l1" }])
      .mockResolvedValueOnce([mergedLesson]);

    const res = await POST(makeReq("c1", { lessonId1: "l1", lessonId2: "l2" }), makeParams("c1"));
    expect(res.status).toBe(200);

    const updateCall = mockPrisma._tx.lesson.update.mock.calls[0];
    expect(updateCall[0].data.transcript).toBe("has content");
  });
});
