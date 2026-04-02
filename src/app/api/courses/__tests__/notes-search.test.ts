import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    course: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    lesson: {
      findMany: vi.fn(),
    },
    lessonArtifact: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/courses/[id]/notes/search/route";

function makeSearchRequest(courseId: string, query?: string): NextRequest {
  const url = query !== undefined
    ? `http://localhost/api/courses/${courseId}/notes/search?q=${encodeURIComponent(query)}`
    : `http://localhost/api/courses/${courseId}/notes/search`;
  return new NextRequest(url, { method: "GET" });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const now = new Date("2025-01-01T00:00:00Z");

describe("GET /api/courses/[id]/notes/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching lessons with snippets", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1" });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      {
        id: "a1",
        userId: "test-user-id",
        lessonId: "l1",
        type: "notes",
        content: "This is a test note about JavaScript basics",
        updatedAt: now,
        lesson: { id: "l1", title: "Lesson 1", order: 1 },
      },
    ]);

    const res = await GET(makeSearchRequest("c1", "JavaScript"), routeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.query).toBe("JavaScript");
    expect(data.results).toHaveLength(1);
    expect(data.results[0].lessonId).toBe("l1");
    expect(data.results[0].lessonTitle).toBe("Lesson 1");
    expect(data.results[0].lessonOrder).toBe(1);
    expect(data.results[0].snippet).toContain("JavaScript");
  });

  it("returns empty results when no match", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1" });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([]);

    const res = await GET(makeSearchRequest("c1", "nonexistent"), routeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toEqual([]);
  });

  it("returns 400 when q is missing", async () => {
    const res = await GET(makeSearchRequest("c1"), routeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("q");
  });

  it("returns 400 when q is empty string", async () => {
    const res = await GET(makeSearchRequest("c1", ""), routeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("q");
  });

  it("returns 400 when q is only whitespace", async () => {
    const res = await GET(makeSearchRequest("c1", "   "), routeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("q");
  });

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const res = await GET(makeSearchRequest("not-exist", "test"), routeParams("not-exist"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Course not found");
  });

  it("generates snippet with keyword at start of text", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1" });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      {
        id: "a1",
        userId: "test-user-id",
        lessonId: "l1",
        type: "notes",
        content: "JavaScript is great for web development and building modern applications",
        updatedAt: now,
        lesson: { id: "l1", title: "Lesson 1", order: 1 },
      },
    ]);

    const res = await GET(makeSearchRequest("c1", "JavaScript"), routeParams("c1"));
    const data = await res.json();

    // Keyword at start → no leading "..."
    expect(data.results[0].snippet).not.toMatch(/^\.\.\./);
    expect(data.results[0].snippet).toContain("JavaScript");
  });

  it("generates snippet with keyword in middle of long text", async () => {
    const longPrefix = "A".repeat(100);
    const longSuffix = "B".repeat(100);
    const content = `${longPrefix}KEYWORD${longSuffix}`;

    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1" });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      {
        id: "a1",
        userId: "test-user-id",
        lessonId: "l1",
        type: "notes",
        content,
        updatedAt: now,
        lesson: { id: "l1", title: "Lesson 1", order: 1 },
      },
    ]);

    const res = await GET(makeSearchRequest("c1", "KEYWORD"), routeParams("c1"));
    const data = await res.json();

    const snippet = data.results[0].snippet;
    // Should have leading and trailing "..." for middle keyword
    expect(snippet).toMatch(/^\.\.\./);
    expect(snippet).toMatch(/\.\.\.$/);
    expect(snippet).toContain("KEYWORD");
  });

  it("returns results sorted by lesson order", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1" });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      { id: "a1", userId: "test-user-id", lessonId: "l1", type: "notes", content: "test content", updatedAt: now, lesson: { id: "l1", title: "First", order: 1 } },
      { id: "a2", userId: "test-user-id", lessonId: "l2", type: "notes", content: "test content here", updatedAt: now, lesson: { id: "l2", title: "Second", order: 2 } },
      { id: "a3", userId: "test-user-id", lessonId: "l3", type: "notes", content: "more test stuff", updatedAt: now, lesson: { id: "l3", title: "Third", order: 3 } },
    ]);

    const res = await GET(makeSearchRequest("c1", "test"), routeParams("c1"));
    const data = await res.json();

    expect(data.results).toHaveLength(3);
    expect(data.results[0].lessonOrder).toBe(1);
    expect(data.results[1].lessonOrder).toBe(2);
    expect(data.results[2].lessonOrder).toBe(3);

    // Verify orderBy was passed to prisma
    expect(mockPrisma.lessonArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { lesson: { order: "asc" } } })
    );
  });
});

// ─── Edge-case tests (gap analysis) ──────────────────────────────────────────

describe("GET /api/courses/[id]/notes/search — edge cases", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("search handles special regex characters in query without crashing", async () => {
    // The route uses Prisma `contains` (not regex), so special chars are safe
    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1" });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      {
        id: "a1",
        userId: "test-user-id",
        lessonId: "l1",
        type: "notes",
        content: "Use test.+value in your regex patterns",
        updatedAt: now,
        lesson: { id: "l1", title: "Lesson 1", order: 1 },
      },
    ]);

    const res = await GET(makeSearchRequest("c1", "test.+value"), routeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    // Should not crash — Prisma `contains` treats query as literal string
    expect(data.results).toHaveLength(1);
    expect(data.results[0].snippet).toContain("test.+value");
  });

  it("search is case-insensitive (snippet extraction uses toLowerCase)", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1" });
    // Prisma `contains` on SQLite is case-insensitive by default
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      {
        id: "a1",
        userId: "test-user-id",
        lessonId: "l1",
        type: "notes",
        content: "Learn about JAVASCRIPT and its ecosystem",
        updatedAt: now,
        lesson: { id: "l1", title: "Lesson 1", order: 1 },
      },
    ]);

    const res = await GET(makeSearchRequest("c1", "javascript"), routeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    // Snippet should contain the original casing from the notes
    expect(data.results[0].snippet).toContain("JAVASCRIPT");
  });
});
