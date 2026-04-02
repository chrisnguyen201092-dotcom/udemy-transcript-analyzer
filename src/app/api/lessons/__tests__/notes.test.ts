import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    lessonArtifact: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
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
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1",
      updatedAt: now,
    });
    mockPrisma.lessonArtifact.findUnique.mockResolvedValue({
      content: "My lesson notes",
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
    expect(mockPrisma.lesson.findFirst).toHaveBeenCalledWith({
      where: { id: "l1", course: { userId: "test-user-id" } },
      select: { id: true, updatedAt: true },
    });
  });

  it("returns null notes for lesson with no notes", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1",
      updatedAt: now,
    });
    mockPrisma.lessonArtifact.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("GET"), routeParams("l1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toBeNull();
  });

  it("returns 404 for non-existent lesson", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue(null);

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
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.lessonArtifact.upsert.mockResolvedValue({
      content: "Updated notes",
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
    expect(mockPrisma.lessonArtifact.upsert).toHaveBeenCalledWith({
      where: { userId_lessonId_type: { userId: "test-user-id", lessonId: "l1", type: "notes" } },
      create: { userId: "test-user-id", lessonId: "l1", type: "notes", content: "Updated notes" },
      update: { content: "Updated notes" },
      select: { content: true, updatedAt: true },
    });
  });

  it("clears notes with empty string", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.lessonArtifact.upsert.mockResolvedValue({
      content: "",
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
    mockPrisma.lesson.findFirst.mockResolvedValue(null);

    const res = await PUT(
      makeRequest("PUT", { notes: "some notes" }),
      routeParams("not-exist")
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Lesson not found");
  });
});

// ── Edge case tests ──────────────────────────────────────────────────────────

describe("Notes edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles very long notes >100KB", async () => {
    const longNote = "A".repeat(100_001);
    const now = new Date("2025-01-01T00:00:00Z");
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.lessonArtifact.upsert.mockResolvedValue({
      content: longNote,
      updatedAt: now,
    });

    const res = await PUT(
      makeRequest("PUT", { notes: longNote }),
      routeParams("l1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toHaveLength(100_001);
    expect(mockPrisma.lessonArtifact.upsert).toHaveBeenCalledWith({
      where: { userId_lessonId_type: { userId: "test-user-id", lessonId: "l1", type: "notes" } },
      create: { userId: "test-user-id", lessonId: "l1", type: "notes", content: longNote },
      update: { content: longNote },
      select: { content: true, updatedAt: true },
    });
  });

  it("PUT overwrites existing notes completely", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.lessonArtifact.upsert.mockResolvedValue({
      content: "new notes only",
      updatedAt: now,
    });

    const res = await PUT(
      makeRequest("PUT", { notes: "new notes only" }),
      routeParams("l1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toBe("new notes only");
    // Verify upsert was called with the new value, not appending
    expect(mockPrisma.lessonArtifact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { content: "new notes only" } })
    );
  });

  it("GET returns null for null notes", async () => {
    const now = new Date("2025-01-01T00:00:00Z");
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: "l1",
      updatedAt: now,
    });
    mockPrisma.lessonArtifact.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("GET"), routeParams("l1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toBeNull();
    // Verify the response structure is complete
    expect(data.lessonId).toBe("l1");
    expect(data.updatedAt).toBeDefined();
  });
});
