import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET, PUT } from "@/app/api/lessons/[id]/notes/route";

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/lessons/l1/notes", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/lessons/[id]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notes when they exist", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      notes: "My lesson notes",
      updatedAt: now,
    });

    const res = await GET(makeRequest("GET"), routeParams("l1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      lessonId: "l1",
      notes: "My lesson notes",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(mockPrisma.lesson.findUnique).toHaveBeenCalledWith({
      where: { id: "l1" },
      select: { id: true, notes: true, updatedAt: true },
    });
  });

  it("returns null notes for lesson with no notes", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      notes: null,
      updatedAt: now,
    });

    const res = await GET(makeRequest("GET"), routeParams("l1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toBeNull();
  });

  it("returns 404 for non-existent lesson", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("GET"), routeParams("not-exist"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Lesson not found");
  });
});

describe("PUT /api/lessons/[id]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves notes successfully", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    mockPrisma.lesson.findUnique.mockResolvedValue({ id: "l1" });
    mockPrisma.lesson.update.mockResolvedValue({
      id: "l1",
      notes: "Updated notes",
      updatedAt: now,
    });

    const res = await PUT(
      makeRequest("PUT", { notes: "Updated notes" }),
      routeParams("l1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      id: "l1",
      notes: "Updated notes",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { notes: "Updated notes" },
      select: { id: true, notes: true, updatedAt: true },
    });
  });

  it("clears notes with empty string", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    mockPrisma.lesson.findUnique.mockResolvedValue({ id: "l1" });
    mockPrisma.lesson.update.mockResolvedValue({
      id: "l1",
      notes: "",
      updatedAt: now,
    });

    const res = await PUT(
      makeRequest("PUT", { notes: "" }),
      routeParams("l1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toBe("");
  });

  it("returns 400 when notes field is missing", async () => {
    const res = await PUT(makeRequest("PUT", {}), routeParams("l1"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("notes");
  });

  it("returns 400 when notes is not a string", async () => {
    const res = await PUT(makeRequest("PUT", { notes: 123 }), routeParams("l1"));
    expect(res.status).toBe(400);

    const res2 = await PUT(makeRequest("PUT", { notes: null }), routeParams("l1"));
    expect(res2.status).toBe(400);
  });

  it("returns 404 for non-existent lesson", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const res = await PUT(
      makeRequest("PUT", { notes: "some notes" }),
      routeParams("not-exist")
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Lesson not found");
  });
});
