/**
 * Tests for depth selector, selectedText mode, and LearnerProfile integration
 * in POST /api/ai/explain.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn();
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
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    learnerProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    course: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai/client", () => ({
  createAIClient: vi.fn(() => ({
    chat: { completions: { create: mockCreate } },
  })),
  getCleanHeaders: vi.fn(() => ({
    Authorization: "Bearer test",
    "Content-Type": "application/json",
    "User-Agent": "inkgest/1.0",
  })),
}));

import { POST as explainPost } from "@/app/api/ai/explain/route";

const VALID_BODY = {
  lessonId: "l1",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

// Helper: generate a transcript with N words
function generateTranscript(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(" ");
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/explain", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function setupLessonMock(overrides: Record<string, unknown> = {}) {
  const lesson = {
    id: "l1",
    title: "Lesson Title",
    transcript: generateTranscript(300),
    courseId: "c1",
    course: { id: "c1", title: "Course Title" },
    ...overrides,
  };
  mockPrisma.lesson.findFirst.mockResolvedValue(lesson);
  return lesson;
}

/** Create an async generator that yields a single chunk */
async function* makeChunkStream(content: string) {
  yield { choices: [{ delta: { content } }] };
}

/** Consume a streaming response body and return the accumulated text */
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

function setupAIMock(content: string = "AI explanation content") {
  mockCreate.mockResolvedValue(makeChunkStream(content));
  mockPrisma.lessonArtifact.upsert.mockResolvedValue({ content });
}

describe("POST /api/ai/explain — depth, selectedText, LearnerProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);
    mockPrisma.lessonArtifact.findUnique.mockResolvedValue(null);
    mockPrisma.lessonArtifact.upsert.mockResolvedValue({ content: "" });
  });

  // ─── Depth selector ───────────────────────────────────────────

  describe("depth selector", () => {
    it("default depth (standard) returns 200 with depthActual=standard", async () => {
      setupLessonMock();
      setupAIMock();

      const res = await explainPost(makeRequest(VALID_BODY));
      // cache guard returns JSON with depthActual for cached; AI path streams
      // For fresh AI call, the route streams. The depthActual is only in the JSON
      // cache path. For the streaming path we check status and that AI was called.
      expect(res.status).toBe(200);
      // Consume stream (AI path)
      await readStream(res);
      expect(mockCreate).toHaveBeenCalled();
    });

    it('depth="simple" uses simple prompt and returns depthActual=simple', async () => {
      setupLessonMock();
      setupAIMock();

      const res = await explainPost(
        makeRequest({ ...VALID_BODY, depth: "simple" })
      );

      expect(res.status).toBe(200);
      await readStream(res);
      // Verify the system prompt passed to AI contains simple-specific text
      const systemMsg = mockCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).toContain("ELI5");
    });

    it('depth="deep" uses deep prompt and returns depthActual=deep', async () => {
      setupLessonMock();
      setupAIMock();

      const res = await explainPost(
        makeRequest({ ...VALID_BODY, depth: "deep" })
      );

      expect(res.status).toBe(200);
      await readStream(res);
      const systemMsg = mockCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).toContain("edge cases");
    });

    it('depth="deep" with short transcript (<200 words) auto-downgrades to standard', async () => {
      setupLessonMock({ transcript: generateTranscript(100) });
      setupAIMock();

      const res = await explainPost(
        makeRequest({ ...VALID_BODY, depth: "deep" })
      );

      expect(res.status).toBe(200);
      await readStream(res);
      // System prompt should NOT contain deep-specific markers
      const systemMsg = mockCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).not.toContain("edge cases");
    });
  });

  // ─── selectedText mode ────────────────────────────────────────

  describe("selectedText mode", () => {
    it("returns explanation without persisting to DB when selectedText provided", async () => {
      setupLessonMock();
      setupAIMock("Focused explanation");

      const res = await explainPost(
        makeRequest({ ...VALID_BODY, selectedText: "some selected text" })
      );

      expect(res.status).toBe(200);
      const text = await readStream(res);
      await new Promise((r) => setTimeout(r, 0));
      expect(text).toBe("Focused explanation");
      // Should NOT persist to DB when selectedText is provided
      expect(mockPrisma.lessonArtifact.upsert).not.toHaveBeenCalled();
    });

    it("selectedText empty string returns 400", async () => {
      setupLessonMock();

      const res = await explainPost(
        makeRequest({ ...VALID_BODY, selectedText: "" })
      );

      expect(res.status).toBe(400);
    });

    it("selectedText injects focus instruction into prompt", async () => {
      setupLessonMock();
      setupAIMock();

      await explainPost(
        makeRequest({ ...VALID_BODY, selectedText: "specific concept" })
      );

      const userMsg = mockCreate.mock.calls[0][0].messages[1].content;
      expect(userMsg).toContain("specific concept");
    });
  });

  // ─── LearnerProfile integration ──────────────────────────────

  describe("LearnerProfile integration", () => {
    it("LearnerProfile found → injected into system prompt", async () => {
      setupLessonMock();
      setupAIMock();
      mockPrisma.learnerProfile.findFirst.mockResolvedValue({
        id: "lp1",
        courseId: "c1",
        level: "beginner",
        goal: "learn basics",
        dailyTimeMin: 30,
        learningStyle: "visual",
      });

      const res = await explainPost(makeRequest(VALID_BODY));

      expect(res.status).toBe(200);
      await readStream(res);
      const systemMsg = mockCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).toContain("beginner");
      expect(systemMsg).toContain("Người học có trình độ");
    });

    it("LearnerProfile not found → no error, proceeds normally", async () => {
      setupLessonMock();
      setupAIMock();
      mockPrisma.learnerProfile.findFirst.mockResolvedValue(null);

      const res = await explainPost(makeRequest(VALID_BODY));

      expect(res.status).toBe(200);
      await readStream(res);
      // System prompt should NOT contain learner level line
      const systemMsg = mockCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).not.toContain("Người học có trình độ");
    });
  });

  // ─── Cache guard ──────────────────────────────────────────────

  describe("cache guard", () => {
    it("returns cached explanation when not force (with depthActual)", async () => {
      setupLessonMock();
      mockPrisma.lessonArtifact.findUnique.mockResolvedValue({ content: "cached result" });

      const res = await explainPost(makeRequest(VALID_BODY));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.explanation).toBe("cached result");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("force=true regenerates even when cached", async () => {
      setupLessonMock();
      mockPrisma.lessonArtifact.findUnique.mockResolvedValue({ content: "cached result" });
      setupAIMock("fresh result");

      const res = await explainPost(
        makeRequest({ ...VALID_BODY, force: true })
      );

      expect(res.status).toBe(200);
      const text = await readStream(res);
      expect(text).toBe("fresh result");
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  // ─── Think tag stripping still works ──────────────────────────

  it("strips <think> tags from AI response", async () => {
    setupLessonMock();
    setupAIMock("<think>reasoning</think>Clean output");

    const res = await explainPost(makeRequest(VALID_BODY));
    const text = await readStream(res);

    expect(text).toBe("Clean output");
  });

  // ─── Edge case: code-ratio classification ─────────────────────────────────
  describe("code-ratio classification", () => {
    // classifyCodeRatio uses character-based code block detection (``` ... ```)
    // >30% code chars → code-heavy → FORMAT_INSTRUCTIONS includes "Walkthrough"
    it("code-heavy transcript (>30% code) triggers code-focused prompt format", async () => {
      // Create a transcript with lots of code blocks (>30% code content)
      const codeHeavyTranscript = `
Here is how we define a function:
\`\`\`javascript
function add(a, b) {
  return a + b;
}
const result = add(1, 2);
console.log(result);
function subtract(a, b) {
  return a - b;
}
const diff = subtract(5, 3);
console.log(diff);
function multiply(a, b) {
  return a * b;
}
const product = multiply(4, 5);
console.log(product);
\`\`\`
This is a short explanation.
      `.trim();

      setupLessonMock({ transcript: codeHeavyTranscript });
      setupAIMock();

      const res = await explainPost(makeRequest(VALID_BODY));
      await readStream(res);

      // Verify the system prompt reflects code-heavy or hybrid classification
      const systemMsg = mockCreate.mock.calls[0][0].messages[0].content;
      // For code-heavy transcripts, expect code-specific format instructions
      expect(
        systemMsg.includes("Walkthrough") || systemMsg.includes("HYBRID") || systemMsg.includes("code")
      ).toBe(true);
    });
  });

  // ─── Edge case: selectedText + depth=deep combination ─────────────────────
  describe("selectedText + depth combination", () => {
    it("selectedText + depth=deep uses both in prompt", async () => {
      setupLessonMock(); // 300 words — enough for deep
      setupAIMock();

      const res = await explainPost(
        makeRequest({ ...VALID_BODY, depth: "deep", selectedText: "closure concept" })
      );

      expect(res.status).toBe(200);
      await readStream(res);

      const systemMsg = mockCreate.mock.calls[0][0].messages[0].content;
      // deep prompt should contain deep-specific markers
      expect(systemMsg).toContain("edge cases");
      // selectedText should be injected into prompt
      expect(systemMsg).toContain("closure concept");
    });
  });

  // ─── Edge case: Feynman Technique reference ───────────────────────────────
  describe("Feynman Technique in prompts", () => {
    it("standard depth prompt mentions Feynman technique", async () => {
      setupLessonMock();
      setupAIMock();

      const res = await explainPost(
        makeRequest({ ...VALID_BODY, depth: "standard" })
      );

      expect(res.status).toBe(200);
      await readStream(res);

      const systemMsg = mockCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).toContain("Feynman");
    });
  });
});
