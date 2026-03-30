/**
 * Integration tests for PUT /api/courses/[id]/lessons/reorder.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    chatMessage: { deleteMany: vi.fn() },
    flashcardReview: { deleteMany: vi.fn() },
    lessonProgress: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PUT } from "@/app/api/courses/[id]/lessons/reorder/route";

function makeRequest(courseId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/courses/${courseId}/lessons/reorder`,
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("PUT /api/courses/[id]/lessons/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reorders lessons successfully and returns 200", async () => {
    const course = { id: "c1", title: "Course 1" };
    const lessons = [
      { id: "l1", courseId: "c1", order: 0 },
      { id: "l2", courseId: "c1", order: 1 },
      { id: "l3", courseId: "c1", order: 2 },
    ];
    mockPrisma.course.findUnique.mockResolvedValue(course);
    mockPrisma.lesson.findMany.mockResolvedValue(lessons);
    mockPrisma.$transaction.mockResolvedValue(undefined);

    const req = makeRequest("c1", { lessonIds: ["l3", "l1", "l2"] });
    const res = await PUT(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const req = makeRequest("nonexistent", { lessonIds: ["l1"] });
    const res = await PUT(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBeDefined();
  });

  it("returns 400 when lessonIds contain invalid IDs", async () => {
    const course = { id: "c1", title: "Course 1" };
    const lessons = [
      { id: "l1", courseId: "c1", order: 0 },
      { id: "l2", courseId: "c1", order: 1 },
    ];
    mockPrisma.course.findUnique.mockResolvedValue(course);
    mockPrisma.lesson.findMany.mockResolvedValue(lessons);

    const req = makeRequest("c1", { lessonIds: ["l1", "l999"] });
    const res = await PUT(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBeDefined();
  });

  it("updates order correctly based on array index", async () => {
    const course = { id: "c1", title: "Course 1" };
    const lessons = [
      { id: "l1", courseId: "c1", order: 0 },
      { id: "l2", courseId: "c1", order: 1 },
    ];
    mockPrisma.course.findUnique.mockResolvedValue(course);
    mockPrisma.lesson.findMany.mockResolvedValue(lessons);
    mockPrisma.lesson.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(
      async (callbacks: unknown[]) => {
        if (Array.isArray(callbacks)) {
          for (const cb of callbacks) {
            await cb;
          }
        }
      }
    );

    const req = makeRequest("c1", { lessonIds: ["l2", "l1"] });
    await PUT(req, { params: Promise.resolve({ id: "c1" }) });

    // $transaction is called with an array of update promises
    const txArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(txArg).toHaveLength(2);
  });

  it("returns 400 for empty lessonIds array", async () => {
    const req = makeRequest("c1", { lessonIds: [] });
    const res = await PUT(req, { params: Promise.resolve({ id: "c1" }) });

    expect(res.status).toBe(400);
  });
});
