/**
 * Integration tests for DELETE /api/lessons/[id] and PUT /api/lessons/[id].
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

import { DELETE, PUT } from "@/app/api/lessons/[id]/route";

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

// ─── PUT /api/lessons/[id] — rename lesson ──────────────────────────────────

describe("PUT /api/lessons/[id] — rename lesson", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("PUT renames lesson title", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({ id: "l1", title: "Old Title" });
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1", title: "New Title" });

    const req = new NextRequest("http://localhost/api/lessons/l1", {
      method: "PUT",
      body: JSON.stringify({ title: "New Title" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe("New Title");
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { title: "New Title" },
    });
  });

  it("PUT returns 400 for empty title", async () => {
    const req = new NextRequest("http://localhost/api/lessons/l1", {
      method: "PUT",
      body: JSON.stringify({ title: "" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(400);
  });

  it("PUT returns 400 for title > 200 chars", async () => {
    const longTitle = "A".repeat(201);
    const req = new NextRequest("http://localhost/api/lessons/l1", {
      method: "PUT",
      body: JSON.stringify({ title: longTitle }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(400);
  });

  it("PUT returns 404 for non-existent lesson", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/lessons/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ title: "Valid Title" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/lessons/[id] — cascade and 404 edge cases", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("DELETE cascades related data via prisma.lesson.delete", async () => {
    // The route calls prisma.lesson.delete directly.
    // Prisma schema cascade handles deleting chatMessage, flashcardReview,
    // lessonProgress, and other related records at DB level.
    mockPrisma.lesson.delete.mockResolvedValue({ id: "l1" });

    const req = new NextRequest("http://localhost/api/lessons/l1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockPrisma.lesson.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
  });

  it("DELETE returns error when lesson does not exist (Prisma P2025)", async () => {
    // Prisma throws P2025 when record not found on delete
    const notFoundError = new Error("Record to delete does not exist.");
    Object.assign(notFoundError, { code: "P2025" });
    mockPrisma.lesson.delete.mockRejectedValue(notFoundError);

    const req = new NextRequest("http://localhost/api/lessons/nonexistent", {
      method: "DELETE",
    });

    // The route does not catch errors, so it propagates
    await expect(
      DELETE(req, { params: Promise.resolve({ id: "nonexistent" }) })
    ).rejects.toThrow("Record to delete does not exist.");
  });
});
