/**
 * Tests for POST /api/courses/[id]/lessons/split
 * Split one lesson into two at a given character index.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  const txMock = {
    lesson: {
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
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

import { POST } from "@/app/api/courses/[id]/lessons/split/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeReq(courseId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/courses/${courseId}/lessons/split`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

// ─── Test Data ────────────────────────────────────────────────────────────────
const lesson = {
  id: "l1", courseId: "c1", title: "Full Chapter", order: 2,
  transcript: "Top half content. Bottom half content.",
  summary: "old", explanation: "old", quiz: "old", flashcards: "old", exercises: "old",
};

// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/courses/[id]/lessons/split", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1", userId: "test-user-id" });
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockPrisma._tx) => Promise<unknown>) => cb(mockPrisma._tx)
    );
  });

  it("splits at valid index — original updated, new created, orders correct", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(lesson);

    const splitIdx = 18; // after "Top half content."
    const original = {
      ...lesson, transcript: "Top half content.",
      summary: null, explanation: null, quiz: null, flashcards: null, exercises: null,
    };
    const created = {
      id: "l-new", courseId: "c1", title: "New Ch", order: 3,
      transcript: "Bottom half content.",
      summary: null, explanation: null, quiz: null, flashcards: null, exercises: null,
    };
    mockPrisma._tx.lesson.update.mockResolvedValueOnce(original);
    mockPrisma._tx.lesson.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._tx.lesson.create.mockResolvedValue(created);
    mockPrisma._tx.lesson.findMany.mockResolvedValue([original, created]);

    const res = await POST(
      makeReq("c1", { lessonId: "l1", splitIndex: splitIdx, newTitle: "New Ch" }),
      makeParams("c1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.original).toBeDefined();
    expect(data.created).toBeDefined();
    expect(data.lessons).toHaveLength(2);
    expect(mockPrisma._tx.lesson.create).toHaveBeenCalled();
  });

  it("returns 400 if splitIndex out of bounds", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(lesson);

    const res = await POST(
      makeReq("c1", { lessonId: "l1", splitIndex: 999, newTitle: "X" }),
      makeParams("c1")
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("out of bounds");
  });

  it("returns 400 if no transcript", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({ ...lesson, transcript: null });

    const res = await POST(
      makeReq("c1", { lessonId: "l1", splitIndex: 5, newTitle: "X" }),
      makeParams("c1")
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("transcript");
  });

  it("returns 404 if lesson not found", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeReq("c1", { lessonId: "l1", splitIndex: 5, newTitle: "X" }),
      makeParams("c1")
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid Zod body", async () => {
    const res = await POST(makeReq("c1", { bad: true }), makeParams("c1"));
    expect(res.status).toBe(400);
  });

  it("clears AI fields on both original and new lesson", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(lesson);

    const original = { ...lesson, transcript: "Top half content.", summary: null, explanation: null, quiz: null, flashcards: null, exercises: null };
    const created = { id: "l-new", courseId: "c1", title: "New", order: 3, transcript: "Bottom half content." };
    mockPrisma._tx.lesson.update.mockResolvedValueOnce(original);
    mockPrisma._tx.lesson.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._tx.lesson.create.mockResolvedValue(created);
    mockPrisma._tx.lesson.findMany.mockResolvedValue([original, created]);

    await POST(
      makeReq("c1", { lessonId: "l1", splitIndex: 18, newTitle: "New" }),
      makeParams("c1")
    );

    // Original lesson AI fields cleared
    const updateCall = mockPrisma._tx.lesson.update.mock.calls[0];
    expect(updateCall[0].data.summary).toBeNull();
    expect(updateCall[0].data.explanation).toBeNull();
    expect(updateCall[0].data.quiz).toBeNull();
    expect(updateCall[0].data.flashcards).toBeNull();
    expect(updateCall[0].data.exercises).toBeNull();
  });

  it("increments subsequent lesson orders", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(lesson);

    const original = { ...lesson, transcript: "Top", summary: null, explanation: null, quiz: null, flashcards: null, exercises: null };
    const created = { id: "l-new", courseId: "c1", title: "New", order: 3, transcript: "half" };
    mockPrisma._tx.lesson.update.mockResolvedValueOnce(original);
    mockPrisma._tx.lesson.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma._tx.lesson.create.mockResolvedValue(created);
    mockPrisma._tx.lesson.findMany.mockResolvedValue([original, created]);

    await POST(
      makeReq("c1", { lessonId: "l1", splitIndex: 18, newTitle: "New" }),
      makeParams("c1")
    );

    expect(mockPrisma._tx.lesson.updateMany).toHaveBeenCalledWith({
      where: { courseId: "c1", order: { gt: lesson.order } },
      data: { order: { increment: 1 } },
    });
  });

  it("returns 400 if lesson belongs to different course", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({ ...lesson, courseId: "other" });

    const res = await POST(
      makeReq("c1", { lessonId: "l1", splitIndex: 5, newTitle: "X" }),
      makeParams("c1")
    );

    expect(res.status).toBe(400);
  });
});
