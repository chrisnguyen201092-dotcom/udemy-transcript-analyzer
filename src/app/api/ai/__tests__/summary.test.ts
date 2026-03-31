/**
 * Integration tests for POST /api/ai/summary.
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

import { POST as summaryPost } from "@/app/api/ai/summary/route";

const VALID_BODY = {
  lessonId: "l1",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
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

describe("POST /api/ai/summary", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 400 when lesson has no transcript", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "Lesson", transcript: null, course: { title: "Course" },
    });

    const req = makeRequest(VALID_BODY);
    const res = await summaryPost(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when lesson does not exist", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue(null);

    const req = makeRequest(VALID_BODY);
    const res = await summaryPost(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when apiKey is missing", async () => {
    const req = makeRequest({ lessonId: "l1", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" });
    const res = await summaryPost(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when baseUrl is not a valid URL", async () => {
    const req = makeRequest({ ...VALID_BODY, baseUrl: "not-a-url" });
    const res = await summaryPost(req);

    expect(res.status).toBe(400);
  });

  it("strips <think>...</think> tags from AI response", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "Lesson", transcript: "Some transcript",
      course: { title: "Course" },
    });
    mockCreate.mockResolvedValue(makeChunkStream("<think>internal thoughts</think>Actual summary"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const res = await summaryPost(req);

    expect(res.status).toBe(200);
    const text = await readStream(res);
    expect(text).toBe("Actual summary");
    expect(text).not.toContain("<think>");
  });

  it("persists summary to DB via lesson.update", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
    });
    mockCreate.mockResolvedValue(makeChunkStream("Summary text"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const res = await summaryPost(req);
    await readStream(res); // consume stream to trigger fullText.then()
    await new Promise((r) => setTimeout(r, 0)); // flush microtask queue

    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { summary: "Summary text" },
    });
  });

  it("returns cached summary without calling LLM when summary exists and force is not set", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
      summary: "Old summary",
    });

    const req = makeRequest(VALID_BODY);
    const res = await summaryPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.summary).toBe("Old summary");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPrisma.lesson.update).not.toHaveBeenCalled();
  });

  it("regenerates summary with force=true even when cached value exists", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
      summary: "Old summary",
    });
    mockCreate.mockResolvedValue(makeChunkStream("New summary"));
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1", summary: "New summary" });

    const req = makeRequest({ ...VALID_BODY, force: true });
    const res = await summaryPost(req);
    const text = await readStream(res);
    await new Promise((r) => setTimeout(r, 0));

    expect(text).toBe("New summary");
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { summary: "New summary" } })
    );
  });

  it("handles AI response with null content gracefully", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1", title: "L", transcript: "T", course: { title: "C" },
    });
    // null delta content → stream produces empty string
    async function* makeNullContentStream() {
      yield { choices: [{ delta: { content: null } }] };
    }
    mockCreate.mockResolvedValue(makeNullContentStream());
    mockPrisma.lesson.update.mockResolvedValue({ id: "l1" });

    const req = makeRequest(VALID_BODY);
    const res = await summaryPost(req);
    const text = await readStream(res);

    expect(res.status).toBe(200);
    expect(text).toBe(""); // null content → skipped in stream
  });

  it("returns 400 when model field is missing", async () => {
    const req = makeRequest({ lessonId: "l1", apiKey: "sk-test", baseUrl: "https://api.openai.com/v1" });
    const res = await summaryPost(req);

    expect(res.status).toBe(400);
  });
});
