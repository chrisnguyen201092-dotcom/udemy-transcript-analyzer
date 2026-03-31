/**
 * Integration tests for POST /api/ai/quiz (quiz, flashcards, exercises modes).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Streaming helpers ─────────────────────────────────────────────────────
async function* makeChunkStream(content: string) {
  yield { choices: [{ delta: { content } }] };
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  return text;
}

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
      id: "l1", title: "L", transcript: "Some transcript",
      course: { title: "C", contentType: "course" },
    });
    mockCreate.mockResolvedValue(makeChunkStream("Generated content"));
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
      id: "l1", title: "L", transcript: null,
      course: { title: "C", contentType: "course" },
    });

    const req = makeRequest({ ...VALID_BASE, mode: "quiz" });
    const res = await practicePost(req);

    expect(res.status).toBe(400);
  });

  // ─── Quiz mode ──────────────────────────────────────────────────────────────
  it("mode=quiz persists to quiz field in DB", async () => {
    const req = makeRequest({ ...VALID_BASE, mode: "quiz" });
    const res = await practicePost(req);
    await readStream(res);
    await new Promise((r) => setTimeout(r, 0)); // flush fullText.then()

    expect(mockPrisma.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quiz: "Generated content" } })
    );
  });

  it("mode=quiz returns streaming response with generated content", async () => {
    const req = makeRequest({ ...VALID_BASE, mode: "quiz" });
    const res = await practicePost(req);
    const text = await readStream(res);

    expect(res.status).toBe(200);
    expect(text).toBe("Generated content");
  });

  // ─── Flashcards mode ────────────────────────────────────────────────────────
  it("mode=flashcards persists to flashcards field in DB", async () => {
    mockCreate.mockResolvedValue(makeChunkStream("Flashcard content"));

    const req = makeRequest({ ...VALID_BASE, mode: "flashcards" });
    const res = await practicePost(req);
    await readStream(res);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockPrisma.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { flashcards: "Flashcard content" } })
    );
  });

  it("mode=flashcards returns streaming response", async () => {
    mockCreate.mockResolvedValue(makeChunkStream("Flashcard content"));
    const req = makeRequest({ ...VALID_BASE, mode: "flashcards" });
    const res = await practicePost(req);
    const text = await readStream(res);

    expect(res.status).toBe(200);
    expect(text).toBe("Flashcard content");
  });

  // ─── Exercises mode ─────────────────────────────────────────────────────────
  it("mode=exercises persists to exercises field in DB", async () => {
    mockCreate.mockResolvedValue(makeChunkStream("Exercise content"));

    const req = makeRequest({ ...VALID_BASE, mode: "exercises" });
    const res = await practicePost(req);
    await readStream(res);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockPrisma.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { exercises: "Exercise content" } })
    );
  });

  it("mode=exercises returns streaming response", async () => {
    mockCreate.mockResolvedValue(makeChunkStream("Exercise content"));
    const req = makeRequest({ ...VALID_BASE, mode: "exercises" });
    const res = await practicePost(req);
    const text = await readStream(res);

    expect(res.status).toBe(200);
    expect(text).toBe("Exercise content");
  });

  // ─── Think-tag stripping ────────────────────────────────────────────────────
  it("strips <think> tags from AI result for all modes", async () => {
    for (const mode of ["quiz", "flashcards", "exercises"] as const) {
      vi.clearAllMocks();
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: "l1", title: "L", transcript: "T",
        course: { title: "C", contentType: "course" },
      });
      mockCreate.mockResolvedValue(
        makeChunkStream(`<think>hidden</think>Content for ${mode}`)
      );
      mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

      const req = makeRequest({ ...VALID_BASE, mode });
      const res = await practicePost(req);
      const text = await readStream(res);

      expect(text).toBe(`Content for ${mode}`);
      expect(text).not.toContain("<think>");
    }
  });

  // ─── Cache hit (JSON path) ──────────────────────────────────────────────────
  it("returns cached result as JSON when quiz is already stored", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T",
      quiz: "cached quiz content",
      course: { title: "C", contentType: "course" },
    });

    const req = makeRequest({ ...VALID_BASE, mode: "quiz" });
    const res = await practicePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.mode).toBe("quiz");
    expect(json.result).toBe("cached quiz content");
    expect(mockCreate).not.toHaveBeenCalled();
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
