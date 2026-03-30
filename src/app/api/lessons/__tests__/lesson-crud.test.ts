/**
 * Integration tests for DELETE /api/lessons/[id] and PATCH /api/lessons/[id].
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

import { DELETE, PATCH } from "@/app/api/lessons/[id]/route";

// ── DELETE /api/lessons/[id] ────────────────────────────────────────────

describe("DELETE /api/lessons/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes lesson successfully and returns 200", async () => {
    const lesson = { id: "l1", title: "Lesson 1", courseId: "c1" };
    mockPrisma.lesson.findUnique.mockResolvedValue(lesson);
    mockPrisma.lesson.delete.mockResolvedValue(lesson);

    const req = new NextRequest("http://localhost/api/lessons/l1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.deletedId).toBe("l1");
    expect(mockPrisma.lesson.delete).toHaveBeenCalledWith({
      where: { id: "l1" },
    });
  });

  it("returns 404 when lesson not found", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/lessons/nonexistent", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBeDefined();
  });

  it("calls prisma.lesson.delete for cascade cleanup", async () => {
    const lesson = { id: "l2", title: "Lesson 2", courseId: "c1" };
    mockPrisma.lesson.findUnique.mockResolvedValue(lesson);
    mockPrisma.lesson.delete.mockResolvedValue(lesson);

    const req = new NextRequest("http://localhost/api/lessons/l2", {
      method: "DELETE",
    });
    await DELETE(req, { params: Promise.resolve({ id: "l2" }) });

    expect(mockPrisma.lesson.delete).toHaveBeenCalledWith({
      where: { id: "l2" },
    });
  });
});

// ── PATCH /api/lessons/[id] (rename) ────────────────────────────────────

describe("PATCH /api/lessons/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renames lesson successfully and returns 200", async () => {
    const existing = { id: "l1", title: "Old Title", courseId: "c1" };
    const updated = {
      id: "l1",
      title: "New Title",
      updatedAt: new Date().toISOString(),
    };
    mockPrisma.lesson.findUnique.mockResolvedValue(existing);
    mockPrisma.lesson.update.mockResolvedValue(updated);

    const req = new NextRequest("http://localhost/api/lessons/l1", {
      method: "PATCH",
      body: JSON.stringify({ title: "New Title" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("l1");
    expect(json.title).toBe("New Title");
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { title: "New Title" },
      select: { id: true, title: true, updatedAt: true },
    });
  });

  it("returns 404 when lesson not found", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/lessons/nonexistent", {
      method: "PATCH",
      body: JSON.stringify({ title: "New" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBeDefined();
  });

  it("returns 400 for empty title", async () => {
    const req = new NextRequest("http://localhost/api/lessons/l1", {
      method: "PATCH",
      body: JSON.stringify({ title: "" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 400 for title exceeding 200 characters", async () => {
    const longTitle = "A".repeat(201);
    const req = new NextRequest("http://localhost/api/lessons/l1", {
      method: "PATCH",
      body: JSON.stringify({ title: longTitle }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "l1" }) });

    expect(res.status).toBe(400);
  });
});
