/**
 * Integration tests for AI persistence endpoints:
 * - GET /api/lessons/[id]/ai
 * - GET /api/courses/[id]/ai
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    lesson: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    lessonArtifact: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    learnerProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    courseProgress: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET as getLessonAI } from "@/app/api/lessons/[id]/ai/route";
import { GET as getCourseAI } from "@/app/api/courses/[id]/ai/route";

describe("GET /api/lessons/[id]/ai", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns all 5 AI fields as null when lesson has no AI data", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/lessons/l1/ai");
    const res = await getLessonAI(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      summary: null,
      explanation: null,
      quiz: null,
      flashcards: null,
      exercises: null,
    });
  });

  it("returns saved values when AI data exists", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([
      { type: "summary", content: "Summary content" },
      { type: "explanation", content: "Explanation content" },
      { type: "quiz", content: "Quiz content" },
      { type: "flashcards", content: "Flashcard content" },
      { type: "exercises", content: "Exercise content" },
    ]);

    const req = new NextRequest("http://localhost/api/lessons/l1/ai");
    const res = await getLessonAI(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.summary).toBe("Summary content");
    expect(json.explanation).toBe("Explanation content");
    expect(json.quiz).toBe("Quiz content");
    expect(json.flashcards).toBe("Flashcard content");
    expect(json.exercises).toBe("Exercise content");
  });

  it("returns 404 when lesson does not exist", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/lessons/nonexistent/ai");
    const res = await getLessonAI(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("queries lessonArtifact for AI data with correct filters", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/lessons/l1/ai");
    await getLessonAI(req, { params: Promise.resolve({ id: "l1" }) });

    expect(mockPrisma.lessonArtifact.findMany).toHaveBeenCalledWith({
      where: { lessonId: "l1", userId: "test-user-id" },
      select: { type: true, content: true },
    });
  });

  it("normalizes null DB values to null in response (not undefined)", async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: "l1" });
    mockPrisma.lessonArtifact.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/lessons/l1/ai");
    const res = await getLessonAI(req, { params: Promise.resolve({ id: "l1" }) });
    const json = await res.json();

    for (const key of ["summary", "explanation", "quiz", "flashcards", "exercises"]) {
      expect(json[key]).toBeNull();
    }
  });
});

describe("GET /api/courses/[id]/ai", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns roadmap as null when course has no roadmap", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ roadmap: null });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/courses/c1/ai");
    const res = await getCourseAI(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBeNull();
    expect(json.hasProfile).toBe(false);
    expect(json.progressPercent).toBe(0);
  });

  it("returns saved roadmap when it exists", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ roadmap: "## Learning Roadmap\n..." });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue({ id: "lp1", courseId: "c1" });
    mockPrisma.courseProgress.findFirst.mockResolvedValue({ completionPct: 42 });

    const req = new NextRequest("http://localhost/api/courses/c1/ai");
    const res = await getCourseAI(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBe("## Learning Roadmap\n...");
    expect(json.hasProfile).toBe(true);
    expect(json.progressPercent).toBe(42);
  });

  it("returns 404 when course does not exist", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/courses/nonexistent/ai");
    const res = await getCourseAI(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("queries only the roadmap field", async () => {
    mockPrisma.course.findFirst.mockResolvedValue({ roadmap: null });
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);
    mockPrisma.courseProgress.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/courses/c1/ai");
    await getCourseAI(req, { params: Promise.resolve({ id: "c1" }) });

    expect(mockPrisma.course.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", userId: "test-user-id" },
      select: { roadmap: true },
    });
  });
});
