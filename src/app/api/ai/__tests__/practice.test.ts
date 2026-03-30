/**
 * Integration tests for POST /api/ai/quiz (quiz, flashcards, exercises modes).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreate, mockPrisma } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPrisma: {
    lesson: {
      findUnique: vi.fn(), update: vi.fn(), create: vi.fn(),
      findFirst: vi.fn(), count: vi.fn(), deleteMany: vi.fn(),
    },
    course: {
      findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(),
      findUnique: vi.fn(), delete: vi.fn(), update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai/client", () => ({
  createAIClient: vi.fn(() => ({
    chat: { completions: { create: mockCreate } },
  })),
  getCleanHeaders: vi.fn(),
}));

import { POST as practicePost } from "@/app/api/ai/quiz/route";

const VALID_BASE = {
  lessonId: "l1",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/quiz", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/ai/quiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "Some transcript", course: { title: "C" },
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Generated content" } }],
    });
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });
  });

  // ─── Mode validation ────────────────────────────────────────────────────────
  it("returns 400 when mode is invalid", async () => {
    const req = makeRequest({ ...VALID_BASE, mode: "invalid-mode" });
    const res = await practicePost(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when mode is missing", async () => {
    const req = makeRequest(VALID_BASE);
    const res = await practicePost(req);

    expect(res.status).toBe(400);
  });

  // ─── No transcript ──────────────────────────────────────────────────────────
  it("returns 400 when lesson has no transcript", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: null, course: { title: "C" },
    });

    const req = makeRequest({ ...VALID_BASE, mode: "quiz" });
    const res = await practicePost(req);

    expect(res.status).toBe(400);
  });

  // ─── Quiz mode ──────────────────────────────────────────────────────────────
  it("mode=quiz persists to quiz field in DB", async () => {
    const req = makeRequest({ ...VALID_BASE, mode: "quiz" });
    await practicePost(req);

    expect(mockPrisma.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quiz: "Generated content" } })
    );
  });

  it("mode=quiz returns result and mode in response", async () => {
    const req = makeRequest({ ...VALID_BASE, mode: "quiz" });
    const res = await practicePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.mode).toBe("quiz");
    expect(json.result).toBe("Generated content");
  });

  // ─── Flashcards mode ────────────────────────────────────────────────────────
  it("mode=flashcards persists to flashcards field in DB", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Flashcard content" } }],
    });

    const req = makeRequest({ ...VALID_BASE, mode: "flashcards" });
    await practicePost(req);

    expect(mockPrisma.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { flashcards: "Flashcard content" } })
    );
  });

  it("mode=flashcards returns mode=flashcards in response", async () => {
    const req = makeRequest({ ...VALID_BASE, mode: "flashcards" });
    const res = await practicePost(req);
    const json = await res.json();

    expect(json.mode).toBe("flashcards");
  });

  // ─── Exercises mode ─────────────────────────────────────────────────────────
  it("mode=exercises persists to exercises field in DB", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Exercise content" } }],
    });

    const req = makeRequest({ ...VALID_BASE, mode: "exercises" });
    await practicePost(req);

    expect(mockPrisma.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { exercises: "Exercise content" } })
    );
  });

  it("mode=exercises returns mode=exercises in response", async () => {
    const req = makeRequest({ ...VALID_BASE, mode: "exercises" });
    const res = await practicePost(req);
    const json = await res.json();

    expect(json.mode).toBe("exercises");
  });

  // ─── Think-tag stripping ────────────────────────────────────────────────────
  it("strips <think> tags from AI result for all modes", async () => {
    for (const mode of ["quiz", "flashcards", "exercises"] as const) {
      vi.clearAllMocks();
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: "l1", title: "L", transcript: "T", course: { title: "C" },
      });
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: `<think>hidden</think>Content for ${mode}` } }],
      });
      mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

      const req = makeRequest({ ...VALID_BASE, mode });
      const res = await practicePost(req);
      const json = await res.json();

      expect(json.result).toBe(`Content for ${mode}`);
      expect(json.result).not.toContain("<think>");
    }
  });

  // ─── Zod validation ─────────────────────────────────────────────────────────
  it("returns 400 when baseUrl is invalid", async () => {
    const req = makeRequest({ ...VALID_BASE, mode: "quiz", baseUrl: "not-a-url" });
    const res = await practicePost(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when apiKey is empty", async () => {
    const req = makeRequest({ ...VALID_BASE, mode: "quiz", apiKey: "" });
    const res = await practicePost(req);

    expect(res.status).toBe(400);
  });
});
