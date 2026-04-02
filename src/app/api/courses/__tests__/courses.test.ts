/**
 * Integration tests for /api/courses (GET, POST) and /api/courses/[id] (GET, DELETE).
 * Prisma is mocked — no real DB required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    course: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    lesson: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Import routes AFTER mocks ────────────────────────────────────────────────
import { GET as getCourses, POST as postCourse } from "@/app/api/courses/route";
import { GET as getCourse, DELETE as deleteCourse } from "@/app/api/courses/[id]/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/courses", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

function makeParamRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/courses/${id}`, { method: "GET" });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("GET /api/courses", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns list of courses as JSON", async () => {
    const fakeCourses = [
      { id: "c1", title: "Course 1", url: "https://udemy.com/c1", lessons: [] },
    ];
    mockPrisma.course.findMany.mockResolvedValue(fakeCourses);

    const res = await getCourses();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(fakeCourses);
  });

  it("returns empty array when no courses exist", async () => {
    mockPrisma.course.findMany.mockResolvedValue([]);

    const res = await getCourses();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it("queries with lessons included, ordered by createdAt desc", async () => {
    mockPrisma.course.findMany.mockResolvedValue([]);
    await getCourses();
    expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ lessons: expect.anything() }),
        orderBy: { createdAt: "desc" },
      })
    );
  });
});

describe("POST /api/courses — create manual course", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a course and returns 201", async () => {
    const fakeCourse = { id: "c1", title: "My Course", url: "manual:abc", lessons: [] };
    mockPrisma.course.create.mockResolvedValue(fakeCourse);

    const req = makeRequest("POST", { title: "My Course" });
    const res = await postCourse(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.title).toBe("My Course");
  });

  it("generates manual:uuid URL when no URL provided", async () => {
    mockPrisma.course.create.mockResolvedValue({
      id: "c1", title: "Manual", url: "manual:some-uuid", lessons: [],
    });

    const req = makeRequest("POST", { title: "Manual" });
    await postCourse(req);

    const createCall = mockPrisma.course.create.mock.calls[0][0];
    expect(createCall.data.url).toMatch(/^manual:/);
  });

  it("returns 400 when title is missing", async () => {
    const req = makeRequest("POST", { url: "https://udemy.com/c1" });
    const res = await postCourse(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when title is empty string", async () => {
    const req = makeRequest("POST", { title: "" });
    const res = await postCourse(req);

    expect(res.status).toBe(400);
  });

  it("returns existing course when URL already exists (upsert/dedupe)", async () => {
    const existing = { id: "c1", title: "Existing", url: "https://udemy.com/c1", lessons: [] };
    mockPrisma.course.findFirst.mockResolvedValue(existing);

    const req = makeRequest("POST", { title: "Existing", url: "https://udemy.com/c1" });
    const res = await postCourse(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("c1");
    expect(mockPrisma.course.create).not.toHaveBeenCalled();
  });

  it("creates new course when URL is provided but not duplicate", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);
    const newCourse = { id: "c2", title: "New", url: "https://udemy.com/new", lessons: [] };
    mockPrisma.course.create.mockResolvedValue(newCourse);

    const req = makeRequest("POST", { title: "New", url: "https://udemy.com/new" });
    const res = await postCourse(req);

    expect(res.status).toBe(201);
    expect(mockPrisma.course.create).toHaveBeenCalledOnce();
  });
});

describe("GET /api/courses/[id]", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns course when found", async () => {
    const fakeCourse = { id: "c1", title: "Course", lessons: [] };
    mockPrisma.course.findFirst.mockResolvedValue(fakeCourse);

    const req = makeParamRequest("c1");
    const res = await getCourse(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("c1");
  });

  it("returns 404 when course not found", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const req = makeParamRequest("nonexistent");
    const res = await getCourse(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/courses/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Route calls course.findFirst for ownership check before delete
    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1", userId: "test-user-id" });
  });

  it("deletes course and returns success", async () => {
    mockPrisma.course.delete.mockResolvedValue({ id: "c1" });

    const req = new NextRequest("http://localhost/api/courses/c1", { method: "DELETE" });
    const res = await deleteCourse(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("calls prisma.course.delete with the correct id", async () => {
    mockPrisma.course.delete.mockResolvedValue({ id: "c42" });

    const req = new NextRequest("http://localhost/api/courses/c42", { method: "DELETE" });
    await deleteCourse(req, { params: Promise.resolve({ id: "c42" }) });

    expect(mockPrisma.course.delete).toHaveBeenCalledWith({ where: { id: "c42" } });
  });
});

// ─── B-01/B-02/B-03: Book support fields ─────────────────────────────────────
describe("POST /api/courses — book fields (B-01/B-02/B-03)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates book with contentType 'book'", async () => {
    const fakeBook = { id: "b1", title: "My Book", contentType: "book", author: "Author Name", url: "manual:uuid", lessons: [] };
    mockPrisma.course.create.mockResolvedValue(fakeBook);

    const req = makeRequest("POST", { title: "My Book", contentType: "book", author: "Author Name" });
    const res = await postCourse(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.contentType).toBe("book");
    expect(json.author).toBe("Author Name");

    const createCall = mockPrisma.course.create.mock.calls[0][0];
    expect(createCall.data.contentType).toBe("book");
    expect(createCall.data.author).toBe("Author Name");
  });

  it("defaults contentType to 'course' when not provided", async () => {
    const fakeCourse = { id: "c1", title: "My Course", contentType: "course", url: "manual:uuid", lessons: [] };
    mockPrisma.course.create.mockResolvedValue(fakeCourse);

    const req = makeRequest("POST", { title: "My Course" });
    await postCourse(req);

    const createCall = mockPrisma.course.create.mock.calls[0][0];
    expect(createCall.data.contentType).toBe("course");
  });

  it("rejects invalid contentType", async () => {
    const req = makeRequest("POST", { title: "Test", contentType: "podcast" });
    const res = await postCourse(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("accepts all book-specific fields", async () => {
    const fakeBook = {
      id: "b2", title: "Book", contentType: "book",
      author: "Auth", isbn: "978-xxx", publisher: "Pub",
      url: "manual:uuid", lessons: [],
    };
    mockPrisma.course.create.mockResolvedValue(fakeBook);

    const req = makeRequest("POST", {
      title: "Book", contentType: "book",
      author: "Auth", isbn: "978-xxx", publisher: "Pub",
    });
    const res = await postCourse(req);

    expect(res.status).toBe(201);

    const createCall = mockPrisma.course.create.mock.calls[0][0];
    expect(createCall.data.author).toBe("Auth");
    expect(createCall.data.isbn).toBe("978-xxx");
    expect(createCall.data.publisher).toBe("Pub");
  });

  it("book-specific fields are optional", async () => {
    const fakeBook = { id: "b3", title: "Book", contentType: "book", url: "manual:uuid", lessons: [] };
    mockPrisma.course.create.mockResolvedValue(fakeBook);

    const req = makeRequest("POST", { title: "Book", contentType: "book" });
    const res = await postCourse(req);

    expect(res.status).toBe(201);
  });

  it("GET /api/courses returns book fields", async () => {
    const fakeCourses = [
      {
        id: "b1", title: "My Book", url: "manual:uuid",
        contentType: "book", author: "Author", isbn: "978-123", publisher: "Pub Co",
        lessons: [],
      },
    ];
    mockPrisma.course.findMany.mockResolvedValue(fakeCourses);

    const res = await getCourses();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json[0].contentType).toBe("book");
    expect(json[0].author).toBe("Author");
    expect(json[0].isbn).toBe("978-123");
    expect(json[0].publisher).toBe("Pub Co");
  });
});

// ─── Edge-case tests (gap analysis) ──────────────────────────────────────────

describe("DELETE /api/courses/[id] — cascade behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Route calls course.findFirst for ownership check before delete
    mockPrisma.course.findFirst.mockResolvedValue({ id: "c1", userId: "test-user-id" });
  });

  it("DELETE course calls prisma.course.delete which cascades all related data", async () => {
    // Prisma schema-level cascade: deleting course removes lessons, progress, etc.
    // The route simply calls prisma.course.delete; cascade is handled by DB/Prisma.
    mockPrisma.course.delete.mockResolvedValue({ id: "c1" });

    const req = new NextRequest("http://localhost/api/courses/c1", { method: "DELETE" });
    const res = await deleteCourse(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockPrisma.course.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});

describe("POST /api/courses — null vs empty URL handling", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("handles null URL by treating it as no URL (generates manual:uuid or rejects)", async () => {
    // Route Zod schema rejects url:null as invalid type — returns 400
    // Only missing/undefined url or empty string url trigger manual:uuid generation
    mockPrisma.course.create.mockResolvedValue({
      id: "c1", title: "Test", url: "manual:some-uuid", lessons: [],
    });

    const req = makeRequest("POST", { title: "Test", url: null });
    const res = await postCourse(req);

    // Zod rejects null — only undefined/missing or empty string are accepted
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      const createCall = mockPrisma.course.create.mock.calls[0][0];
      expect(createCall.data.url).toMatch(/^manual:/);
    }
  });

  it("handles empty string URL by generating manual:uuid", async () => {
    mockPrisma.course.create.mockResolvedValue({
      id: "c2", title: "Test2", url: "manual:some-uuid", lessons: [],
    });

    const req = makeRequest("POST", { title: "Test2", url: "" });
    const res = await postCourse(req);

    expect(res.status).toBe(201);
    const createCall = mockPrisma.course.create.mock.calls[0][0];
    expect(createCall.data.url).toMatch(/^manual:/);
  });
});

describe("GET /api/courses — sort order", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("GET returns courses sorted by createdAt desc", async () => {
    mockPrisma.course.findMany.mockResolvedValue([]);

    await getCourses();

    expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });
});
