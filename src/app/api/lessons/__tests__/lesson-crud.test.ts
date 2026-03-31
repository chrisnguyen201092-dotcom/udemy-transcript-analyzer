/**
 * Integration tests for DELETE /api/lessons/[id].
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

import { DELETE } from "@/app/api/lessons/[id]/route";

// ── DELETE /api/lessons/[id] ────────────────────────────────────────────

describe("DELETE /api/lessons/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes lesson successfully and returns 200 with success flag", async () => {
    mockPrisma.lesson.delete.mockResolvedValue({ id: "l1" });

    const req = new NextRequest("http://localhost/api/lessons/l1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockPrisma.lesson.delete).toHaveBeenCalledWith({
      where: { id: "l1" },
    });
  });

  it("calls prisma.lesson.delete with the correct lesson id", async () => {
    mockPrisma.lesson.delete.mockResolvedValue({ id: "l2" });

    const req = new NextRequest("http://localhost/api/lessons/l2", {
      method: "DELETE",
    });
    await DELETE(req, { params: Promise.resolve({ id: "l2" }) });

    expect(mockPrisma.lesson.delete).toHaveBeenCalledWith({
      where: { id: "l2" },
    });
  });

  it("propagates prisma error as 500 when delete fails", async () => {
    mockPrisma.lesson.delete.mockRejectedValue(new Error("DB error"));

    const req = new NextRequest("http://localhost/api/lessons/bad", {
      method: "DELETE",
    });

    await expect(
      DELETE(req, { params: Promise.resolve({ id: "bad" }) })
    ).rejects.toThrow("DB error");
  });
});
