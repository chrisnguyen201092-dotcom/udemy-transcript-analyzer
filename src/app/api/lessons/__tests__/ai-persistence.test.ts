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
    course: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET as getLessonAI } from "@/app/api/lessons/[id]/ai/route";
import { GET as getCourseAI } from "@/app/api/courses/[id]/ai/route";

describe("GET /api/lessons/[id]/ai", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns all 5 AI fields as null when lesson has no AI data", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      summary: null,
      explanation: null,
      quiz: null,
      flashcards: null,
      exercises: null,
    });

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
    mockPrisma.lesson.findUnique.mockResolvedValue({
      summary: "Summary content",
      explanation: "Explanation content",
      quiz: "Quiz content",
      flashcards: "Flashcard content",
      exercises: "Exercise content",
    });

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
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/lessons/nonexistent/ai");
    const res = await getLessonAI(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("queries only the 5 AI select fields (no full lesson data)", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      summary: null, explanation: null, quiz: null, flashcards: null, exercises: null,
    });

    const req = new NextRequest("http://localhost/api/lessons/l1/ai");
    await getLessonAI(req, { params: Promise.resolve({ id: "l1" }) });

    expect(mockPrisma.lesson.findUnique).toHaveBeenCalledWith({
      where: { id: "l1" },
      select: {
        summary: true,
        explanation: true,
        quiz: true,
        flashcards: true,
        exercises: true,
      },
    });
  });

  it("normalizes null DB values to null in response (not undefined)", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      summary: null,
      explanation: null,
      quiz: null,
      flashcards: null,
      exercises: null,
    });

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
    mockPrisma.course.findUnique.mockResolvedValue({ roadmap: null });

    const req = new NextRequest("http://localhost/api/courses/c1/ai");
    const res = await getCourseAI(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBeNull();
  });

  it("returns saved roadmap when it exists", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ roadmap: "## Learning Roadmap\n..." });

    const req = new NextRequest("http://localhost/api/courses/c1/ai");
    const res = await getCourseAI(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadmap).toBe("## Learning Roadmap\n...");
  });

  it("returns 404 when course does not exist", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/courses/nonexistent/ai");
    const res = await getCourseAI(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("queries only the roadmap field", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ roadmap: null });

    const req = new NextRequest("http://localhost/api/courses/c1/ai");
    await getCourseAI(req, { params: Promise.resolve({ id: "c1" }) });

    expect(mockPrisma.course.findUnique).toHaveBeenCalledWith({
      where: { id: "c1" },
      select: { roadmap: true },
    });
  });
});
