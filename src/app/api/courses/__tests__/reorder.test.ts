/**
 * Integration tests for PATCH /api/courses/[id]/lessons/reorder.
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

import { PATCH } from "@/app/api/courses/[id]/lessons/reorder/route";

function makeRequest(courseId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/courses/${courseId}/lessons/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("PATCH /api/courses/[id]/lessons/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reorders lessons successfully and returns 200", async () => {
    const course = { id: "c1", title: "Course 1" };
    mockPrisma.course.findUnique.mockResolvedValue(course);
    mockPrisma.$transaction.mockResolvedValue(undefined);

    const req = makeRequest("c1", { lessonIds: ["l3", "l1", "l2"] });
    const res = await PATCH(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const req = makeRequest("nonexistent", { lessonIds: ["l1"] });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBeDefined();
  });

  it("passes correct order (index + 1) to each lesson update", async () => {
    const course = { id: "c1", title: "Course 1" };
    mockPrisma.course.findUnique.mockResolvedValue(course);
    mockPrisma.$transaction.mockResolvedValue(undefined);

    const req = makeRequest("c1", { lessonIds: ["l2", "l1"] });
    await PATCH(req, { params: Promise.resolve({ id: "c1" }) });

    // The route builds update promises via .map() before passing to $transaction.
    // lesson.update is called synchronously during the .map(), so we can assert here.
    expect(mockPrisma.lesson.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l2" },
      data: { order: 1 },
    });
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { order: 2 },
    });
  });

  it("returns 400 for empty lessonIds array", async () => {
    const req = makeRequest("c1", { lessonIds: [] });
    const res = await PATCH(req, { params: Promise.resolve({ id: "c1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing lessonIds field", async () => {
    const req = makeRequest("c1", {});
    const res = await PATCH(req, { params: Promise.resolve({ id: "c1" }) });

    expect(res.status).toBe(400);
  });
});
