/**
 * Tests for mode parameter in POST /api/ai/summary.
 * TDD: Written BEFORE implementation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const { mockCreate, mockPrisma } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
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
  getCleanHeaders: vi.fn(() => ({
    Authorization: "Bearer test",
    "Content-Type": "application/json",
    "User-Agent": "udemy-learner/1.0",
  })),
}));

// Must import AFTER mocks
import { POST as summaryPost } from "@/app/api/ai/summary/route";
import { getSystemPrompt } from "@/lib/ai/prompts";

const VALID_BODY = {
  lessonId: "l1",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

const LESSON_WITH_TRANSCRIPT = {
  id: "l1",
  title: "Lesson",
  transcript: "Some transcript content here",
  course: { title: "Course" },
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/summary", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
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

describe("POST /api/ai/summary — mode parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses detailed prompt when no mode param is provided (default)", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(LESSON_WITH_TRANSCRIPT);
    mockCreate.mockResolvedValue(makeChunkStream("Detailed summary"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const res = await summaryPost(req);

    expect(res.status).toBe(200);
    const text = await readStream(res);
    expect(text).toBe("Detailed summary");

    // Verify the system prompt used is the "summary" (detailed) prompt
    const callArgs = mockCreate.mock.calls[0][0];
    const systemContent = callArgs.messages[0].content;
    expect(systemContent).toBe(getSystemPrompt("summary"));
  });

  it("uses quick prompt when mode='quick'", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(LESSON_WITH_TRANSCRIPT);
    mockCreate.mockResolvedValue(makeChunkStream("Quick summary"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest({ ...VALID_BODY, mode: "quick" });
    const res = await summaryPost(req);

    expect(res.status).toBe(200);
    const text = await readStream(res);
    expect(text).toBe("Quick summary");

    // Verify the system prompt used is the "summary-quick" prompt
    const callArgs = mockCreate.mock.calls[0][0];
    const systemContent = callArgs.messages[0].content;
    expect(systemContent).toBe(getSystemPrompt("summary-quick"));
  });

  it("uses detailed prompt when mode='detailed' (explicit)", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(LESSON_WITH_TRANSCRIPT);
    mockCreate.mockResolvedValue(makeChunkStream("Detailed summary"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest({ ...VALID_BODY, mode: "detailed" });
    const res = await summaryPost(req);

    expect(res.status).toBe(200);
    const text = await readStream(res);
    expect(text).toBe("Detailed summary");

    // Verify the system prompt used is the "summary" (detailed) prompt
    const callArgs = mockCreate.mock.calls[0][0];
    const systemContent = callArgs.messages[0].content;
    expect(systemContent).toBe(getSystemPrompt("summary"));
  });

  it("returns 400 for invalid mode value", async () => {
    const req = makeRequest({ ...VALID_BODY, mode: "ultra" });
    const res = await summaryPost(req);

    expect(res.status).toBe(400);
  });

  it("returns cached summary without calling AI when summary exists and force is not set", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      ...LESSON_WITH_TRANSCRIPT,
      summary: "Cached summary",
    });

    const req = makeRequest({ ...VALID_BODY, mode: "quick" });
    const res = await summaryPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.summary).toBe("Cached summary");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPrisma.lesson.update).not.toHaveBeenCalled();
  });

  it("regenerates summary with force=true even when cached", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      ...LESSON_WITH_TRANSCRIPT,
      summary: "Old cached summary",
    });
    mockCreate.mockResolvedValue(makeChunkStream("New quick summary"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest({ ...VALID_BODY, mode: "quick", force: true });
    const res = await summaryPost(req);
    const text = await readStream(res);
    await new Promise((r) => setTimeout(r, 0)); // flush fullText.then()

    expect(res.status).toBe(200);
    expect(text).toBe("New quick summary");
    expect(mockCreate).toHaveBeenCalled();
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { summary: "New quick summary" },
    });

    // Verify quick prompt was used
    const callArgs = mockCreate.mock.calls[0][0];
    const systemContent = callArgs.messages[0].content;
    expect(systemContent).toBe(getSystemPrompt("summary-quick"));
  });

  it("returns appropriate error when lesson not found", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const req = makeRequest({ ...VALID_BODY, mode: "quick" });
    const res = await summaryPost(req);

    expect(res.status).toBe(400);
  });
});

describe("getSystemPrompt — summary-quick type", () => {
  it("returns a string for summary-quick type", () => {
    const prompt = getSystemPrompt("summary-quick");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("summary-quick prompt contains Key Takeaways instruction", () => {
    const prompt = getSystemPrompt("summary-quick");
    expect(prompt).toContain("Key Takeaways");
  });

  it("summary-quick prompt contains word limit (300-500)", () => {
    const prompt = getSystemPrompt("summary-quick");
    expect(prompt).toMatch(/300.*500/);
  });

  it("summary (detailed) prompt contains Key Takeaways instruction", () => {
    const prompt = getSystemPrompt("summary");
    expect(prompt).toContain("Key Takeaways");
  });

  it("summary-quick is different from summary (detailed)", () => {
    const quick = getSystemPrompt("summary-quick");
    const detailed = getSystemPrompt("summary");
    expect(quick).not.toBe(detailed);
  });
});

// ─── Edge case: mode switching with cache ─────────────────────────────────────

describe("POST /api/ai/summary — mode switching edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mode switching: quick cache exists, request detailed → still returns cached (summary field is shared)", async () => {
    // The summary route uses a single `summary` field regardless of mode.
    // When cached summary exists and force is not set, it returns cached regardless of mode.
    mockPrisma.lesson.findUnique.mockResolvedValue({
      ...LESSON_WITH_TRANSCRIPT,
      summary: "Quick summary previously cached",
    });

    const req = makeRequest({ ...VALID_BODY, mode: "detailed" });
    const res = await summaryPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.summary).toBe("Quick summary previously cached");
    // Cache guard means no AI call even when switching modes
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("mode switching: detailed cache exists, request quick with force=true → calls AI with quick prompt", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      ...LESSON_WITH_TRANSCRIPT,
      summary: "Detailed summary previously cached",
    });
    mockCreate.mockResolvedValue(makeChunkStream("New quick summary"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest({ ...VALID_BODY, mode: "quick", force: true });
    const res = await summaryPost(req);
    const text = await readStream(res);

    expect(res.status).toBe(200);
    expect(text).toBe("New quick summary");
    expect(mockCreate).toHaveBeenCalled();

    // Verify quick prompt was used
    const callArgs = mockCreate.mock.calls[0][0];
    const systemContent = callArgs.messages[0].content;
    expect(systemContent).toBe(getSystemPrompt("summary-quick"));
  });
});
