/**
 * Tests for GET/DELETE /api/lessons/[id]/chat — chat history persistence routes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: { findUnique: vi.fn(), findFirst: vi.fn() },
    chatMessage: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET, DELETE } from "@/app/api/lessons/[id]/chat/route";

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/lessons/[id]/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns messages ordered by createdAt (200)", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.chatMessage.findMany.mockResolvedValue([
      { id: "m1", lessonId: "l1", role: "user", content: "Hello", createdAt: new Date("2025-01-01") },
      { id: "m2", lessonId: "l1", role: "assistant", content: "Hi!", createdAt: new Date("2025-01-02") },
    ]);

    const req = new NextRequest("http://localhost/api/lessons/l1/chat");
    const res = await GET(req, makeParams("l1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].role).toBe("user");
    expect(body[1].role).toBe("assistant");
  });

  it("returns empty array when no messages (200)", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/lessons/l1/chat");
    const res = await GET(req, makeParams("l1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns 404 when lesson not found", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/lessons/nonexistent/chat");
    const res = await GET(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
  });

  it("limits to 50 messages", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/lessons/l1/chat");
    await GET(req, makeParams("l1"));

    // Verify findMany was called with take: 50
    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });
});

describe("DELETE /api/lessons/[id]/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes all messages and returns 204", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.chatMessage.deleteMany.mockResolvedValue({ count: 5 });

    const req = new NextRequest("http://localhost/api/lessons/l1/chat", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("l1"));

    expect(res.status).toBe(204);
    expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
      where: { lessonId: "l1", userId: "test-user-id" },
    });
  });

  it("returns 404 when lesson not found", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/lessons/nonexistent/chat", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
  });
});
